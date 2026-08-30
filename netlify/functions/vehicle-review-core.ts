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

export type CorrectableField = keyof typeof CORRECTABLE_FIELDS;
export type ReviewCorrections = Partial<Record<CorrectableField, number>>;

export interface ReviewEntry {
  id: string;
  reviewer: string;
  reviewedAt: string;
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

export function validateReviewEntry(value: unknown, index: number): { errors: string[]; entry?: ReviewEntry } {
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
        const bounds = CORRECTABLE_FIELDS[field as CorrectableField];
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

  if (errors.length) return { errors };
  return { errors: [], entry: corrections ? { id, reviewer, reviewedAt, corrections } : { id, reviewer, reviewedAt } };
}
