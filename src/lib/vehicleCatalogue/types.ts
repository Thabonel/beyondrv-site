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

/**
 * Figures Beyond RV corrected during review. Anything listed here did not come
 * from the manufacturer source, so the provenance panel must not credit it to
 * them. payloadKg appears because it is derived from GVM and kerb mass.
 */
export const CORRECTABLE_CATALOGUE_FIELDS = ['gvmKg', 'kerbKg', 'payloadKg', 'trayLengthMm', 'trayWidthMm'] as const;
export type CorrectableCatalogueField = typeof CORRECTABLE_CATALOGUE_FIELDS[number];

export const CATALOGUE_PLATFORMS = ['ute', 'truck'] as const;
export type CataloguePlatform = typeof CATALOGUE_PLATFORMS[number];

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
  platform: CataloguePlatform;
  /** The longest body this chassis takes. Never the tray someone fitted. */
  maxBodyLengthMm: number | null;
  correctedFields: CorrectableCatalogueField[];
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
