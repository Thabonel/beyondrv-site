import type { VehicleCatalogue } from '../../src/lib/vehicleCatalogue/types';

const reviewedPublication = {
  approvalId: 'review:e2e-fixture',
  approvedAt: '2026-08-22',
  method: 'review' as const,
};

export const vehicleCatalogueFixture: VehicleCatalogue = {
  schemaVersion: '1.1',
  catalogueVersion: 'e2e-fixture-2026-08-22',
  generatedAt: '2026-08-22T00:00:00.000Z',
  sourceDatabaseRowCount: 5,
  models: [
    { make: 'Ford', model: 'Ranger', modelYears: [2022] },
    { make: 'Mazda', model: 'BT-50', modelYears: [2025] },
  ],
  variants: [
    {
      id: 'ford-ranger-2022my-4x4-xl-double-cc-singleturbo',
      make: 'Ford', model: 'Ranger', modelYear: 2022, grade: 'XL',
      cabType: 'double_cab', bodyType: 'cab_chassis', drivetrain: '4x4 part-time',
      engine: '2.0L single-turbo diesel; 125 kW / 405 Nm', transmission: '6-speed automatic', wheelbaseMm: null,
      label: 'Ford Ranger XL double cab cab chassis 4x4 part-time (2022) 2.0L single-turbo diesel',
      gvmKg: 3250, kerbKg: 2046, kerbBasis: 'Kerb weight with heaviest factory optional equipment; excludes tray body',
      payloadKg: 1204, frontGawrKg: 1450, rearGawrKg: 1959,
      trayLengthMm: null, trayWidthMm: null, trayState: 'excluded', trayMassKg: null,
      promotedByOverride: false, publication: reviewedPublication,
      source: {
        manufacturer: 'Ford Australia', title: 'Next-Generation Ranger 2022MY Specifications',
        url: 'https://www.ford.com.au/ranger/specifications', accessedDate: '2026-08-17',
      },
    },
    {
      id: 'ford-ranger-2022my-4x4-xl-double-cc-biturbo',
      make: 'Ford', model: 'Ranger', modelYear: 2022, grade: 'XL',
      cabType: 'double_cab', bodyType: 'cab_chassis', drivetrain: '4x4 part-time',
      engine: '2.0L bi-turbo diesel; 154 kW / 500 Nm', transmission: '6-speed automatic', wheelbaseMm: null,
      label: 'Ford Ranger XL double cab cab chassis 4x4 part-time (2022) 2.0L bi-turbo diesel',
      gvmKg: 3250, kerbKg: 2072, kerbBasis: 'Kerb weight with heaviest factory optional equipment; excludes tray body',
      payloadKg: 1178, frontGawrKg: 1450, rearGawrKg: 1959,
      trayLengthMm: null, trayWidthMm: null, trayState: 'excluded', trayMassKg: null,
      promotedByOverride: false, publication: reviewedPublication,
      source: {
        manufacturer: 'Ford Australia', title: 'Next-Generation Ranger 2022MY Specifications',
        url: 'https://www.ford.com.au/ranger/specifications', accessedDate: '2026-08-17',
      },
    },
    {
      id: 'ford-ranger-2022my-4x4-xl-double-pickup-singleturbo',
      make: 'Ford', model: 'Ranger', modelYear: 2022, grade: 'XL',
      cabType: 'double_cab', bodyType: 'pickup_tub', drivetrain: '4x4 part-time',
      engine: '2.0L single-turbo diesel; 125 kW / 405 Nm', transmission: '6-speed automatic', wheelbaseMm: null,
      label: 'Ford Ranger XL double cab pickup tub 4x4 part-time (2022) 2.0L single-turbo diesel',
      gvmKg: 3250, kerbKg: 2201, kerbBasis: 'Kerb weight with heaviest factory optional equipment',
      payloadKg: 1049, frontGawrKg: 1450, rearGawrKg: 1959,
      trayLengthMm: null, trayWidthMm: null, trayState: 'not_applicable', trayMassKg: null,
      promotedByOverride: false, publication: reviewedPublication,
      source: {
        manufacturer: 'Ford Australia', title: 'Next-Generation Ranger 2022MY Specifications',
        url: 'https://www.ford.com.au/ranger/specifications', accessedDate: '2026-08-17',
      },
    },
    {
      id: 'mazda-bt50-my25-dual-4x4-gt-cc',
      make: 'Mazda', model: 'BT-50', modelYear: 2025, grade: 'GT',
      cabType: 'dual_cab', bodyType: 'cab_chassis', drivetrain: '4x4', engine: '3.0L diesel',
      transmission: 'automatic', wheelbaseMm: null, label: 'Mazda BT-50 GT dual cab cab chassis 4x4 (2025)',
      gvmKg: 3100, kerbKg: 2073, kerbBasis: 'Kerb weight with Mazda standard tray fitted', payloadKg: 1027,
      frontGawrKg: 1450, rearGawrKg: 1910, trayLengthMm: null, trayWidthMm: null,
      trayState: 'included', trayMassKg: null, promotedByOverride: false, publication: reviewedPublication,
      source: {
        manufacturer: 'Mazda Australia', title: 'Mazda BT-50 Payload Calculator',
        url: 'https://www.mazda.com.au/cars/bt-50/payload/', accessedDate: '2026-08-17',
      },
    },
    {
      id: 'mazda-bt50-my25-dual-4x4-gt-pickup',
      make: 'Mazda', model: 'BT-50', modelYear: 2025, grade: 'GT',
      cabType: 'dual_cab', bodyType: 'pickup_tub', drivetrain: '4x4', engine: '3.0L diesel',
      transmission: 'automatic', wheelbaseMm: null, label: 'Mazda BT-50 GT dual cab pickup tub 4x4 (2025)',
      gvmKg: 3100, kerbKg: 2102, kerbBasis: 'Published kerb weight; tub body', payloadKg: 998,
      frontGawrKg: 1450, rearGawrKg: 1910, trayLengthMm: null, trayWidthMm: null,
      trayState: 'not_applicable', trayMassKg: null, promotedByOverride: false, publication: reviewedPublication,
      source: {
        manufacturer: 'Mazda Australia', title: 'Mazda BT-50 Payload Calculator',
        url: 'https://www.mazda.com.au/cars/bt-50/payload/', accessedDate: '2026-08-17',
      },
    },
  ],
};
