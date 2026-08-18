#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTrayState, isPromoted } from '../src/lib/vehicleCatalogue/derive.ts';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'data/vehicle-selector/australian-slide-on-vehicles.sqlite');
const outPath = resolve(root, 'src/data/vehicle-selector/catalogue.json');
const overridesPath = resolve(root, 'src/data/vehicle-selector/overrides.json');

const QUERY = `
SELECT v.id, v.make, v.model, v.model_year_start, v.grade, v.cab_type, v.body_type,
       v.drivetrain, v.gvm_kg, v.kerb_mass_kg, v.kerb_mass_basis, v.published_payload_kg,
       v.front_gawr_kg, v.rear_gawr_kg, v.usable_load_length_mm, v.usable_load_width_mm,
       v.verification_status,
       s.manufacturer, s.title, s.url, s.accessed_date
FROM vehicle_variants v JOIN sources s ON s.id = v.source_id
ORDER BY v.make, v.model, v.model_year_start, v.grade;
`;

const raw = execFileSync('sqlite3', ['-json', dbPath, QUERY.trim()], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const rows = JSON.parse(raw);
const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'));

const variants = rows
  .filter((r) => isPromoted(r, overrides))
  .map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    modelYear: r.model_year_start,
    grade: r.grade,
    cabType: r.cab_type,
    bodyType: r.body_type,
    drivetrain: r.drivetrain ?? null,
    label: [r.make, r.model, r.grade, r.cab_type.replace(/_/g, ' '), r.drivetrain, `(${r.model_year_start})`]
      .filter(Boolean).join(' '),
    gvmKg: r.gvm_kg,
    kerbKg: r.kerb_mass_kg,
    kerbBasis: r.kerb_mass_basis ?? '',
    payloadKg: r.published_payload_kg,
    frontGawrKg: r.front_gawr_kg ?? null,
    rearGawrKg: r.rear_gawr_kg ?? null,
    trayLengthMm: r.usable_load_length_mm ?? null,
    trayWidthMm: r.usable_load_width_mm ?? null,
    trayState: deriveTrayState(r.kerb_mass_basis, r.body_type),
    trayMassKg: null,
    promotedByOverride: overrides.show.includes(r.id) && r.verification_status !== 'source_verified',
    source: { manufacturer: r.manufacturer, title: r.title, url: r.url, accessedDate: r.accessed_date },
  }));

const modelMap = new Map();
for (const v of variants) {
  const key = `${v.make}|${v.model}`;
  if (!modelMap.has(key)) modelMap.set(key, { make: v.make, model: v.model, modelYears: new Set() });
  modelMap.get(key).modelYears.add(v.modelYear);
}
const models = [...modelMap.values()]
  .map((m) => ({ ...m, modelYears: [...m.modelYears].sort((a, b) => b - a) }))
  .sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model));

const catalogue = {
  schemaVersion: '1.0',
  catalogueVersion: `vehicle-catalogue-${new Date().toISOString().slice(0, 10)}`,
  generatedAt: new Date().toISOString(),
  sourceDatabaseRowCount: rows.length,
  models,
  variants,
};

const validation = validateVehicleCatalogue(catalogue);
if (!validation.valid) {
  console.error('Vehicle catalogue is invalid:');
  for (const e of validation.errors) console.error(`  ${e}`);
  process.exit(1);
}
for (const w of validation.warnings) console.warn(`Warning: ${w}`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(`${variants.length} variants across ${models.length} models, from ${rows.length} database rows.`);
