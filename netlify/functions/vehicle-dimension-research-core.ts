export const TRAY_MEASUREMENT_STEPS = [
  'Measure the flat load-floor length from the front wall or headboard to the inside of the closed tailgate, or to the end of a tray.',
  'Measure the narrowest flat usable width between wheel arches, rails, tie-downs or anything else that limits the camper.',
  'Use millimetres and measure the vehicle as it is now. Do not use the vehicle’s overall exterior length or width.',
] as const;

export type ResearchSource = { title: string; url: string };

export type RawDimensionOption = {
  name?: unknown;
  lengthMm?: unknown;
  widthMm?: unknown;
  dimensionKind?: unknown;
  confidence?: unknown;
  sourceTitle?: unknown;
  sourceUrl?: unknown;
};

export type DimensionOption = {
  name: string;
  lengthMm: number;
  widthMm: number;
  dimensionKind: 'usable_internal' | 'load_floor';
  confidence: 'high' | 'medium';
  source: ResearchSource;
};

export type DimensionResearchResult = {
  status: 'single' | 'multiple' | 'not_found' | 'unavailable';
  vehicleId: string;
  vehicleLabel: string;
  message: string;
  options: DimensionOption[];
  measurementSteps: readonly string[];
  cached?: boolean;
};

function canonicalUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function wholeMillimetres(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

export function normaliseDimensionResearch(params: {
  vehicleId: string;
  vehicleLabel: string;
  rawOptions: unknown;
  searchedSources: ResearchSource[];
  explanation?: unknown;
}): DimensionResearchResult {
  const sourceByUrl = new Map(
    params.searchedSources
      .map((source) => [canonicalUrl(source.url), source] as const)
      .filter(([url]) => Boolean(url)),
  );
  const candidates = Array.isArray(params.rawOptions) ? params.rawOptions : [];
  const options: DimensionOption[] = [];

  for (const raw of candidates.slice(0, 6)) {
    if (!raw || typeof raw !== 'object') continue;
    const option = raw as RawDimensionOption;
    const lengthMm = wholeMillimetres(option.lengthMm, 800, 4000);
    const widthMm = wholeMillimetres(option.widthMm, 800, 2600);
    const source = sourceByUrl.get(canonicalUrl(option.sourceUrl));
    const dimensionKind = option.dimensionKind === 'load_floor' ? 'load_floor' : option.dimensionKind === 'usable_internal' ? 'usable_internal' : null;
    const confidence = option.confidence === 'high' ? 'high' : option.confidence === 'medium' ? 'medium' : null;
    if (!lengthMm || !widthMm || !source || !dimensionKind || !confidence) continue;

    options.push({
      name: typeof option.name === 'string' && option.name.trim() ? option.name.trim().slice(0, 140) : 'Published tray or tub',
      lengthMm,
      widthMm,
      dimensionKind,
      confidence,
      source: {
        title: source.title && source.title !== 'Web source'
          ? source.title
          : typeof option.sourceTitle === 'string' && option.sourceTitle.trim()
            ? option.sourceTitle.trim().slice(0, 180)
            : 'View source',
        url: source.url,
      },
    });
  }

  const unique = options.filter((option, index) => options.findIndex((candidate) => (
    candidate.name === option.name && candidate.lengthMm === option.lengthMm && candidate.widthMm === option.widthMm
  )) === index);
  const message = typeof params.explanation === 'string' ? params.explanation.trim().slice(0, 400) : '';

  if (!unique.length) {
    return {
      status: 'not_found',
      vehicleId: params.vehicleId,
      vehicleLabel: params.vehicleLabel,
      message: message || 'We could not verify both usable dimensions for this exact vehicle.',
      options: [],
      measurementSteps: TRAY_MEASUREMENT_STEPS,
    };
  }

  return {
    status: unique.length === 1 ? 'single' : 'multiple',
    vehicleId: params.vehicleId,
    vehicleLabel: params.vehicleLabel,
    message: unique.length === 1
      ? 'We found one likely match. Confirm it is your tub or tray before using the dimensions.'
      : 'More than one tub or tray may fit this vehicle. Choose the one fitted to yours.',
    options: unique.slice(0, 4),
    measurementSteps: TRAY_MEASUREMENT_STEPS,
  };
}

export function unavailableDimensionResearch(vehicleId: string, vehicleLabel: string): DimensionResearchResult {
  return {
    status: 'unavailable',
    vehicleId,
    vehicleLabel,
    message: 'We could not complete the research just now. You can still enter two measurements yourself.',
    options: [],
    measurementSteps: TRAY_MEASUREMENT_STEPS,
  };
}
