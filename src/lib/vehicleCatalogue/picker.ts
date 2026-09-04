import type { CatalogueVariant, VehicleCatalogue } from './types.ts';
import type { VehicleCoverage } from './coverage.ts';

export function catalogueMakes(catalogue: VehicleCatalogue): string[] {
  return [...new Set(catalogue.models.map((entry) => entry.make))]
    .sort((left, right) => left.localeCompare(right));
}

export function catalogueModelsForMake(catalogue: VehicleCatalogue, make: string): string[] {
  return catalogue.models
    .filter((entry) => entry.make === make)
    .map((entry) => entry.model)
    .sort((left, right) => left.localeCompare(right));
}

export function catalogueVariantsForModel(
  catalogue: VehicleCatalogue,
  make: string,
  model: string,
): CatalogueVariant[] {
  return catalogue.variants.filter((entry) => entry.make === make && entry.model === model);
}

export function catalogueVariantById(catalogue: VehicleCatalogue, id: string): CatalogueVariant | undefined {
  return catalogue.variants.find((entry) => entry.id === id);
}

/**
 * The picker lists every vehicle we know of, not only the ones we can fill in.
 * A make or model missing from the list tells the customer nothing useful — they
 * cannot tell an unresearched vehicle from an unsuitable one — so coverage is
 * unioned in and the page says plainly which models it has no figures for.
 */
export function pickerMakes(catalogue: VehicleCatalogue, coverage: VehicleCoverage): string[] {
  const makes = new Set<string>(catalogue.models.map((entry) => entry.make));
  for (const entry of coverage.models) makes.add(entry.make);
  return [...makes].sort((left, right) => left.localeCompare(right));
}

export function pickerModelsForMake(
  catalogue: VehicleCatalogue,
  coverage: VehicleCoverage,
  make: string,
): string[] {
  const models = new Set<string>(catalogueModelsForMake(catalogue, make));
  for (const entry of coverage.models) {
    if (entry.make === make) models.add(entry.model);
  }
  return [...models].sort((left, right) => left.localeCompare(right));
}
