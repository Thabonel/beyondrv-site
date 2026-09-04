#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveTrayState, isPromoted, validateCatalogueOverrides } from '../src/lib/vehicleCatalogue/derive.ts';
import { buildVariantLabels } from '../src/lib/vehicleCatalogue/label.ts';
import { validateVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';
import { applyCorrections, validateReviewsFile } from '../netlify/functions/vehicle-review-core.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'data/vehicle-selector/australian-slide-on-vehicles.sqlite');
const outPath = resolve(root, 'src/data/vehicle-selector/catalogue.json');
const variantIndexPath = resolve(root, 'netlify/functions/vehicle-variant-index.json');
const overridesPath = resolve(root, 'src/data/vehicle-selector/overrides.json');
const reviewsPath = resolve(root, 'data/vehicle-selector/reviews.json');
const candidatesPath = resolve(root, 'netlify/functions/vehicle-review-candidates.json');

const QUERY = `
SELECT v.id, v.make, v.model, v.model_year_start, v.grade, v.cab_type, v.body_type,
       v.drivetrain, v.engine, v.transmission, v.wheelbase_mm,
       v.gvm_kg, v.kerb_mass_kg, v.kerb_mass_basis, v.published_payload_kg,
       v.front_gawr_kg, v.rear_gawr_kg, v.usable_load_length_mm, v.usable_load_width_mm,
       v.verification_status, v.customer_selectable, v.notes,
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

const TRUCK_QUERY = `
SELECT t.id, t.make, t.model, t.model_year_start, t.variant AS grade, t.cab_type, t.axle_configuration,
       t.drivetrain, t.engine, t.transmission, t.wheelbase_mm,
       t.gvm_kg, t.chassis_cab_total_mass_kg, t.mass_basis,
       t.front_axle_limit_kg, t.rear_axle_limit_kg, t.max_body_length_mm,
       t.verification_status, t.customer_selectable,
       review.id AS latest_review_id, review.decision AS latest_review_decision,
       review.reviewed_at AS latest_reviewed_at, review.reviewer AS latest_reviewer,
       s.manufacturer, s.title, s.url, s.accessed_date
FROM heavy_overland_chassis t JOIN sources s ON s.id = t.source_id
LEFT JOIN data_review_log review ON review.id = (
  SELECT candidate.id FROM data_review_log candidate
  WHERE candidate.variant_id = t.id
  ORDER BY candidate.reviewed_at DESC, candidate.id DESC
  LIMIT 1
)
ORDER BY t.make, t.model, t.variant;
`;

const raw = execFileSync('sqlite3', ['-json', dbPath, QUERY.trim()], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const rows = JSON.parse(raw);

const truckRaw = execFileSync('sqlite3', ['-json', dbPath, TRUCK_QUERY.trim()], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const allTrucks = truckRaw.trim() ? JSON.parse(truckRaw) : [];

// Payload has to reconcile, and it cannot without a chassis mass. A row that
// nobody selected is simply not ready; one that somebody selected is a mistake
// worth stopping the build for.
const unusableTrucks = allTrucks.filter((t) => t.chassis_cab_total_mass_kg === null || t.model_year_start === null);
const selectedButUnusable = unusableTrucks.filter((t) => t.customer_selectable === 1);
function unusableReason(t) {
  if (t.chassis_cab_total_mass_kg === null) return 'no chassis mass recorded, so it cannot produce a reconciling payload';
  return 'no model year recorded, and the catalogue requires an integer year';
}
if (selectedButUnusable.length) {
  throw new Error(
    `Refusing to publish ${selectedButUnusable.length} selected chassis: `
    + selectedButUnusable.map((t) => `${t.id} (${unusableReason(t)})`).join(', '),
  );
}
for (const t of unusableTrucks) {
  console.warn(`Skipping ${t.id}: ${unusableReason(t)}.`);
}

const unusableIds = new Set(unusableTrucks.map((t) => t.id));
const truckRows = allTrucks.filter((t) => !unusableIds.has(t.id)).map((t) => {
  return {
    ...t,
    body_type: 'cab_chassis',
    kerb_mass_kg: t.chassis_cab_total_mass_kg,
    // A cab chassis carries no body until one is fitted, whatever the mass
    // basis wording happens to be.
    kerb_mass_basis: `${String(t.mass_basis).replace(/[.\s]+$/, '')}. Excludes any body or tray.`,
    published_payload_kg: t.gvm_kg - t.chassis_cab_total_mass_kg,
    front_gawr_kg: t.front_axle_limit_kg,
    rear_gawr_kg: t.rear_axle_limit_kg,
    usable_load_length_mm: null,
    usable_load_width_mm: null,
    platform: 'truck',
  };
});
rows.push(...truckRows);
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

const reviewValidation = validateReviewsFile(JSON.parse(readFileSync(reviewsPath, 'utf8')));
if (!reviewValidation.valid || !reviewValidation.reviews) {
  console.error('Vehicle reviews are invalid:');
  for (const error of reviewValidation.errors) console.error(`  ${error}`);
  process.exit(1);
}
const reviewsById = new Map(reviewValidation.reviews.map((entry) => [entry.id, entry]));
const reviewedIds = new Set(reviewsById.keys());

const rowIds = new Set(rows.map((row) => row.id));
for (const id of reviewedIds) {
  if (!rowIds.has(id)) throw new Error(`Review refers to missing variant ${id}.`);
}
for (const entry of overrides.show) {
  if (!rowIds.has(entry.id)) throw new Error(`Show override refers to missing variant ${entry.id}.`);
}
for (const id of overrides.hide) {
  if (!rowIds.has(id)) throw new Error(`Hide override refers to missing variant ${id}.`);
}

const variants = rows
  .filter((r) => isPromoted(r, overrides, reviewedIds))
  .map((r) => {
    const publicationOverride = overrides.show.find((entry) => entry.id === r.id);
    const reviewEntry = reviewsById.get(r.id);
    const { row: corrected, correctedFields } = applyCorrections(
      {
        gvmKg: r.gvm_kg,
        kerbKg: r.kerb_mass_kg,
        trayLengthMm: r.usable_load_length_mm ?? null,
        trayWidthMm: r.usable_load_width_mm ?? null,
      },
      reviewEntry,
    );
    // A corrected pair that inverts would publish a vehicle with no payload.
    if (corrected.kerbKg >= corrected.gvmKg) {
      throw new Error(`Refusing to publish ${r.id}: kerb mass ${corrected.kerbKg} is not below GVM ${corrected.gvmKg}.`);
    }
    // Payload is GVM minus kerb, and the catalogue validator enforces that.
    // Correcting either mass therefore carries the payload with it, and the
    // derived figure is disclosed as corrected rather than as published.
    const massCorrected = correctedFields.includes('gvmKg') || correctedFields.includes('kerbKg');
    const payloadKg = massCorrected ? corrected.gvmKg - corrected.kerbKg : r.published_payload_kg;
    const disclosedCorrections = [...new Set([
      ...correctedFields,
      ...(massCorrected ? ['payloadKg'] : []),
      ...(publicationOverride?.correctedFields ?? []),
    ])].sort();
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
      gvmKg: corrected.gvmKg,
      kerbKg: corrected.kerbKg,
      kerbBasis: r.kerb_mass_basis ?? '',
      payloadKg,
      frontGawrKg: r.front_gawr_kg ?? null,
      rearGawrKg: r.rear_gawr_kg ?? null,
      trayLengthMm: corrected.trayLengthMm,
      trayWidthMm: corrected.trayWidthMm,
      correctedFields: disclosedCorrections,
      platform: r.platform ?? 'ute',
      // The research note is where an optimistic kerb was recorded. Surfacing
      // it as a field means the page never has to read prose.
      kerbIsOptimistic: !correctedFields.includes('kerbKg') && /OPTIMISTIC KERB/i.test(r.notes ?? ''),
      maxBodyLengthMm: r.max_body_length_mm ?? null,
      trayState: deriveTrayState(r.kerb_mass_basis, r.body_type),
      trayMassKg: null,
      promotedByOverride: Boolean(publicationOverride),
      publication: publicationOverride
        ? { approvalId: `override:${r.id}`, approvedAt: publicationOverride.approvedAt, method: 'override' }
        : reviewEntry
          ? { approvalId: `review:overlay:${r.id}`, approvedAt: reviewEntry.reviewedAt, method: 'review', reviewer: reviewEntry.reviewer }
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

// Netlify functions import JSON only from beside themselves, so the tray-size
// endpoint gets a slim copy of just the fields it validates against.
const variantIndex = { variants: variants.map((v) => ({ id: v.id, bodyType: v.bodyType, label: v.label })) };
writeFileSync(variantIndexPath, `${JSON.stringify(variantIndex, null, 2)}\n`);
console.log(`Wrote ${variantIndexPath}`);
console.log(`Wrote ${outPath}`);
console.log(`${variants.length} variants across ${models.length} models, from ${rows.length} database rows.`);

// The catalogue holds only promoted variants, so the review screen needs the
// full set to choose from, published or not.
//
// Published means live for a customer, whichever route promoted it: an override,
// a review, or customer_selectable with an approved review. The catalogue is
// exactly that set. Reading reviewedIds alone counted only the review route, so
// every variant published by override reported published: false and the screen
// offered all 161 live vehicles back to the reviewer.
const publishedIds = new Set(variants.map((v) => v.id));
const candidates = rows.map((r) => ({
  id: r.id,
  make: r.make,
  model: r.model,
  modelYear: r.model_year_start,
  grade: r.grade,
  cabType: r.cab_type,
  bodyType: r.body_type,
  gvmKg: r.gvm_kg,
  kerbKg: r.kerb_mass_kg,
  trayLengthMm: r.usable_load_length_mm ?? null,
  trayWidthMm: r.usable_load_width_mm ?? null,
  verificationStatus: r.verification_status,
  platform: r.platform ?? 'ute',
  published: publishedIds.has(r.id),
  source: { manufacturer: r.manufacturer, title: r.title, url: r.url },
}));
writeFileSync(candidatesPath, `${JSON.stringify({ candidates }, null, 2)}\n`);
console.log(`Wrote ${candidatesPath} with ${candidates.length} candidates.`);
