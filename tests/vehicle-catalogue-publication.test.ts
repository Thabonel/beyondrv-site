import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { isPromoted, validateCatalogueOverrides } from '../src/lib/vehicleCatalogue/derive.ts';
import { parseVehicleCatalogue } from '../src/lib/vehicleCatalogue/validate.ts';
import { validateReviewsFile } from '../netlify/functions/vehicle-review-core.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const database = fileURLToPath(new URL('../data/vehicle-selector/australian-slide-on-vehicles.sqlite', import.meta.url));
const cataloguePath = fileURLToPath(new URL('../src/data/vehicle-selector/catalogue.json', import.meta.url));
const overridesPath = fileURLToPath(new URL('../src/data/vehicle-selector/overrides.json', import.meta.url));
const reviewsPath = fileURLToPath(new URL('../data/vehicle-selector/reviews.json', import.meta.url));

const publicationQuery = `
SELECT v.id, v.customer_selectable,
       review.id AS latest_review_id, review.decision AS latest_review_decision
FROM vehicle_variants v
LEFT JOIN data_review_log review ON review.id = (
  SELECT candidate.id FROM data_review_log candidate
  WHERE candidate.variant_id = v.id
  ORDER BY candidate.reviewed_at DESC, candidate.id DESC
  LIMIT 1
)
ORDER BY v.id;
`;

// Trucks publish from their own table through the same gate. A chassis with no
// mass cannot produce a reconciling payload, so the build skips it and this
// check has to skip it too, or the two disagree about what should be live.
const truckPublicationQuery = `
SELECT t.id, t.customer_selectable,
       review.id AS latest_review_id, review.decision AS latest_review_decision
FROM heavy_overland_chassis t
LEFT JOIN data_review_log review ON review.id = (
  SELECT candidate.id FROM data_review_log candidate
  WHERE candidate.variant_id = t.id
  ORDER BY candidate.reviewed_at DESC, candidate.id DESC
  LIMIT 1
)
WHERE t.chassis_cab_total_mass_kg IS NOT NULL
ORDER BY t.id;
`;

test('the committed public catalogue exactly matches attributable publication decisions', () => {
  const catalogue = parseVehicleCatalogue(JSON.parse(readFileSync(cataloguePath, 'utf8')) as unknown);
  const overrideResult = validateCatalogueOverrides(JSON.parse(readFileSync(overridesPath, 'utf8')) as unknown);
  assert.equal(overrideResult.valid, true, overrideResult.errors.join('\n'));
  assert.ok(overrideResult.overrides);
  const overrides = overrideResult.overrides;
  const reviewResult = validateReviewsFile(JSON.parse(readFileSync(reviewsPath, 'utf8')) as unknown);
  assert.equal(reviewResult.valid, true, reviewResult.errors.join('\n'));
  const reviewedIds = new Set(reviewResult.reviews?.map((review) => review.id));

  const readRows = (query: string) => {
    const out = execFileSync('sqlite3', ['-json', database, query], { cwd: root, encoding: 'utf8' });
    return out.trim() ? JSON.parse(out) : [];
  };
  const rows = [...readRows(publicationQuery), ...readRows(truckPublicationQuery)] as Array<{
    id: string;
    customer_selectable: number;
    latest_review_id: number | null;
    latest_review_decision: string | null;
  }>;

  const expected = rows.filter((row) => isPromoted(row, overrides, reviewedIds)).map((row) => row.id).sort();
  const published = catalogue.variants.map((variant) => variant.id).sort();
  assert.deepEqual(published, expected);
});

// The review screen filters on this flag. When it tracked reviews.json alone it
// counted only one of the publication routes, so every variant published by
// override reported false and the screen offered all 161 live vehicles back to
// the reviewer.
test('the review candidate list agrees with the catalogue about what is published', () => {
  const candidatesPath = fileURLToPath(new URL('../netlify/functions/vehicle-review-candidates.json', import.meta.url));
  const { candidates } = JSON.parse(readFileSync(candidatesPath, 'utf8')) as {
    candidates: Array<{ id: string; published: boolean }>;
  };
  const catalogue = parseVehicleCatalogue(JSON.parse(readFileSync(cataloguePath, 'utf8')));
  const live = new Set(catalogue.variants.map((variant) => variant.id));

  const disagreements = candidates
    .filter((candidate) => candidate.published !== live.has(candidate.id))
    .map((candidate) => `${candidate.id}: published=${candidate.published}, live=${live.has(candidate.id)}`);
  assert.deepEqual(disagreements, [], disagreements.join('\n'));

  // A control: the flag has to discriminate. All true or all false would satisfy
  // the comparison above only if the catalogue were empty or held every row.
  const published = candidates.filter((candidate) => candidate.published).length;
  assert.ok(published > 0, 'no candidate is marked published');
  assert.ok(published < candidates.length, 'every candidate is marked published, so the flag says nothing');
});
