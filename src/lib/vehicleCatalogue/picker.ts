import type { CatalogueVariant, VehicleCatalogue } from './types.ts';

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
