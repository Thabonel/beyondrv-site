import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { mapWithConcurrency, selectExistingKeys } from './blob-batch';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { commitFile, getFileContent, getFileSha, githubIsConfigured } from './github-contents';
import { appendOwnerAudit } from './owner-copilot-store-utils';
import {
  buildPublishCommitMessage,
  CORRECTABLE_FIELDS,
  draftKey,
  mergeReviews,
  validateCorrectedPair,
  validateReviewEntry,
  validateReviewsFile,
  VEHICLE_REVIEW_DRAFT_STORE,
  type ReviewCorrections,
  type ReviewEntry,
} from './vehicle-review-core';
import candidateData from './vehicle-review-candidates.json';

const CAPABILITY = 'vehicles:review';
const CONCURRENCY = 12;
const REVIEWS_PATH = 'data/vehicle-selector/reviews.json';

interface CandidateRow {
  id: string;
  make: string;
  model: string;
  modelYear: number;
  grade: string;
  cabType: string;
  bodyType: string;
  gvmKg: number;
  kerbKg: number;
  trayLengthMm: number | null;
  trayWidthMm: number | null;
  verificationStatus: string;
  published: boolean;
  source: { manufacturer: string; title: string; url: string };
}

interface Draft {
  included: boolean;
  corrections: ReviewCorrections;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function parseCorrections(value: unknown): ReviewCorrections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed: ReviewCorrections = {};
  for (const [field, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!(field in CORRECTABLE_FIELDS)) continue;
    if (typeof raw === 'number' && Number.isInteger(raw)) parsed[field as keyof ReviewCorrections] = raw;
  }
  return parsed;
}

/** Source-verified rows start ticked; anything else is a deliberate act. */
function defaultIncluded(row: CandidateRow) {
  return row.verificationStatus === 'source_verified';
}

export const handler: Handler = async (event) => {
  if (!['GET', 'PUT', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, CAPABILITY)) return forbiddenResponse(CAPABILITY);
  connectBlobStore(event);

  const rows = (candidateData as { candidates: CandidateRow[] }).candidates;
  const makes = [...new Set(rows.map((row) => row.make))].sort();

  try {
    const store = getBlobStore(VEHICLE_REVIEW_DRAFT_STORE);

    if (event.httpMethod === 'PUT') {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      } catch {
        return json(400, { error: 'Invalid request.' });
      }
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id || !rows.some((row) => row.id === id)) return json(400, { error: 'Unknown vehicle variant.' });
      const draft: Draft = { included: body.included !== false, corrections: parseCorrections(body.corrections) };
      await store.setJSON(draftKey(id), draft);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'POST') {
      if (!githubIsConfigured()) {
        return json(503, { error: 'Publishing is not configured. GITHUB_TOKEN and GITHUB_REPO are required.' });
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      } catch {
        return json(400, { error: 'Invalid request.' });
      }
      const make = typeof body.make === 'string' ? body.make.trim() : '';
      const forMake = rows.filter((row) => row.make === make && !row.published);
      if (!forMake.length) return json(400, { error: 'Unknown make, or nothing left to publish for it.' });

      const { blobs } = await store.list();
      const stored = new Set(blobs.map((blob) => blob.key));
      const reviewedAt = new Date().toISOString().slice(0, 10);
      const incoming: ReviewEntry[] = [];
      const errors: string[] = [];

      for (const row of forMake) {
        const draft = stored.has(draftKey(row.id))
          ? await store.get(draftKey(row.id), { type: 'json' }) as Draft | null
          : null;
        const included = draft ? draft.included : defaultIncluded(row);
        if (!included) continue;

        const corrections = draft?.corrections && Object.keys(draft.corrections).length ? draft.corrections : undefined;
        const result = validateReviewEntry({ id: row.id, reviewer: actor.id, reviewedAt, ...(corrections ? { corrections } : {}) }, incoming.length);
        if (!result.entry) {
          errors.push(...result.errors);
          continue;
        }
        const pairErrors = validateCorrectedPair(row.id, row, result.entry.corrections);
        if (pairErrors.length) {
          errors.push(...pairErrors);
          continue;
        }
        incoming.push(result.entry);
      }

      // Publishing is all or nothing. A partial batch would leave the reviewer
      // unsure which rows went live.
      if (errors.length) return json(400, { error: `Nothing was published. ${errors.join(' ')}` });
      if (!incoming.length) return json(400, { error: 'Nothing is ticked, so there is nothing to publish.' });

      const existingRaw = await getFileContent(REVIEWS_PATH);
      let existingReviews: ReviewEntry[] = [];
      if (existingRaw) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(existingRaw);
        } catch {
          return json(500, { error: 'The published reviews file is not valid JSON, so nothing was written.' });
        }
        const validated = validateReviewsFile(parsed);
        if (!validated.valid || !validated.reviews) {
          return json(500, { error: `The published reviews file is invalid, so nothing was written. ${validated.errors.join(' ')}` });
        }
        existingReviews = validated.reviews;
      }

      const merged = mergeReviews(existingReviews, incoming);
      const sha = await getFileSha(REVIEWS_PATH);
      await commitFile(
        REVIEWS_PATH,
        `${JSON.stringify({ reviews: merged }, null, 2)}\n`,
        sha,
        buildPublishCommitMessage(actor.id, incoming.length, make),
      );

      await mapWithConcurrency(incoming, CONCURRENCY, async (entry) => {
        try {
          await store.delete(draftKey(entry.id));
        } catch {
          // A draft that outlives its publish is harmless; the row is gone from
          // the candidate list on the next build either way.
        }
        return null;
      });

      await appendOwnerAudit('vehicles_published', 'vehicle_review', make, { count: incoming.length, make }, actor);
      return json(200, { ok: true, published: incoming.length });
    }

    const make = event.queryStringParameters?.make ?? makes[0] ?? '';
    const forMake = rows.filter((row) => row.make === make && !row.published);

    const { blobs } = await store.list();
    const withDrafts = selectExistingKeys(forMake, (row) => draftKey(row.id), blobs.map((blob) => blob.key));
    const draftEntries = await mapWithConcurrency(withDrafts, CONCURRENCY, async (row) => {
      try {
        return [row.id, await store.get(draftKey(row.id), { type: 'json' }) as Draft | null] as const;
      } catch {
        return [row.id, null] as const;
      }
    });
    const drafts = new Map(draftEntries);

    const candidates = forMake.map((row) => {
      const draft = drafts.get(row.id) ?? null;
      return {
        ...row,
        included: draft ? draft.included : defaultIncluded(row),
        corrections: draft?.corrections ?? {},
      };
    });

    return json(200, { make, makes, candidates });
  } catch (error) {
    console.warn('admin-vehicle-review: unavailable', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
