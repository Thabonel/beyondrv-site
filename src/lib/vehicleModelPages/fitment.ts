export interface LoadAllowance { passengerWeight: number; accessoryWeight: number; luggageOrGearWeight: number }
export const DEFAULT_ALLOWANCE = Object.freeze({ passengerWeight: 160, accessoryWeight: 150, luggageOrGearWeight: 80 });
export function payload(gvm: number, kerb: number | null, published: number | null) {
  const calculated = kerb === null ? null : gvm - kerb;
  return { calculated, published, matches: calculated === null || published === null ? null : calculated === published };
}
export function loadAllowance(available: number | null, allowance: LoadAllowance = DEFAULT_ALLOWANCE) {
  return available === null ? null : available - allowance.passengerWeight - allowance.accessoryWeight - allowance.luggageOrGearWeight;
}
export function rearAxleHeadroom(limit: number | null, mass: number | null) {
  return limit === null || mass === null ? null : limit - mass;
}
export function towingAtGvm(gcm: number | null, gvm: number) { return gcm === null ? null : gcm - gvm; }
export function calculatorUrl(v: { gvmKg: number; kerbKg: number | null; trayLengthMm: number | null; trayWidthMm: number | null }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ vehicleGvm: v.gvmKg, currentVehicleWeight: v.kerbKg, trayLength: v.trayLengthMm, trayWidth: v.trayWidthMm })) {
    if (value !== null && Number.isFinite(value) && value > 0) query.set(key, String(value));
  }
  return `/slide-on-camper-weight-calculator/?${query}`;
}
export function queryPrefill(search: string): Record<string, string> {
  const query = new URLSearchParams(search);
  const result: Record<string, string> = {};
  for (const [key, field] of Object.entries({ vehicleGvm: 'gvm', currentVehicleWeight: 'currentWeight', trayLength: 'trayLength', trayWidth: 'trayWidth' })) {
    const raw = query.get(key);
    const value = Number(raw);
    if (raw !== null && Number.isFinite(value) && value > 0) result[field] = String(value);
  }
  return result;
}

export function kgLabel(value: number | null) { return value === null ? 'Not published' : `${value.toLocaleString('en-AU')} kg`; }
export function rangeLabel(values: (number | null)[]) {
  const known = values.filter((v): v is number => v !== null);
  if (!known.length) return 'unavailable';
  const min = Math.min(...known), max = Math.max(...known);
  return min === max ? kgLabel(min) : `${kgLabel(min)} to ${kgLabel(max)}`;
}
/**
 * The answer paragraph is the whole point of these pages, so it is built here
 * and tested, not assembled inline in the template where a missing mass once
 * produced "payload ... is unavailable" as if the arithmetic had been done.
 */
export function answerParagraph(model: {
  make: string; model: string;
  variants: { kind: string; gvmKg: number; kerbKg: number | null; calculatedPayloadKg: number | null }[];
}, allowance: LoadAllowance = DEFAULT_ALLOWANCE) {
  const name = `${model.make} ${model.model}`;
  const heavy = model.variants[0].kind === 'heavy';
  const massLabel = heavy ? 'Chassis-cab mass' : 'Kerb mass';
  const loadLabel = heavy ? 'body and camper' : 'camper';
  const count = `${model.variants.length} recorded ${model.variants.length === 1 ? 'variant' : 'variants'}`;
  const gvm = rangeLabel(model.variants.map(v => v.gvmKg));
  const mass = rangeLabel(model.variants.map(v => v.kerbKg));
  if (mass === 'unavailable') {
    return `${name} has a recorded GVM of ${gvm} across ${count}. ${massLabel} is not published in this record, so payload and the remaining ${loadLabel} load allowance cannot be calculated from it. A GVM limit on its own cannot establish camper suitability.`;
  }
  const payloadRange = rangeLabel(model.variants.map(v => v.calculatedPayloadKg));
  const allowanceRange = rangeLabel(model.variants.map(v => loadAllowance(v.calculatedPayloadKg, allowance)));
  const total = allowance.passengerWeight + allowance.accessoryWeight + allowance.luggageOrGearWeight;
  return `${name} has a recorded GVM of ${gvm}. ${massLabel} is ${mass}; payload calculated as GVM minus that mass is ${payloadRange} across ${count}. After a stated ${total} kg allowance for occupants, accessories and gear, the remaining ${loadLabel} load allowance is ${allowanceRange}.`;
}
