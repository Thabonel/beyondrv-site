import type { TrayState } from '../vehicleCatalogue/derive.ts';
export interface ModelSource { id: string; manufacturer: string; title: string; url: string; accessedDate: string;
  sourceType: string; notes: string | null }
interface VariantBase {
  id: string; modelYear: number | null; modelYearEnd: number | null; grade: string; cabType: string; drivetrain: string | null;
  gvmKg: number; gcmKg: number | null; kerbKg: number | null; kerbBasis: string; payloadKg: number | null;
  calculatedPayloadKg: number | null; payloadArithmeticMatches: boolean | null;
  frontGawrKg: number | null; rearGawrKg: number | null; trayState: TrayState;
  trayLengthMm: number | null; trayWidthMm: number | null; brakedTowingKg: number | null;
  sourceId: string; sourceLocator: string; verificationStatus: string; notes: string | null;
}
export interface LightVariant extends VariantBase { kind: 'light'; bodyType: string; publishedPayloadKg: number | null }
export interface HeavyVariant extends VariantBase {
  kind: 'heavy'; publishedBodyPayloadKg: number | null; chassisCabTotalMassKg: number | null;
  chassisCabFrontMassKg: number | null; chassisCabRearMassKg: number | null;
  mountingArchitectureNote: string; maxBodyLengthMm: number | null; maxBodyWidthMm: number | null;
}
export type ModelVariant = LightVariant | HeavyVariant;
export interface ModelPage {
  slug: string; make: string; model: string; coverageId: string; platform: string; fitmentMode: string;
  modelYears: number[]; variants: ModelVariant[]; sources: ModelSource[];
}
export interface ModelPages { schemaVersion: string; generatedAt: string; sourceDatabaseRowCount: number; models: ModelPage[] }
