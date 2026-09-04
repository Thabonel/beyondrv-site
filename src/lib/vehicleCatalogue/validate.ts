import type {
  CatalogueModel,
  CataloguePublication,
  CatalogueSource,
  CatalogueVariant,
  VehicleCatalogue,
} from './types.ts';
import { CATALOGUE_PLATFORMS, CORRECTABLE_CATALOGUE_FIELDS, type CataloguePlatform, type CorrectableCatalogueField } from './types.ts';
import type { TrayState } from './derive.ts';

const ALLOWED_SOURCE_HOSTS = new Set([
  'assets.gwmanz.com', 'cdn-iua.dataweavers.io', 'payload.therefinerydesign.com',
  'prd1.isuzu.com.au', 'resource.digitaldealer.com.au', 'www.ford.com.au',
  'www.isuzu.com.au',
  'www.mercedes-benz.com.au',
  'norweld.com.au',
  'bydautomotive.com.au',
  'www.fuso.com.au', 'www.gmspecialtyvehicles.com', 'www.hino.com.au', 'www.iveco.com', 'www.kia.com',
  'www.man.com.au', 'www.mazda.com.au', 'www.mercedes-benz-trucks.com',
  'www.mitsubishi-motors.com.au', 'www.nissan.com.au', 'www.ramtrucks.com.au',
  'www.toyota.com.au', 'www.volkswagen.com.au',
]);

const TRAY_STATES = new Set<TrayState>(['included', 'excluded', 'not_applicable', 'unknown']);
const PUBLICATION_METHODS = new Set<CataloguePublication['method']>(['review', 'override']);

type ValidationSuccess = { valid: true; errors: string[]; warnings: string[]; catalogue: VehicleCatalogue };
type ValidationFailure = { valid: false; errors: string[]; warnings: string[] };
export type VehicleCatalogueValidation = ValidationSuccess | ValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringAt(record: Record<string, unknown>, key: string, path: string, errors: string[], max = 1000): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path}.${key} must be a non-empty string.`);
    return '';
  }
  if (value.length > max) errors.push(`${path}.${key} must be at most ${max} characters.`);
  return value;
}

function nullableStringAt(record: Record<string, unknown>, key: string, path: string, errors: string[], max = 300): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') {
    errors.push(`${path}.${key} must be a string or null.`);
    return null;
  }
  if (value.length > max) errors.push(`${path}.${key} must be at most ${max} characters.`);
  return value;
}

function integerAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${path}.${key} must be an integer from ${min} to ${max}.`);
    return min;
  }
  return value;
}

function nullableIntegerAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  bounds: { min?: number; max?: number } = {},
): number | null {
  if (record[key] === null) return null;
  return integerAt(record, key, path, errors, bounds);
}

function booleanAt(record: Record<string, unknown>, key: string, path: string, errors: string[]): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    errors.push(`${path}.${key} must be a boolean.`);
    return false;
  }
  return value;
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function parseSource(value: unknown, path: string, errors: string[]): CatalogueSource {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return { manufacturer: '', title: '', url: '', accessedDate: '' };
  }
  const manufacturer = stringAt(value, 'manufacturer', path, errors, 180);
  const title = stringAt(value, 'title', path, errors, 500);
  const url = stringAt(value, 'url', path, errors, 2000);
  const accessedDate = stringAt(value, 'accessedDate', path, errors, 10);
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !ALLOWED_SOURCE_HOSTS.has(parsed.hostname)) {
        errors.push(`${path}.url must be an approved HTTPS manufacturer source.`);
      }
    } catch {
      errors.push(`${path}.url must be a valid URL.`);
    }
  }
  if (accessedDate && !isIsoDate(accessedDate)) errors.push(`${path}.accessedDate must be a real YYYY-MM-DD date.`);
  if (accessedDate && isIsoDate(accessedDate) && Date.parse(`${accessedDate}T00:00:00Z`) > Date.now()) {
    errors.push(`${path}.accessedDate cannot be in the future.`);
  }
  return { manufacturer, title, url, accessedDate };
}

/** Entries written before trucks existed carry no platform and are utes. */
function parseOptionalBoolean(value: unknown, path: string, errors: string[]): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') {
    errors.push(`${path} must be true or false.`);
    return false;
  }
  return value;
}

function parsePlatform(value: unknown, path: string, errors: string[]): CataloguePlatform {
  if (value === undefined) return 'ute';
  if (typeof value !== 'string' || !(CATALOGUE_PLATFORMS as readonly string[]).includes(value)) {
    errors.push(`${path}.platform must be one of ${CATALOGUE_PLATFORMS.join(', ')}.`);
    return 'ute';
  }
  return value as CataloguePlatform;
}

