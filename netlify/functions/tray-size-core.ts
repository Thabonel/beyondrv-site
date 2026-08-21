export const TRAY_SIZE_STORE = 'vehicle-tray-sizes';

/**
 * A cab chassis ships without a tray, so these bounds come from what people
 * actually fit rather than a manufacturer figure. Recorded manufacturer
 * dimensions span 1300-2630 long and 1270-1895 wide; the wider range leaves
 * room for a genuine aftermarket tray while rejecting a mistyped 18000 or 18.
 */
export const TRAY_LENGTH_MIN_MM = 1200;
export const TRAY_LENGTH_MAX_MM = 4000;
export const TRAY_WIDTH_MIN_MM = 1200;
export const TRAY_WIDTH_MAX_MM = 2500;

/**
 * Nobody measures a tray to the millimetre, and without rounding 2100 and 2103
 * are different sizes that each accumulate an unconvincing count. Rounding also
 * bounds the record: the accepted ranges hold 3.64 million distinct millimetre
 * pairs but only 36,400 rounded ones.
 */
export const TRAY_SIZE_STEP_MM = 10;

/** A vehicle with more than this many genuinely different trays is noise. */
export const MAX_TRAY_SIZE_BUCKETS = 20;

export interface TraySizeBucket {
  lengthMm: number;
  widthMm: number;
  reports: number;
  firstReportedAt: string;
  lastReportedAt: string;
}

export interface TraySizeRecord {
  variantId: string;
  sizes: TraySizeBucket[];
  totalReports: number;
  updatedAt: string;
}

export function traySizeKey(variantId: string) {
  return `tray-sizes/${encodeURIComponent(variantId)}.json`;
}

export function quantiseTrayDimension(value: number) {
  return Math.round(value / TRAY_SIZE_STEP_MM) * TRAY_SIZE_STEP_MM;
}

