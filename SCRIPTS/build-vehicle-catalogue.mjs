#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTrayState, isPromoted, validateCatalogueOverrides } from '../src/lib/vehicleCatalogue/derive.ts';
import { buildVariantLabels } from '../src/lib/vehicleCatalogue/label.ts';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'data/vehicle-selector/australian-slide-on-vehicles.sqlite');
const outPath = resolve(root, 'src/data/vehicle-selector/catalogue.json');
const overridesPath = resolve(root, 'src/data/vehicle-selector/overrides.json');

const QUERY = `
SELECT v.id, v.make, v.model, v.model_year_start, v.grade, v.cab_type, v.body_type,
       v.drivetrain, v.engine, v.transmission, v.wheelbase_mm,
       v.gvm_kg, v.kerb_mass_kg, v.kerb_mass_basis, v.published_payload_kg,
       v.front_gawr_kg, v.rear_gawr_kg, v.usable_load_length_mm, v.usable_load_width_mm,
       v.verification_status, v.customer_selectable,
       review.id AS latest_review_id, review.decision AS latest_review_decision,
       review.reviewed_at AS latest_reviewed_at, review.reviewer AS latest_reviewer,
       review.notes AS latest_review_notes,
       s.manufacturer, s.title, s.url, s.accessed_date
FROM vehicle_variants v JOIN sources s ON s.id = v.source_id
LEFT JOIN data_review_log review ON review.id = (
  SELECT candidate.id FROM data_review_log candidate
  WHERE candidate.variant_id = v.id
  ORDER BY candidate.reviewed_at DESC, candidate.id DESC
  LIMIT 1
)
ORDER BY v.make, v.model, v.model_year_start, v.grade;
`;

const raw = execFileSync('sqlite3', ['-json', dbPath, QUERY.trim()], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const rows = JSON.parse(raw);
const parsedOverrides = JSON.parse(readFileSync(overridesPath, 'utf8'));
const overrideValidation = validateCatalogueOverrides(parsedOverrides);
if (!overrideValidation.valid || !overrideValidation.overrides) {
  console.error('Vehicle catalogue overrides are invalid:');
  for (const error of overrideValidation.errors) console.error(`  ${error}`);
  process.exit(1);
}
const overrides = overrideValidation.overrides;

const selectableWithoutApproval = rows.filter((row) => row.customer_selectable === 1
  && (row.latest_review_id === null || row.latest_review_decision !== 'approved' || !row.latest_reviewer?.trim()));
if (selectableWithoutApproval.length) {
  throw new Error(
    `Refusing to publish: ${selectableWithoutApproval.length} customer-selectable variant(s) lack a latest approved review: `
    + selectableWithoutApproval.map((row) => row.id).join(', '),
  );
}

const reviewsWithUnboundedNotes = rows.filter((row) => row.customer_selectable === 1
  && typeof row.latest_review_notes === 'string' && row.latest_review_notes.length > 1000);
if (reviewsWithUnboundedNotes.length) {
  throw new Error(`Refusing to publish: approval notes exceed 1000 characters for ${reviewsWithUnboundedNotes.map((row) => row.id).join(', ')}.`);
}

const rowIds = new Set(rows.map((row) => row.id));
for (const entry of overrides.show) {
  if (!rowIds.has(entry.id)) throw new Error(`Show override refers to missing variant ${entry.id}.`);
}
for (const id of overrides.hide) {
  if (!rowIds.has(id)) throw new Error(`Hide override refers to missing variant ${id}.`);
}

const variants = rows
  .filter((r) => isPromoted(r, overrides))
  .map((r) => {
    const publicationOverride = overrides.show.find((entry) => entry.id === r.id);
    return {
      id: r.id,
      make: r.make,
      model: r.model,
      modelYear: r.model_year_start,
      grade: r.grade,
      cabType: r.cab_type,
      bodyType: r.body_type,
      drivetrain: r.drivetrain ?? null,
      engine: r.engine ?? null,
      transmission: r.transmission ?? null,
      wheelbaseMm: r.wheelbase_mm ?? null,
      label: '',
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
      promotedByOverride: Boolean(publicationOverride),
      publication: publicationOverride
        ? { approvalId: `override:${r.id}`, approvedAt: publicationOverride.approvedAt, method: 'override' }
        : { approvalId: `review:${r.latest_review_id}`, approvedAt: r.latest_reviewed_at, method: 'review' },
      source: { manufacturer: r.manufacturer, title: r.title, url: r.url, accessedDate: r.accessed_date },
    };
  });

// Labels are assigned across the whole set, because whether a variant needs its
// engine or wheelbase spelled out depends on the other variants beside it.
const labels = buildVariantLabels(variants);
variants.forEach((v, i) => { v.label = labels[i]; });

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
  schemaVersion: '1.1',
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