function parseCorrectedFields(value: unknown, path: string, errors: string[]): CorrectableCatalogueField[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${path}.correctedFields must be an array.`);
    return [];
  }
  const parsed: CorrectableCatalogueField[] = [];
  for (const [index, name] of value.entries()) {
    if (typeof name !== 'string' || !(CORRECTABLE_CATALOGUE_FIELDS as readonly string[]).includes(name)) {
      errors.push(`${path}.correctedFields[${index}] is not a correctable figure.`);
      continue;
    }
    parsed.push(name as CorrectableCatalogueField);
  }
  return parsed;
}

function parsePublication(value: unknown, path: string, errors: string[]): CataloguePublication {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return { approvalId: '', approvedAt: '', method: 'review' };
  }
  const approvalId = stringAt(value, 'approvalId', path, errors, 240);
  const approvedAt = stringAt(value, 'approvedAt', path, errors, 30);
  const methodValue = value.method;
  const method = typeof methodValue === 'string' && PUBLICATION_METHODS.has(methodValue as CataloguePublication['method'])
    ? methodValue as CataloguePublication['method']
    : 'review';
  if (methodValue !== 'review' && methodValue !== 'override') errors.push(`${path}.method is invalid.`);
  if (approvedAt && !isIsoDateTime(approvedAt) && !isIsoDate(approvedAt)) errors.push(`${path}.approvedAt must be an ISO date or UTC timestamp.`);
  if (approvalId && methodValue === 'review' && !approvalId.startsWith('review:')) errors.push(`${path}.approvalId must identify a review.`);
  if (approvalId && methodValue === 'override' && !approvalId.startsWith('override:')) errors.push(`${path}.approvalId must identify an override.`);
  return { approvalId, approvedAt, method };
}

function parseModel(value: unknown, index: number, errors: string[]): CatalogueModel {
  const path = `catalogue.models[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return { make: '', model: '', modelYears: [] };
  }
  const make = stringAt(value, 'make', path, errors, 120);
  const model = stringAt(value, 'model', path, errors, 120);
  const years = value.modelYears;
  const modelYears = Array.isArray(years) ? years.map((year, yearIndex) => {
    if (typeof year !== 'number' || !Number.isInteger(year) || year < 1950 || year > 2100) {
      errors.push(`${path}.modelYears[${yearIndex}] must be an integer from 1950 to 2100.`);
      return 1950;
    }
    return year;
  }) : [];
  if (!Array.isArray(years)) errors.push(`${path}.modelYears must be an array.`);
  if (new Set(modelYears).size !== modelYears.length) errors.push(`${path}.modelYears contains duplicates.`);
  return { make, model, modelYears };
}

function parseVariant(value: unknown, index: number, errors: string[]): CatalogueVariant {
  const path = `catalogue.variants[${index}]`;
  const record = isRecord(value) ? value : {};
  if (!isRecord(value)) errors.push(`${path} must be an object.`);
  const trayStateValue = record.trayState;
  const trayState = typeof trayStateValue === 'string' && TRAY_STATES.has(trayStateValue as TrayState)
    ? trayStateValue as TrayState : 'unknown';
  if (!TRAY_STATES.has(trayStateValue as TrayState)) errors.push(`${path}.trayState is invalid.`);

  const publication = parsePublication(record.publication, `${path}.publication`, errors);
  const promotedByOverride = booleanAt(record, 'promotedByOverride', path, errors);
  if (promotedByOverride !== (publication.method === 'override')) errors.push(`${path}.promotedByOverride must agree with publication.method.`);

  return {
    id: stringAt(record, 'id', path, errors, 240),
    make: stringAt(record, 'make', path, errors, 120),
    model: stringAt(record, 'model', path, errors, 120),
    modelYear: integerAt(record, 'modelYear', path, errors, { min: 1950, max: 2100 }),
    grade: stringAt(record, 'grade', path, errors, 180),
    cabType: stringAt(record, 'cabType', path, errors, 80),
    bodyType: stringAt(record, 'bodyType', path, errors, 80),
    drivetrain: nullableStringAt(record, 'drivetrain', path, errors, 80),
    engine: nullableStringAt(record, 'engine', path, errors, 180),
    transmission: nullableStringAt(record, 'transmission', path, errors, 180),
    wheelbaseMm: nullableIntegerAt(record, 'wheelbaseMm', path, errors, { min: 1000, max: 10000 }),
    label: stringAt(record, 'label', path, errors, 500),
    gvmKg: integerAt(record, 'gvmKg', path, errors, { min: 1, max: 100000 }),
    kerbKg: integerAt(record, 'kerbKg', path, errors, { min: 1, max: 100000 }),
    kerbBasis: stringAt(record, 'kerbBasis', path, errors, 1000),
    payloadKg: integerAt(record, 'payloadKg', path, errors, { min: 0, max: 100000 }),
    frontGawrKg: nullableIntegerAt(record, 'frontGawrKg', path, errors, { min: 1, max: 100000 }),
    rearGawrKg: nullableIntegerAt(record, 'rearGawrKg', path, errors, { min: 1, max: 100000 }),
    trayLengthMm: nullableIntegerAt(record, 'trayLengthMm', path, errors, { min: 1, max: 20000 }),
    trayWidthMm: nullableIntegerAt(record, 'trayWidthMm', path, errors, { min: 1, max: 10000 }),
    trayState,
    trayMassKg: nullableIntegerAt(record, 'trayMassKg', path, errors, { min: 0, max: 10000 }),
    platform: parsePlatform(record.platform, path, errors),
    kerbIsOptimistic: parseOptionalBoolean(record.kerbIsOptimistic, `${path}.kerbIsOptimistic`, errors),
    // Absent means the figure was never recorded, which is normal for a ute and
    // for any entry written before trucks existed. nullableIntegerAt treats an
    // absent key as an error, so only ask it about a value that is present.
    maxBodyLengthMm: record.maxBodyLengthMm === undefined
      ? null
      : nullableIntegerAt(record, 'maxBodyLengthMm', path, errors, { min: 1, max: 20000 }),
    correctedFields: parseCorrectedFields(record.correctedFields, path, errors),
    promotedByOverride,
    publication,
    source: parseSource(record.source, `${path}.source`, errors),
  };
}

