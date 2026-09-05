import type { ModelPages } from './types.ts';
import { payload } from './fitment.ts';
export function validateModelPages(data: ModelPages): string[] {
  const errors: string[] = [];
  if (data.schemaVersion !== '1.0' || !Array.isArray(data.models)) return ['Invalid model pages schema'];
  const slugs = new Set<string>(), ids = new Set<string>();
  let count = 0;
  for (const model of data.models) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(model.slug) || slugs.has(model.slug)) errors.push(`Invalid or duplicate slug: ${model.slug}`);
    slugs.add(model.slug);
    if (!model.coverageId || !model.platform || !model.fitmentMode || !model.variants.length) errors.push(`Missing coverage or variants: ${model.slug}`);
    const sources = new Set(model.sources.map(s => s.id));
    for (const source of model.sources) {
      if (!/^https?:\/\//.test(source.url) || !source.title || !/^\d{4}-\d{2}-\d{2}$/.test(source.accessedDate)) errors.push(`Invalid source: ${source.id}`);
    }
    for (const v of model.variants) {
      count++;
      if (ids.has(v.id)) errors.push(`Duplicate variant: ${v.id}`);
      ids.add(v.id);
      if (!sources.has(v.sourceId) || !v.sourceLocator || !v.verificationStatus) errors.push(`Missing provenance: ${v.id}`);
      if (!Number.isFinite(v.gvmKg) || v.gvmKg <= 0) errors.push(`Invalid GVM: ${v.id}`);
      const derived = payload(v.gvmKg, v.kerbKg, v.payloadKg);
      if (derived.calculated !== v.calculatedPayloadKg || derived.matches !== v.payloadArithmeticMatches) errors.push(`Invalid payload derivation: ${v.id}`);
      if (!['included', 'excluded', 'unknown', 'not_applicable'].includes(v.trayState)) errors.push(`Invalid tray state: ${v.id}`);
    }
  }
  if (count !== data.sourceDatabaseRowCount) errors.push('Source row count does not reconcile');
  return errors;
}
