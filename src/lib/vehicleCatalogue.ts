import rawCatalogue from '../data/vehicle-selector/catalogue.json' with { type: 'json' };
import { parseVehicleCatalogue } from './vehicleCatalogue/validate.ts';
import type { VehicleCatalogue } from './vehicleCatalogue/types.ts';

const VEHICLE_CATALOGUE = parseVehicleCatalogue(rawCatalogue);

export function getVehicleCatalogue(): VehicleCatalogue {
  return VEHICLE_CATALOGUE;
}