export function validateVehicleCatalogue(value: unknown): VehicleCatalogueValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Catalogue must be an object.'], warnings };

  if (value.schemaVersion !== '1.1') errors.push('Catalogue schemaVersion must be 1.1.');
  const catalogueVersion = stringAt(value, 'catalogueVersion', 'catalogue', errors, 200);
  const generatedAt = stringAt(value, 'generatedAt', 'catalogue', errors, 40);
  if (generatedAt && !isIsoDateTime(generatedAt)) errors.push('catalogue.generatedAt must be a UTC ISO timestamp.');
  const sourceDatabaseRowCount = integerAt(value, 'sourceDatabaseRowCount', 'catalogue', errors, { min: 0, max: 1_000_000 });

  if (!Array.isArray(value.models)) errors.push('catalogue.models must be an array.');
  if (!Array.isArray(value.variants)) errors.push('catalogue.variants must be an array.');
  const models = Array.isArray(value.models) ? value.models.map((model, index) => parseModel(model, index, errors)) : [];
  const variants = Array.isArray(value.variants) ? value.variants.map((variant, index) => parseVariant(variant, index, errors)) : [];
  if (sourceDatabaseRowCount < variants.length) errors.push('catalogue.sourceDatabaseRowCount cannot be smaller than the published variant count.');

  const modelKeys = new Set<string>();
  for (const model of models) {
    const key = `${model.make}|${model.model}`;
    if (modelKeys.has(key)) errors.push(`Duplicate model entry: ${key}.`);
    modelKeys.add(key);
  }

  const ids = new Set<string>();
  const labels = new Set<string>();
  const usedModelKeys = new Set<string>();
  const variantYearsByModel = new Map<string, Set<number>>();
  for (const variant of variants) {
    if (ids.has(variant.id)) errors.push(`Duplicate variant id: ${variant.id}.`);
    ids.add(variant.id);
    if (labels.has(variant.label)) errors.push(`Duplicate variant label: ${variant.label}.`);
    labels.add(variant.label);
    if (variant.gvmKg - variant.kerbKg !== variant.payloadKg) errors.push(`Variant ${variant.id} does not reconcile: ${variant.gvmKg} - ${variant.kerbKg} is not ${variant.payloadKg}.`);
    const modelKey = `${variant.make}|${variant.model}`;
    usedModelKeys.add(modelKey);
    const years = variantYearsByModel.get(modelKey) ?? new Set<number>();
    years.add(variant.modelYear);
    variantYearsByModel.set(modelKey, years);
    if (!modelKeys.has(modelKey)) errors.push(`Variant ${variant.id} refers to a make and model missing from the model index.`);
  }
  for (const model of models) {
    const modelKey = `${model.make}|${model.model}`;
    if (!usedModelKeys.has(modelKey)) {
      errors.push(`Model index entry ${modelKey} has no published variants.`);
      continue;
    }
    const publishedYears = [...(variantYearsByModel.get(modelKey) ?? [])].sort((a, b) => b - a);
    const indexedYears = [...model.modelYears].sort((a, b) => b - a);
    if (publishedYears.join(',') !== indexedYears.join(',')) errors.push(`Model index entry ${modelKey} does not match its published model years.`);
  }

  if (variants.length === 0) warnings.push('Catalogue contains no approved variants; the picker will not render.');
  if (errors.length) return { valid: false, errors, warnings };
  return {
    valid: true,
    errors,
    warnings,
    catalogue: { schemaVersion: '1.1', catalogueVersion, generatedAt, sourceDatabaseRowCount, models, variants },
  };
}

export function parseVehicleCatalogue(value: unknown): VehicleCatalogue {
  const validation = validateVehicleCatalogue(value);
  if (!validation.valid) throw new Error(`Vehicle catalogue is invalid: ${validation.errors.join(' ')}`);
  return validation.catalogue;
}

export function emptyVehicleCatalogue(): VehicleCatalogue {
  return {
    schemaVersion: '1.1', catalogueVersion: 'unavailable', generatedAt: '1970-01-01T00:00:00.000Z',
    sourceDatabaseRowCount: 0, models: [], variants: [],
  };
}
