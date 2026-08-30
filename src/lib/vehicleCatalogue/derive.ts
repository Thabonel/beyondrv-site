export type TrayState = 'included' | 'excluded' | 'not_applicable' | 'unknown';

export type PublicationOverride = {
  id: string;
  reason: string;
  reviewer: string;
  approvedAt: string;
};

export type CatalogueOverrides = { show: PublicationOverride[]; hide: string[] };

export type CataloguePromotionRow = {
  id: string;
  customer_selectable: number;
  latest_review_id: number | null;
  latest_review_decision: string | null;
};

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function validateCatalogueOverrides(value: unknown): { valid: boolean; errors: string[]; overrides?: CatalogueOverrides } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Catalogue overrides must be an object.'] };
  }

  const candidate = value as Record<string, unknown>;
  const hide = Array.isArray(candidate.hide) ? candidate.hide : [];
  const show = Array.isArray(candidate.show) ? candidate.show : [];
  if (!Array.isArray(candidate.hide)) errors.push('Catalogue overrides hide must be an array.');
  if (!Array.isArray(candidate.show)) errors.push('Catalogue overrides show must be an array.');

  const normalizedHide: string[] = [];
  for (const [index, id] of hide.entries()) {
    if (typeof id !== 'string' || !id.trim()) errors.push(`Catalogue overrides hide[${index}] must be a non-empty id.`);
    else normalizedHide.push(id.trim());
  }

  const normalizedShow: PublicationOverride[] = [];
  for (const [index, item] of show.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Catalogue overrides show[${index}] must include id, reason, reviewer and approvedAt.`);
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
    const reviewer = typeof record.reviewer === 'string' ? record.reviewer.trim() : '';
    const approvedAt = typeof record.approvedAt === 'string' ? record.approvedAt.trim() : '';
    if (!id) errors.push(`Catalogue overrides show[${index}].id is required.`);
    if (!reason) errors.push(`Catalogue overrides show[${index}].reason is required.`);
    if (!reviewer) errors.push(`Catalogue overrides show[${index}].reviewer is required.`);
    if (id.length > 240) errors.push(`Catalogue overrides show[${index}].id must be at most 240 characters.`);
    if (reason.length > 500) errors.push(`Catalogue overrides show[${index}].reason must be at most 500 characters.`);
    if (reviewer.length > 120) errors.push(`Catalogue overrides show[${index}].reviewer must be at most 120 characters.`);
    if (!isIsoDate(approvedAt)) errors.push(`Catalogue overrides show[${index}].approvedAt must be a real YYYY-MM-DD date.`);
    if (id && id.length <= 240 && reason && reason.length <= 500 && reviewer && reviewer.length <= 120 && isIsoDate(approvedAt)) {
      normalizedShow.push({ id, reason, reviewer, approvedAt });
    }
  }

  const hidden = new Set(normalizedHide);
  for (const override of normalizedShow) {
    if (hidden.has(override.id)) errors.push(`Variant ${override.id} cannot appear in both show and hide overrides.`);
  }

  const duplicateShow = normalizedShow.find((entry, index) => normalizedShow.findIndex((other) => other.id === entry.id) !== index);
  if (duplicateShow) errors.push(`Duplicate show override for variant ${duplicateShow.id}.`);
  const duplicateHide = normalizedHide.find((id, index) => normalizedHide.indexOf(id) !== index);
  if (duplicateHide) errors.push(`Duplicate hide override for variant ${duplicateHide}.`);

  if (errors.length) return { valid: false, errors };
  return { valid: true, errors, overrides: { show: normalizedShow, hide: normalizedHide } };
}

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
  row: CataloguePromotionRow,
  overrides: CatalogueOverrides,
  reviewedIds: ReadonlySet<string> = new Set(),
): boolean {
  if (overrides.hide.includes(row.id)) return false;
  if (overrides.show.some((entry) => entry.id === row.id)) return true;
  // An approval recorded in reviews.json is a real review, unlike a show
  // override, which is the escape hatch that skips every check above.
  if (reviewedIds.has(row.id)) return true;
  return row.customer_selectable === 1
    && row.latest_review_id !== null
    && row.latest_review_decision === 'approved';
}
