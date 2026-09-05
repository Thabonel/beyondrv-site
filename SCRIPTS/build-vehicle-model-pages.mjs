#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTrayState } from '../src/lib/vehicleCatalogue/derive.ts';
import { payload } from '../src/lib/vehicleModelPages/fitment.ts';
import { validateModelPages } from '../src/lib/vehicleModelPages/validate.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? resolve(root, fallback) : resolve(process.argv[i + 1]); };
const db = option('--db', 'data/vehicle-selector/australian-slide-on-vehicles.sqlite');
const out = option('--out', 'src/data/vehicle-selector/model-pages.json');
const aliases = JSON.parse(readFileSync(option('--aliases', 'src/data/vehicle-selector/model-page-aliases.json'), 'utf8'));
const query = sql => JSON.parse(execFileSync('sqlite3', ['-json', db, sql], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }) || '[]');
// Read the CSV directly: it is the hand-maintained coverage register, not a name join.
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell.replace(/\r$/, '')); cell = ''; if (c === '\n') { rows.push(row); row = []; } }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}
const coverage = new Map(parseCsv(readFileSync(resolve(root, 'data/vehicle-selector/model-coverage.csv'), 'utf8')).map(r => [r.id, r]));
const sources = new Map(query('SELECT * FROM sources ORDER BY id').map(s => [s.id, { id: s.id, manufacturer: s.manufacturer, title: s.title, url: s.url, accessedDate: s.accessed_date, notes: s.notes }]));
const rows = [...query('SELECT * FROM vehicle_variants ORDER BY id').map(r => ({ ...r, kind: 'light' })), ...query('SELECT * FROM heavy_overland_chassis ORDER BY id').map(r => ({ ...r, kind: 'heavy' }))];
const models = new Map();
for (const r of rows) {
  const slug = `${r.make}-${r.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const coverageId = aliases[slug] ?? slug;
  const entry = coverage.get(coverageId);
  if (!entry) throw new Error(`Unresolved coverage for ${slug} (${coverageId})`);
  if (!sources.has(r.source_id)) throw new Error(`Missing source ${r.source_id} for ${r.id}`);
  if (!models.has(slug)) models.set(slug, { slug, make: r.make, model: r.model, coverageId, platform: entry.platform_category, fitmentMode: entry.fitment_mode, modelYears: [], variants: [], sources: [] });
  const m = models.get(slug), heavy = r.kind === 'heavy';
  const kerb = heavy ? r.chassis_cab_total_mass_kg : r.kerb_mass_kg;
  const published = heavy ? r.published_body_payload_kg : r.published_payload_kg;
  const derived = payload(r.gvm_kg, kerb, published);
  const basis = (heavy ? r.mass_basis : r.kerb_mass_basis) ?? '';
  m.variants.push({
    id: r.id, kind: r.kind, modelYear: r.model_year_start, modelYearEnd: r.model_year_end,
    grade: heavy ? r.variant : r.grade, cabType: r.cab_type, drivetrain: r.drivetrain,
    gvmKg: r.gvm_kg, gcmKg: r.gcm_kg, kerbKg: kerb, kerbBasis: basis, payloadKg: published,
    calculatedPayloadKg: derived.calculated, payloadArithmeticMatches: derived.matches,
    frontGawrKg: heavy ? r.front_axle_limit_kg : r.front_gawr_kg, rearGawrKg: heavy ? r.rear_axle_limit_kg : r.rear_gawr_kg,
    trayState: deriveTrayState(basis, heavy ? 'chassis_cab' : r.body_type),
    trayLengthMm: heavy ? null : r.usable_load_length_mm, trayWidthMm: heavy ? null : r.usable_load_width_mm,
    brakedTowingKg: r.braked_towing_kg, sourceId: r.source_id, sourceLocator: r.source_locator, verificationStatus: r.verification_status, notes: r.notes,
    ...(heavy ? { publishedBodyPayloadKg: published, chassisCabTotalMassKg: kerb, chassisCabFrontMassKg: r.chassis_cab_front_mass_kg, chassisCabRearMassKg: r.chassis_cab_rear_mass_kg, mountingArchitectureNote: r.mounting_architecture_note, maxBodyLengthMm: r.max_body_length_mm, maxBodyWidthMm: r.max_body_width_mm } : { bodyType: r.body_type, publishedPayloadKg: published }),
  });
  for (const year of [r.model_year_start, r.model_year_end]) if (year !== null && !m.modelYears.includes(year)) m.modelYears.push(year);
  if (!m.sources.some(s => s.id === r.source_id)) m.sources.push(sources.get(r.source_id));
}
for (const m of models.values()) {
  m.modelYears.sort((a, b) => a - b);
  m.variants.sort((a, b) => (b.calculatedPayloadKg ?? b.payloadKg ?? -Infinity) - (a.calculatedPayloadKg ?? a.payloadKg ?? -Infinity) || a.id.localeCompare(b.id));
  m.sources.sort((a, b) => a.id.localeCompare(b.id));
}
const data = { schemaVersion: '1.0', generatedAt: new Date().toISOString(), sourceDatabaseRowCount: rows.length, models: [...models.values()].sort((a, b) => a.slug.localeCompare(b.slug)) };
const errors = validateModelPages(data);
if (errors.length) throw new Error(errors.join('\n'));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`Wrote ${data.models.length} models and ${rows.length} variants to ${out}`);
