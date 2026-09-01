/**
 * Review decisions are written by an admin endpoint and read again by the build.
 * Both sides validate, so a file edited by hand cannot publish a figure the
 * endpoint would have refused.
 */

export const CORRECTABLE_FIELDS = {
  gvmKg: { min: 1500, max: 8000 },
  kerbKg: { min: 1000, max: 6000 },
  trayLengthMm: { min: 1200, max: 4000 },
  trayWidthMm: { min: 1200, max: 2500 },
} as const;

/**
 * A heavy chassis is a different size of thing. A MAN TGM is 13,000 kg GVM and
 * an IVECO Eurocargo 15,000 kg, so ute bounds make a real truck figure
 * uncorrectable. Keeping the two sets apart means widening one does not
 * quietly let a 13 tonne GVM through on a Ranger.
 */
export const TRUCK_CORRECTABLE_FIELDS = {
  gvmKg: { min: 4500, max: 30000 },
  kerbKg: { min: 2000, max: 20000 },
  trayLengthMm: { min: 1200, max: 9000 },
  trayWidthMm: { min: 1200, max: 3000 },
} as const;

export type CorrectableField = keyof typeof CORRECTABLE_FIELDS;
export type CorrectionPlatform = 'ute' | 'truck';

export function boundsFor(platform: CorrectionPlatform = 'ute') {
  return platform === 'truck' ? TRUCK_CORRECTABLE_FIELDS : CORRECTABLE_FIELDS;
}
export type ReviewCorrections = Partial<Record<CorrectableField, number>>;

export interface ReviewEntry {
  id: string;
  reviewer: string;
  reviewedAt: string;
  /**
   * Recorded only for a truck. The bounds a correction was accepted against
   * have to travel with the entry, or reading the file back applies ute bounds
   * and rejects a figure that was just committed.
   */
  platform?: CorrectionPlatform;
  corrections?: ReviewCorrections;
}

const MAX_ID = 240;
const MAX_REVIEWER = 120;

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateReviewEntry(
  value: unknown,
  index: number,
  platform?: CorrectionPlatform,
): { errors: string[]; entry?: ReviewEntry } {
  const record0 = (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, unknown> : {};
  // A caller that knows the platform wins. Otherwise take it from the entry,
  // which is how a committed review carries its own bounds back.
  const resolvedPlatform: CorrectionPlatform = platform
    ?? (record0.platform === 'truck' ? 'truck' : 'ute');
  const fieldBounds = boundsFor(resolvedPlatform);
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { errors: [`reviews[${index}] must be an object.`] };
  }

  const record = value as Record<string, unknown>;
  const id = trimmed(record.id);
  const reviewer = trimmed(record.reviewer);
  const reviewedAt = trimmed(record.reviewedAt);

  if (!id) errors.push(`reviews[${index}].id is required.`);
  else if (id.length > MAX_ID) errors.push(`reviews[${index}].id must be at most ${MAX_ID} characters.`);
  if (!reviewer) errors.push(`reviews[${index}].reviewer is required.`);
  else if (reviewer.length > MAX_REVIEWER) errors.push(`reviews[${index}].reviewer must be at most ${MAX_REVIEWER} characters.`);
  if (!isIsoDate(reviewedAt)) errors.push(`reviews[${index}].reviewedAt must be a real YYYY-MM-DD date.`);

  let corrections: ReviewCorrections | undefined;
  if (record.corrections !== undefined) {
    if (!record.corrections || typeof record.corrections !== 'object' || Array.isArray(record.corrections)) {
      errors.push(`reviews[${index}].corrections must be an object.`);
    } else {
      const parsed: ReviewCorrections = {};
      for (const [field, raw] of Object.entries(record.corrections as Record<string, unknown>)) {
        const bounds = fieldBounds[field as CorrectableField];
        if (!bounds) {
          errors.push(`reviews[${index}].corrections.${field} is not a correctable field.`);
          continue;
        }
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          errors.push(`reviews[${index}].corrections.${field} must be a number.`);
          continue;
        }
        if (!Number.isInteger(raw)) {
          errors.push(`reviews[${index}].corrections.${field} must be a whole number.`);
          continue;
        }
        if (raw < bounds.min || raw > bounds.max) {
          errors.push(`reviews[${index}].corrections.${field} must be between ${bounds.min} and ${bounds.max}.`);
          continue;
        }
        parsed[field as CorrectableField] = raw;
      }
      if (Object.keys(parsed).length > 0) corrections = parsed;
    }
  }

  if (record0.platform !== undefined && record0.platform !== 'ute' && record0.platform !== 'truck') {
    errors.push(`reviews[${index}].platform must be ute or truck.`);
  }

  if (errors.length) return { errors };
  const base: ReviewEntry = { id, reviewer, reviewedAt };
  // Only a truck needs to say so; a ute is the default everywhere.
  if (resolvedPlatform === 'truck') base.platform = 'truck';
  return { errors: [], entry: corrections ? { ...base, corrections } : base };
}

