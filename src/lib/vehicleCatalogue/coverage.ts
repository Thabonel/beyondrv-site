/**
 * The catalogue holds vehicles whose figures are published. Coverage holds
 * every vehicle we know exists, figures or not.
 *
 * The two answer different questions. A customer who cannot find their vehicle
 * in the picker cannot tell "we have never heard of it" from "we have not
 * finished researching it" from "it is not a slide-on platform" — and the
 * honest answer changes what they should do next. Listing the model and saying
 * plainly that its figures are not recorded is better than an absence they have
 * to interpret.
 */

export interface CoverageModel {
  make: string;
  model: string;
  /** True when the catalogue can fill this model's figures in. */
  hasVariants: boolean;
  /** Free text from the research table, shown to nobody; kept for debugging. */
  status: string;
}

export interface VehicleCoverage {
  models: CoverageModel[];
}

export function emptyVehicleCoverage(): VehicleCoverage {
  return { models: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parsing is total: a malformed row is dropped rather than thrown, because a
 * broken coverage file must never take the working picker down with it.
 */
export function parseVehicleCoverage(value: unknown): VehicleCoverage {
  if (!isRecord(value) || !Array.isArray(value.models)) return emptyVehicleCoverage();

  const models: CoverageModel[] = [];
  const seen = new Set<string>();
  for (const entry of value.models) {
    if (!isRecord(entry)) continue;
    const make = typeof entry.make === 'string' ? entry.make.trim() : '';
    const model = typeof entry.model === 'string' ? entry.model.trim() : '';
    if (!make || !model) continue;
    const key = `${make}|${model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    models.push({
      make,
      model,
      hasVariants: entry.hasVariants === true,
      status: typeof entry.status === 'string' ? entry.status : '',
    });
  }
  models.sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
  return { models };
}