function whole(value: unknown) {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

export function validateTraySize(lengthMm: unknown, widthMm: unknown):
  | { ok: true; lengthMm: number; widthMm: number }
  | { ok: false; error: string } {
  const length = whole(lengthMm);
  const width = whole(widthMm);
  if (length === null || width === null) {
    return { ok: false, error: 'Enter the tray length and width in whole millimetres.' };
  }
  if (length < TRAY_LENGTH_MIN_MM || length > TRAY_LENGTH_MAX_MM) {
    return { ok: false, error: `Tray length must be between ${TRAY_LENGTH_MIN_MM} and ${TRAY_LENGTH_MAX_MM} mm.` };
  }
  if (width < TRAY_WIDTH_MIN_MM || width > TRAY_WIDTH_MAX_MM) {
    return { ok: false, error: `Tray width must be between ${TRAY_WIDTH_MIN_MM} and ${TRAY_WIDTH_MAX_MM} mm.` };
  }
  return { ok: true, lengthMm: length, widthMm: width };
}

export function addTraySizeReport(
  existing: TraySizeRecord | null,
  variantId: string,
  lengthMm: number,
  widthMm: number,
  now: string,
): TraySizeRecord {
  const length = quantiseTrayDimension(lengthMm);
  const width = quantiseTrayDimension(widthMm);

  const sizes = (existing?.sizes ?? []).map((size) => ({ ...size }));
  const match = sizes.find((size) => size.lengthMm === length && size.widthMm === width);

  if (match) {
    match.reports += 1;
    match.lastReportedAt = now;
  } else {
    sizes.push({ lengthMm: length, widthMm: width, reports: 1, firstReportedAt: now, lastReportedAt: now });
  }

  // Evict the least reported, so a flood of one-off sizes cannot push out a
  // size many owners have confirmed, nor grow the record without limit.
  const kept = sizes
    .sort((a, b) => b.reports - a.reports || b.lastReportedAt.localeCompare(a.lastReportedAt))
    .slice(0, MAX_TRAY_SIZE_BUCKETS);

  return {
    variantId,
    sizes: kept,
    totalReports: kept.reduce((sum, size) => sum + size.reports, 0),
    updatedAt: now,
  };
}

/**
 * Most reported wins. Ties break on the most recent report, then the longer
 * tray, so two customers on the same vehicle always see the same suggestion.
 */
export function winningTraySize(record: TraySizeRecord | null) {
  const sizes = record?.sizes ?? [];
  if (sizes.length === 0) return null;

  const best = [...sizes].sort((a, b) =>
    b.reports - a.reports
    || b.lastReportedAt.localeCompare(a.lastReportedAt)
    || b.lengthMm - a.lengthMm)[0];

  return { lengthMm: best.lengthMm, widthMm: best.widthMm, reports: best.reports };
}

export function removeTraySize(record: TraySizeRecord, lengthMm: number, widthMm: number, now: string): TraySizeRecord {
  const sizes = record.sizes.filter((size) => !(size.lengthMm === lengthMm && size.widthMm === widthMm));
  return {
    ...record,
    sizes,
    totalReports: sizes.reduce((sum, size) => sum + size.reports, 0),
    updatedAt: now,
  };
}

/** Enough attempts to survive ordinary contention without spinning. */
export const MAX_WRITE_ATTEMPTS = 5;

/**
 * The request rules, kept here rather than in the handler so they can be tested
 * without constructing a Netlify event. Every tested module in this directory
 * is self-contained for the same reason.
 */
export function acceptTraySizeSubmission(
  body: unknown,
  isCabChassis: (id: string) => boolean,
): { ok: true; variantId: string; lengthMm: number; widthMm: number } | { ok: false; error: string } {
  // JSON.parse('null') succeeds, so a try/catch around the parse does not make
  // the value safe to read. Anything that is not a plain object is a client
  // error, and must not surface as a server fault.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request' };
  }
  const fields = body as Record<string, unknown>;
  const variantId = typeof fields.variantId === 'string' ? fields.variantId.trim() : '';
  if (!variantId) return { ok: false, error: 'Choose your vehicle before reporting a tray size.' };
  if (!isCabChassis(variantId)) {
    return { ok: false, error: 'Tray sizes are only collected for cab chassis vehicles.' };
  }

  const size = validateTraySize(fields.lengthMm, fields.widthMm);
  if (!size.ok) return { ok: false, error: size.error };

  return { ok: true, variantId, lengthMm: size.lengthMm, widthMm: size.widthMm };
}

export interface ConditionalStore {
  getWithMetadata(key: string, options?: unknown): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(key: string, data: unknown, options?: { onlyIfMatch?: string; onlyIfNew?: boolean }): Promise<{ modified?: boolean }>;
}

/**
 * A plain read-modify-write loses a report whenever two customers submit for
 * the same vehicle at once, and these counts decide what the next customer is
 * shown. Write conditionally on the etag we read, and retry on a lost race.
 */
export async function recordTraySizeWithRetry(
  store: ConditionalStore,
  variantId: string,
  lengthMm: number,
  widthMm: number,
  now: () => string,
): Promise<{ ok: true; record: TraySizeRecord } | { ok: false }> {
  const key = traySizeKey(variantId);

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const current = await store.getWithMetadata(key, { type: 'json' });
    const existing = (current?.data ?? null) as TraySizeRecord | null;
    const updated = addTraySizeReport(existing, variantId, lengthMm, widthMm, now());

    const condition = existing && current?.etag
      ? { onlyIfMatch: current.etag }
      : { onlyIfNew: true };

    const result = await store.setJSON(key, updated, condition);
    if (result.modified) return { ok: true, record: updated };
  }

  return { ok: false };
}

/**
 * Reads every listed record without firing them all at once. The public GET
 * fans out over one blob per vehicle, and doing that serially makes latency the
 * sum of every round trip.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, run));
  return results;
}