export function validateReviewsFile(value: unknown): { valid: boolean; errors: string[]; reviews?: ReviewEntry[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Vehicle reviews must be an object.'] };
  }
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.reviews)) {
    return { valid: false, errors: ['Vehicle reviews must include a reviews array.'] };
  }

  const errors: string[] = [];
  const reviews: ReviewEntry[] = [];
  const seen = new Set<string>();

  for (const [index, item] of candidate.reviews.entries()) {
    const result = validateReviewEntry(item, index);
    errors.push(...result.errors);
    if (!result.entry) continue;
    if (seen.has(result.entry.id)) {
      errors.push(`reviews[${index}].id is a duplicate of an earlier entry.`);
      continue;
    }
    seen.add(result.entry.id);
    reviews.push(result.entry);
  }

  if (errors.length) return { valid: false, errors };
  return { valid: true, errors: [], reviews };
}

/**
 * Later decisions win. Sorting by id keeps the committed file's diff readable,
 * so a reviewer can see what one publish actually changed.
 */
export function mergeReviews(existing: ReviewEntry[], incoming: ReviewEntry[]): ReviewEntry[] {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Keeps only the corrections that actually change something.
 *
 * A reviewer who types over a figure and puts the original back has corrected
 * nothing, and recording it would have the provenance panel tell customers a
 * manufacturer figure is not the manufacturer's.
 */
export function dropNoOpCorrections(
  row: Record<string, unknown>,
  corrections: ReviewCorrections | undefined,
): ReviewCorrections {
  if (!corrections) return {};
  const kept: ReviewCorrections = {};
  for (const [field, value] of Object.entries(corrections)) {
    if (row[field] === value) continue;
    kept[field as CorrectableField] = value;
  }
  return kept;
}

export function applyCorrections<T extends Record<string, unknown>>(
  row: T,
  entry: ReviewEntry | undefined,
): { row: T; correctedFields: CorrectableField[] } {
  const corrections = dropNoOpCorrections(row, entry?.corrections);
  const fields = Object.keys(corrections) as CorrectableField[];
  if (fields.length === 0) return { row, correctedFields: [] };
  const corrected = { ...row } as Record<string, unknown>;
  for (const [field, value] of Object.entries(corrections)) corrected[field] = value;
  return { row: corrected as T, correctedFields: fields.sort() };
}

/**
 * A correction can touch one mass and not the other, so the pair only makes
 * sense judged against the row it applies to. A kerb mass at or above GVM would
 * publish a vehicle with no payload at all.
 */
export function validateCorrectedPair(
  id: string,
  row: { gvmKg: number; kerbKg: number },
  corrections: ReviewCorrections | undefined,
): string[] {
  const gvmKg = corrections?.gvmKg ?? row.gvmKg;
  const kerbKg = corrections?.kerbKg ?? row.kerbKg;
  if (kerbKg >= gvmKg) {
    return [`${id}: kerb mass ${kerbKg} kg is not below GVM ${gvmKg} kg.`];
  }
  return [];
}

export const VEHICLE_REVIEW_DRAFT_STORE = 'vehicle-review-drafts';

export function draftKey(variantId: string) {
  return `vehicle-review/${encodeURIComponent(variantId)}.json`;
}

export function buildPublishCommitMessage(reviewer: string, count: number, make: string): string {
  const noun = count === 1 ? 'vehicle' : 'vehicles';
  return `data: publish ${count} ${make} ${noun} reviewed by ${reviewer}`;
}
