export interface CurrentVehicleWeightInput {
  currentWeightRaw: string;
  trayMassRaw: string;
  /**
   * True when the selected vehicle's published kerb mass does not already
   * account for a tray, so the tray's weight has to come from the customer.
   */
  trayRequired: boolean;
}

/**
 * The tray is part of the vehicle's mass before the listed additions, so it is
 * folded into the current vehicle weight rather than passed separately.
 *
 * When the kerb figure excludes the tray, a blank tray weight is not zero — it
 * is a number we do not have yet. Treating it as zero understates the vehicle
 * and overstates the payload left for a camper, which is the direction that
 * gets someone overloaded. In that case return an empty weight so the
 * calculator's existing missing-field path keeps the result in needs-review.
 */
export function resolveCurrentVehicleWeight({
  currentWeightRaw,
  trayMassRaw,
  trayRequired,
}: CurrentVehicleWeightInput): string {
  const currentWeight = Number(currentWeightRaw);
  if (!Number.isFinite(currentWeight) || currentWeight <= 0) return currentWeightRaw;

  const trayMass = Number(trayMassRaw);
  const trayMassUsable = trayMassRaw !== '' && Number.isFinite(trayMass) && trayMass >= 0;

  if (trayRequired) return trayMassUsable ? String(currentWeight + trayMass) : '';

  // No tray applies, or its weight is already inside the kerb figure. Ignore
  // anything left in the field so it cannot be counted twice.
  return String(currentWeight);
}

export interface TrayMassRequirement {
  /** The catalogue's view of whether the published kerb mass includes a tray. */
  trayState: string;
  /**
   * Whether the current vehicle weight on screen already accounts for the
   * tray. The page asks people for a weighbridge figure, and a weighbridge
   * figure includes whatever tray is bolted on, so the catalogue alone cannot
   * answer this — only the customer knows which number they typed.
   */
  currentWeightIncludesTray: boolean;
}

/**
 * Guessing this from whether the weight was edited is not safe: someone can
 * replace the published kerb mass with a different kerb mass that still
 * excludes the tray, and silently dropping the requirement would understate
 * the vehicle again. Asking costs a checkbox; guessing costs payload.
 */
export function isTrayMassRequired({ trayState, currentWeightIncludesTray }: TrayMassRequirement): boolean {
  if (currentWeightIncludesTray) return false;
  return trayState === 'excluded' || trayState === 'unknown';
}
