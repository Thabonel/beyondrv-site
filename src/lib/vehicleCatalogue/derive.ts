export type TrayState = 'included' | 'excluded' | 'not_applicable' | 'unknown';

export type CatalogueOverrides = { show: string[]; hide: string[] };

/**
 * Most published kerb figures do not say whether a tray is included, and
 * guessing is what overloads a vehicle. Four states, so silence stays silent.
 */
export function deriveTrayState(kerbMassBasis: string | null, bodyType: string): TrayState {
  if (bodyType === 'pickup_tub') return 'not_applicable';
  const basis = (kerbMassBasis ?? '').toLowerCase();
  if (basis.includes('tray fitted')) return 'included';
  if (basis.includes('exclude')) return 'excluded';
  return 'unknown';
}

export function isPromoted(
  row: { id: string; verification_status: string },
  overrides: CatalogueOverrides,
): boolean {
  if (overrides.hide.includes(row.id)) return false;
  if (overrides.show.includes(row.id)) return true;
  return row.verification_status === 'source_verified';
}
