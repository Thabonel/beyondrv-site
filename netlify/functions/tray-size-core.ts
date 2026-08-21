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
