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
