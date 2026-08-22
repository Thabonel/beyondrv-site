import type { TrayState } from './derive.ts';

export type CatalogueSource = {
  manufacturer: string;
  title: string;
  url: string;
  accessedDate: string;
};

export type CataloguePublication = {
  approvalId: string;
  approvedAt: string;
  method: 'review' | 'override';
};

export type CatalogueVariant = {
  id: string;
  make: string;
  model: string;
  modelYear: number;
  grade: string;
  cabType: string;
  bodyType: string;
  drivetrain: string | null;
  engine: string | null;
  transmission: string | null;
  wheelbaseMm: number | null;
  label: string;
  gvmKg: number;
  kerbKg: number;
  kerbBasis: string;
  payloadKg: number;
  frontGawrKg: number | null;
  rearGawrKg: number | null;
  trayLengthMm: number | null;
  trayWidthMm: number | null;
  trayState: TrayState;
  trayMassKg: number | null;
  promotedByOverride: boolean;
  publication: CataloguePublication;
  source: CatalogueSource;
};

export type CatalogueModel = { make: string; model: string; modelYears: number[] };

export type VehicleCatalogue = {
  schemaVersion: '1.1';
  catalogueVersion: string;
  generatedAt: string;
  sourceDatabaseRowCount: number;
  models: CatalogueModel[];
  variants: CatalogueVariant[];
};
