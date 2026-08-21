import type { TrayState } from './derive.ts';

export type CatalogueSource = {
  manufacturer: string;
  title: string;
  url: string;
  accessedDate: string;
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
  source: CatalogueSource;
};

export type CatalogueModel = { make: string; model: string; modelYears: number[] };

export type VehicleCatalogue = {
  schemaVersion: string;
  catalogueVersion: string;
  generatedAt: string;
  sourceDatabaseRowCount: number;
  models: CatalogueModel[];
  variants: CatalogueVariant[];
};
