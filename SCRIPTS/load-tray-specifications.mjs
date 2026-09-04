#!/usr/bin/env node
/**
 * Turn a crawl of tray manufacturer specifications into seed SQL.
 *
 * Usage:
 *   node SCRIPTS/load-tray-specifications.mjs <input.csv> [--append]
 *
 * Reads a CSV whose columns are listed in REQUIRED and OPTIONAL below, checks
 * every row, and writes INSERT statements to stdout, or appends them to
 * data/vehicle-selector/seed.sql with --append.
 *
 * It refuses the whole file if any row is bad. A partial load would leave the
 * database in a state nobody chose, and a tray dimension that is wrong by the
 * thickness of a headboard can move a customer to the wrong camper: the model
 * finder matches within 50mm.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  'manufacturer', 'tray_model', 'cab_type',
  'length_mm', 'width_mm',
  'dimension_basis', 'dimension_basis_quote',
  'source_id', 'source_manufacturer', 'source_title', 'source_url', 'source_accessed_date',
  'source_locator',
];
const OPTIONAL = ['vehicle_make', 'vehicle_model', 'height_mm', 'tray_mass_kg', 'fits_note', 'verification_status', 'notes'];

const CAB_TYPES = new Set(['single', 'extra', 'dual', 'crew', 'any']);
const BASES = new Set(['outside', 'usable']);
const STATUSES = new Set(['source_verified', 'needs_secondary_review']);

/** Minimal RFC4180 reader: quoted fields, doubled quotes, embedded commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const qOrNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? 'NULL' : q(String(v).trim()));
const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function integerAt(row, field, errors, index, { min, max }) {
  const raw = (row[field] ?? '').trim();
  if (!/^\d+$/.test(raw)) {
    errors.push(`row ${index}: ${field} must be a whole number of millimetres, got ${JSON.stringify(raw)}`);
    return null;
  }
  const value = Number(raw);
  if (value < min || value > max) {
    errors.push(`row ${index}: ${field} of ${value} is outside ${min} to ${max}, which is not a tray`);
    return null;
  }
  return value;
}

export function validateRows(rows) {
  const errors = [];
  const seen = new Set();
  const parsed = [];
  const sources = new Map();

  rows.forEach((row, i) => {
    const index = i + 1;
    for (const field of REQUIRED) {
      if (!(row[field] ?? '').trim()) errors.push(`row ${index}: ${field} is required and empty`);
    }
    if (!CAB_TYPES.has((row.cab_type ?? '').trim())) {
      errors.push(`row ${index}: cab_type must be one of ${[...CAB_TYPES].join(', ')}, got ${JSON.stringify(row.cab_type)}`);
    }
    // The whole reason this column exists: an unknown basis is not usable data.
    if (!BASES.has((row.dimension_basis ?? '').trim())) {
      errors.push(`row ${index}: dimension_basis must be 'outside' or 'usable', got ${JSON.stringify(row.dimension_basis)}`);
    }
    const status = (row.verification_status ?? 'source_verified').trim();
    if (!STATUSES.has(status)) errors.push(`row ${index}: verification_status must be one of ${[...STATUSES].join(', ')}`);

    const length = integerAt(row, 'length_mm', errors, index, { min: 1000, max: 4999 });
    const width = integerAt(row, 'width_mm', errors, index, { min: 1000, max: 2999 });
    const height = (row.height_mm ?? '').trim()
      ? integerAt(row, 'height_mm', errors, index, { min: 1, max: 1999 })
      : null;
    const trayMass = (row.tray_mass_kg ?? '').trim()
      ? integerAt(row, 'tray_mass_kg', errors, index, { min: 1, max: 999 })
      : null;

    // A row that names one half of a vehicle and not the other is a mapping nobody can use.
    const hasMake = Boolean((row.vehicle_make ?? '').trim());
    const hasModel = Boolean((row.vehicle_model ?? '').trim());
    if (hasMake !== hasModel) {
      errors.push(`row ${index}: give both vehicle_make and vehicle_model, or neither for a size that fits a class`);
    }

    const id = [row.manufacturer, row.tray_model, row.vehicle_make, row.vehicle_model, row.cab_type, row.length_mm]
      .filter((part) => (part ?? '').trim())
      .map(slug)
      .join('-');
    if (seen.has(id)) errors.push(`row ${index}: duplicate id ${id}`);
    seen.add(id);

    const sourceId = (row.source_id ?? '').trim();
    if (sourceId) {
      const existing = sources.get(sourceId);
      const next = {
        id: sourceId,
        manufacturer: (row.source_manufacturer ?? '').trim(),
        title: (row.source_title ?? '').trim(),
        url: (row.source_url ?? '').trim(),
        accessed: (row.source_accessed_date ?? '').trim(),
      };
      if (existing && JSON.stringify(existing) !== JSON.stringify(next)) {
        errors.push(`row ${index}: source ${sourceId} is described two different ways`);
      }
      sources.set(sourceId, next);
      if (!/^https:\/\//.test(next.url)) errors.push(`row ${index}: source_url must be https`);
    }

    parsed.push({ ...row, id, length, width, height, trayMass, status });
  });

  return { valid: errors.length === 0, errors, rows: parsed, sources: [...sources.values()] };
}

export function toSql({ rows, sources }) {
  const out = [];
  out.push('');
  out.push('-- Tray manufacturer specifications, generated by');
  out.push('-- SCRIPTS/load-tray-specifications.mjs. Do not hand-edit: reload the CSV.');
  out.push('INSERT OR IGNORE INTO sources (id, manufacturer, title, url, published_date, accessed_date, source_type, market, notes) VALUES');
  out.push(sources.map((s) => `  (${q(s.id)}, ${q(s.manufacturer)}, ${q(s.title)}, ${q(s.url)}, NULL, ${q(s.accessed)}, 'manufacturer_webpage', 'AU', NULL)`).join(',\n') + ';');
  out.push('');
  out.push('INSERT INTO tray_specifications (');
  out.push('  id, manufacturer, tray_model, vehicle_make, vehicle_model, cab_type, fits_note,');
  out.push('  length_mm, width_mm, height_mm, tray_mass_kg, dimension_basis, dimension_basis_quote,');
  out.push('  source_id, source_locator, verification_status, customer_selectable, notes');
  out.push(') VALUES');
  out.push(rows.map((r) => '  (' + [
    q(r.id), q(r.manufacturer.trim()), q(r.tray_model.trim()),
    qOrNull(r.vehicle_make), qOrNull(r.vehicle_model), q(r.cab_type.trim()), qOrNull(r.fits_note),
    r.length, r.width, r.height === null ? 'NULL' : r.height, r.trayMass === null ? 'NULL' : r.trayMass,
    q(r.dimension_basis.trim()), q(r.dimension_basis_quote.trim()),
    q(r.source_id.trim()), q(r.source_locator.trim()), q(r.status), '0', qOrNull(r.notes),
  ].join(', ') + ')').join(',\n') + ';');
  return out.join('\n') + '\n';
}

function main() {
  const [input, ...flags] = process.argv.slice(2);
  if (!input) {
    console.error('usage: node SCRIPTS/load-tray-specifications.mjs <input.csv> [--append]');
    process.exit(2);
  }
  const table = parseCsv(readFileSync(input, 'utf8'));
  const [header, ...body] = table;
  const known = new Set([...REQUIRED, ...OPTIONAL]);
  const unknown = header.filter((h) => !known.has(h.trim()));
  if (unknown.length) {
    console.error(`Unknown columns: ${unknown.join(', ')}`);
    console.error(`Known columns: ${[...known].join(', ')}`);
    process.exit(1);
  }
  const rows = body.map((line) => Object.fromEntries(header.map((h, i) => [h.trim(), (line[i] ?? '').trim()])));
  const result = validateRows(rows);
  if (!result.valid) {
    console.error(`Refusing ${rows.length} rows; nothing was written.`);
    result.errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
  const sql = toSql(result);
  if (flags.includes('--append')) {
    const seed = fileURLToPath(new URL('../data/vehicle-selector/seed.sql', import.meta.url));
    appendFileSync(seed, sql);
    console.log(`Appended ${result.rows.length} tray specifications and ${result.sources.length} sources to seed.sql.`);
    console.log('Now run: bash data/vehicle-selector/build-database.sh');
  } else {
    process.stdout.write(sql);
  }
}

if (process.argv[1] && process.argv[1].endsWith('load-tray-specifications.mjs')) main();
