import rawCatalogue from '../data/vehicle-selector/catalogue.json' with { type: 'json' };
import { validateVehicleCatalogue } from './vehicleCatalogue/validate.ts';
import type { VehicleCatalogue } from './vehicleCatalogue/types.ts';

const VEHICLE_CATALOGUE = rawCatalogue as unknown as VehicleCatalogue;

export function getVehicleCatalogue(): VehicleCatalogue {
  const validation = validateVehicleCatalogue(VEHICLE_CATALOGUE);
  if (!validation.valid) {
    throw new Error(`Vehicle catalogue is invalid: ${validation.errors.join(' ')}`);
  }
  return VEHICLE_CATALOGUE;
}
