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

export type ModelVerdict = 'best' | 'also_suits' | 'too_long' | 'unknown';

export interface CamperModel {
  slug: string;
  name: string;
  url: string;
  nominalLengthMm: number | null;
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

  let bestTaken = false;
  return ranked.map((model) => {
    const known = typeof model.nominalLengthMm === 'number' && model.status !== 'draft';
    if (!known || !usableTray) return { model, verdict: 'unknown' as const };

    const suits = model.nominalLengthMm! <= trayLengthMm + BUILD_TOLERANCE_MM;
    if (!suits) return { model, verdict: 'too_long' as const };

    // Ranked longest first, so the first model that suits is the largest one.
    if (!bestTaken) {
      bestTaken = true;
      return { model, verdict: 'best' as const };
    }
    return { model, verdict: 'also_suits' as const };
  });
}
