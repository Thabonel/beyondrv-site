import rawCoverage from '../data/vehicle-selector/coverage.json' with { type: 'json' };
import { parseVehicleCoverage } from './vehicleCatalogue/coverage.ts';
import type { VehicleCoverage } from './vehicleCatalogue/coverage.ts';

const VEHICLE_COVERAGE = parseVehicleCoverage(rawCoverage);

export function getVehicleCoverage(): VehicleCoverage {
  return VEHICLE_COVERAGE;
}
