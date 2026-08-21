import type { VehicleCatalogue } from './types.ts';

export function validateVehicleCatalogue(catalogue: VehicleCatalogue) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!catalogue.schemaVersion) errors.push('Catalogue schemaVersion is required.');
  if (!catalogue.catalogueVersion) errors.push('Catalogue catalogueVersion is required.');
  if (!catalogue.generatedAt) errors.push('Catalogue generatedAt is required.');

  const ids = new Set<string>();
  const modelKeys = new Set(catalogue.models.map((m) => `${m.make}|${m.model}`));

  for (const v of catalogue.variants) {
    if (!v.id) errors.push('Every variant requires an id.');
    if (ids.has(v.id)) errors.push(`Duplicate variant id: ${v.id}.`);
    ids.add(v.id);

    // The whole dataset exists so this number is right. Guard it here too.
    if (v.gvmKg - v.kerbKg !== v.payloadKg) {
      errors.push(`Variant ${v.id} does not reconcile: ${v.gvmKg} - ${v.kerbKg} is not ${v.payloadKg}.`);
    }
    if (!modelKeys.has(`${v.make}|${v.model}`)) {
      errors.push(`Variant ${v.id} refers to a make and model missing from the model index.`);
    }
    if (!v.source?.url) errors.push(`Variant ${v.id} has no source url.`);
    if (!v.source?.accessedDate) errors.push(`Variant ${v.id} has no source accessedDate.`);
  }

  if (catalogue.variants.length === 0) {
    warnings.push('Catalogue contains no variants; the picker will not render.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
