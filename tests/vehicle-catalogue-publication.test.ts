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
