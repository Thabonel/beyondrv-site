/**
 * Campers are built to order, so a camper is not squeezed onto a tray: it is
 * built for that tray. Tray size therefore decides which *model* someone is
 * looking at, not whether anything fits.
 *
 * The model names are the sizes. An Advent 2150 is a 2150 mm camper, and you
 * cannot build a 2450 onto a 2100 mm tray, because that is a 2150.
 */

/** What building to order absorbs. Beyond this, it is a different model. */
export const BUILD_TOLERANCE_MM = 50;

export type ModelVerdict = 'best' | 'also_suits' | 'smaller' | 'too_long' | 'unknown';

export interface CamperModel {
  slug: string;
  name: string;
  url: string;
  nominalLengthMm: number | null;
  dryWeightKg?: string | null;
  requiredTrayWidthMm?: string | null;
  status: string;
}

export interface ModelResult {
  model: CamperModel;
  verdict: ModelVerdict;
}

/**
 * Ranks models against a tray length, longest first.
 *
 * A model only competes once its size is at least a target, so a figure nobody
 * has settled cannot lead the result.
 */
export function modelsForTray(trayLengthMm: number, models: CamperModel[]): ModelResult[] {
  const ranked = [...models].sort((a, b) => (b.nominalLengthMm ?? -1) - (a.nominalLengthMm ?? -1));
  const usableTray = Number.isFinite(trayLengthMm) && trayLengthMm > 0;

  const suits = (model: CamperModel) =>
    usableTray
    && typeof model.nominalLengthMm === 'number'
    && model.status !== 'draft'
    && model.nominalLengthMm <= trayLengthMm + BUILD_TOLERANCE_MM;

  // Models within the build tolerance of each other are one size, so group the
  // suiting lengths into classes before deciding what counts as an alternative.
  const classes: number[][] = [];
  for (const model of ranked) {
    if (!suits(model)) continue;
    const length = model.nominalLengthMm!;
    const current = classes[classes.length - 1];
    if (current && current[0] - length <= BUILD_TOLERANCE_MM) current.push(length);
    else classes.push([length]);
  }
  const classOf = (length: number) => classes.findIndex((group) => group.includes(length));

  let bestTaken = false;
  return ranked.map((model) => {
    const known = typeof model.nominalLengthMm === 'number' && model.status !== 'draft';
    if (!known || !usableTray) return { model, verdict: 'unknown' as const };
    if (!suits(model)) return { model, verdict: 'too_long' as const };

    // Ranked longest first, so the first model that suits is the largest one.
    if (!bestTaken) {
      bestTaken = true;
      return { model, verdict: 'best' as const };
    }
    // One size class down is a real alternative. Two or more down is a
    // different product line: a ute slide-on is not an option for a truck tray
    // just because it physically fits with two metres to spare.
    return { model, verdict: classOf(model.nominalLengthMm!) <= 1 ? 'also_suits' as const : 'smaller' as const };
  });
}
