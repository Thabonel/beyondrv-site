export const ESTIMATE_DISCLAIMER =
  'This tool provides an estimate only. Final suitability depends on your exact vehicle variant, compliance plate, manufacturer specifications, towbar rating, axle limits, tyre ratings, accessories, real loaded weights and certified weighbridge results. Beyond RV weighs your vehicle at the factory before build, and those figures decide the final answer.';

export const CARAVAN_FINAL_WARNING =
  "Final suitability still requires confirmation against your exact vehicle compliance plate, owner's manual, towbar rating, axle limits, tyre ratings and certified weighbridge results.";

export const SLIDE_ON_FINAL_WARNING =
  'Final suitability still requires axle load, tyre rating and centre-of-gravity confirmation.';

const NEUTRAL_RESULT = {
  status: 'neutral',
  statusLabel: 'Enter your numbers to calculate a result.',
  title: 'Enter your numbers',
  summary: 'Enter your numbers to calculate a result.',
  recommendation: 'Confirm with Beyond RV',
  dataQuality: 'Needs review: one or more important fields missing',
  notes: []
};

function parseRequired(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseOptional(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function hasMissing(values) {
  return values.some(value => value === null);
}

function kg(value) {
  return `${Math.round(value).toLocaleString()} kg`;
}

function missingResult(warning) {
  return {
    ...NEUTRAL_RESULT,
    status: 'amber',
    statusLabel: 'Needs review — not enough information.',
    title: 'Needs review',
    summary: 'Needs review — not enough information.',
    dataQuality: 'Needs review: one or more important fields missing',
    notes: [
      'Enter every required rating, weight and dimension before using the result.',
      warning,
      ESTIMATE_DISCLAIMER
    ]
  };
}

export function initialSuitabilityResult() {
  return {
    ...NEUTRAL_RESULT,
    dataQuality: 'Needs review: one or more important fields missing',
    notes: [ESTIMATE_DISCLAIMER]
  };
}

export function calculateCaravanSuitability(input = {}, options = {}) {
  if (!options.started) return initialSuitabilityResult();

  const vehicleGvm = parseRequired(input.vehicleGvm);
  const vehicleGcm = parseRequired(input.vehicleGcm);
  const currentVehicleWeight = parseRequired(input.currentVehicleWeight);
  const vehicleBrakedTowingCapacity = parseRequired(input.vehicleBrakedTowingCapacity);
  const vehicleTowBallLimit = parseRequired(input.vehicleTowBallLimit);
  const estimatedTowBallDownload = parseRequired(input.estimatedTowBallDownload);
  const caravanAtmRating = parseRequired(input.caravanAtmRating);
  const estimatedActualLoadedCaravanWeight = parseRequired(input.estimatedActualLoadedCaravanWeight);
  const caravanGtmRating = parseRequired(input.caravanGtmRating);
  const passengerWeight = parseOptional(input.passengerWeight);
  const accessoryWeight = parseOptional(input.accessoryWeight);
  const luggageWeight = parseOptional(input.luggageWeight);

  if (hasMissing([
    vehicleGvm,
    vehicleGcm,
    currentVehicleWeight,
    vehicleBrakedTowingCapacity,
    vehicleTowBallLimit,
    estimatedTowBallDownload,
    caravanAtmRating,
    estimatedActualLoadedCaravanWeight,
    caravanGtmRating,
    passengerWeight,
    accessoryWeight,
    luggageWeight
  ])) {
    return missingResult(CARAVAN_FINAL_WARNING);
  }

  // Tow ball download transfers caravan weight onto the tow vehicle, so it is added to vehicle load for GVM.
  const estimatedLoadedVehicleWeight =
    currentVehicleWeight + passengerWeight + accessoryWeight + luggageWeight + estimatedTowBallDownload;

  // Per the checker rules, GCM is tested against loaded vehicle plus actual loaded caravan weight.
  const combinedLoadedWeight = estimatedLoadedVehicleWeight + estimatedActualLoadedCaravanWeight;

  // GTM is the trailer load carried through its tyres when coupled, so ball download is subtracted.
  const estimatedCaravanAxleLoad = estimatedActualLoadedCaravanWeight - estimatedTowBallDownload;

  const remainingGvmMargin = vehicleGvm - estimatedLoadedVehicleWeight;
  const remainingGcmMargin = vehicleGcm - combinedLoadedWeight;
  const towCapacityMargin = vehicleBrakedTowingCapacity - estimatedActualLoadedCaravanWeight;
  const towBallMargin = vehicleTowBallLimit - estimatedTowBallDownload;
  const atmMargin = caravanAtmRating - estimatedActualLoadedCaravanWeight;
  const gtmMargin = caravanGtmRating - estimatedCaravanAxleLoad;

  const exceeded = [
    remainingGvmMargin,
    remainingGcmMargin,
    towCapacityMargin,
    towBallMargin,
    atmMargin,
    gtmMargin
  ].some(value => value < 0);

  const tight =
    remainingGvmMargin < 150 ||
    remainingGcmMargin < 200 ||
    towCapacityMargin < 200 ||
    towBallMargin < 30 ||
    atmMargin < 100 ||
    gtmMargin < 100;

  const status = exceeded ? 'red' : tight ? 'amber' : 'green';
  const statusLabel = status === 'red'
    ? 'Not recommended'
    : status === 'amber'
      ? 'Needs review'
      : 'Looks suitable';
  const title = status === 'red'
    ? 'Not recommended on this estimate'
    : status === 'amber'
      ? 'Needs review on this estimate'
      : 'Appears suitable based on the information entered';

  const notes = [];
  if (remainingGvmMargin < 0) notes.push(`Estimated loaded vehicle weight is ${kg(Math.abs(remainingGvmMargin))} over GVM.`);
  if (remainingGcmMargin < 0) notes.push(`Combined loaded weight is ${kg(Math.abs(remainingGcmMargin))} over GCM.`);
  if (atmMargin < 0) notes.push(`Estimated actual loaded caravan weight is ${kg(Math.abs(atmMargin))} over ATM.`);
  if (towCapacityMargin < 0) notes.push(`Estimated actual loaded caravan weight is ${kg(Math.abs(towCapacityMargin))} over braked towing capacity.`);
  if (gtmMargin < 0) notes.push(`Estimated caravan axle load is ${kg(Math.abs(gtmMargin))} over GTM.`);
  if (towBallMargin < 0) notes.push(`Estimated tow ball download is ${kg(Math.abs(towBallMargin))} over the entered tow ball limit.`);
  if (!exceeded && tight) notes.push('One or more margins are tight. Small changes in water, luggage or accessories may change the result.');
  notes.push('Estimated caravan axle load is estimated actual loaded caravan weight minus estimated tow ball download.');
  notes.push(CARAVAN_FINAL_WARNING);
  notes.push(ESTIMATE_DISCLAIMER);

  return {
    status,
    statusLabel,
    title,
    summary: `Estimated loaded vehicle weight is ${kg(estimatedLoadedVehicleWeight)} and combined loaded weight is ${kg(combinedLoadedWeight)}.`,
    recommendation: 'Confirm with Beyond RV',
    dataQuality: 'Complete estimate; Product data incomplete: Beyond RV must confirm product weights; Weighbridge required: actual loaded weights needed',
    notes,
    values: {
      estimatedLoadedVehicleWeight,
      combinedLoadedWeight,
      estimatedCaravanAxleLoad,
      remainingGvmMargin,
      remainingGcmMargin,
      towCapacityMargin,
      towBallMargin,
      atmMargin,
      gtmMargin,
      availablePayload: vehicleGvm - currentVehicleWeight
    }
  };
}

export function calculateSlideOnSuitability(input = {}, options = {}) {
  if (!options.started) return initialSuitabilityResult();

  const vehicleGvm = parseRequired(input.vehicleGvm);
  const currentVehicleWeight = parseRequired(input.currentVehicleWeight);
  const passengerWeight = parseOptional(input.passengerWeight);
  const accessoryWeight = parseOptional(input.accessoryWeight);
  const luggageOrGearWeight = parseOptional(input.luggageOrGearWeight);
  const camperDryWeight = parseRequired(input.camperDryWeight);
  const camperWaterWeight = parseOptional(input.camperWaterWeight);
  const camperGearWeight = parseOptional(input.camperGearWeight);
  const camperOptionsWeight = parseOptional(input.camperOptionsWeight);
  const trayLength = parseRequired(input.trayLength);
  const trayWidth = parseRequired(input.trayWidth);
  const requiredTrayLength = parseRequired(input.requiredTrayLength);
  const requiredTrayWidth = parseRequired(input.requiredTrayWidth);
  const rearAxleChecked = input.rearAxleChecked === true || input.rearAxleChecked === 'true';
  const tyreRatingsChecked = input.tyreRatingsChecked === true || input.tyreRatingsChecked === 'true';
  const centreOfGravityChecked = input.centreOfGravityChecked === true || input.centreOfGravityChecked === 'true';

  const fields = [
    ['vehicle GVM', vehicleGvm],
    ['current vehicle weight', currentVehicleWeight],
    ['passenger weight', passengerWeight],
    ['accessory weight', accessoryWeight],
    ['vehicle luggage and gear', luggageOrGearWeight],
    ['camper dry weight', camperDryWeight],
    ['camper water weight', camperWaterWeight],
    ['camper gear weight', camperGearWeight],
    ['camper options weight', camperOptionsWeight],
    ['tray or tub usable length', trayLength],
    ['tray or tub usable width', trayWidth],
    ['required tray length', requiredTrayLength],
    ['required tray width', requiredTrayWidth]
  ];
  const missingFields = fields.filter(([, value]) => value === null).map(([label]) => label);
  const hasVehicleWeights = !hasMissing([
    vehicleGvm, currentVehicleWeight, passengerWeight, accessoryWeight, luggageOrGearWeight
  ]);
  const hasCamperWeights = !hasMissing([
    camperDryWeight, camperWaterWeight, camperGearWeight, camperOptionsWeight
  ]);

  const vehiclePayloadBeforeAdditions = !hasMissing([vehicleGvm, currentVehicleWeight])
    ? vehicleGvm - currentVehicleWeight
    : undefined;
  const additionalVehicleLoad = !hasMissing([passengerWeight, accessoryWeight, luggageOrGearWeight])
    ? passengerWeight + accessoryWeight + luggageOrGearWeight
    : undefined;
  const availablePayloadBeforeCamper = hasVehicleWeights
    ? vehiclePayloadBeforeAdditions - additionalVehicleLoad
    : undefined;
  const estimatedLoadedCamperWeight = hasCamperWeights
    ? camperDryWeight + camperWaterWeight + camperGearWeight + camperOptionsWeight
    : undefined;
  const estimatedLoadedVehicleWeight = hasVehicleWeights && estimatedLoadedCamperWeight !== undefined
    ? currentVehicleWeight + passengerWeight + accessoryWeight + luggageOrGearWeight + estimatedLoadedCamperWeight
    : undefined;
  const remainingGvmMargin = estimatedLoadedVehicleWeight !== undefined
    ? vehicleGvm - estimatedLoadedVehicleWeight
    : undefined;
  const trayLengthFit = trayLength !== null && requiredTrayLength !== null
    ? trayLength - requiredTrayLength
    : undefined;
  const trayWidthFit = trayWidth !== null && requiredTrayWidth !== null
    ? trayWidth - requiredTrayWidth
    : undefined;

  const exceeded =
    (remainingGvmMargin !== undefined && remainingGvmMargin < 0) ||
    (estimatedLoadedCamperWeight !== undefined && availablePayloadBeforeCamper !== undefined && estimatedLoadedCamperWeight > availablePayloadBeforeCamper) ||
    (trayLengthFit !== undefined && trayLengthFit < 0) ||
    (trayWidthFit !== undefined && trayWidthFit < 0);

  const partial = missingFields.length > 0;
  const tight = remainingGvmMargin !== undefined && remainingGvmMargin < 150;
  const uncheckedCriticalItems = !rearAxleChecked || !tyreRatingsChecked || !centreOfGravityChecked;
  const status = exceeded ? 'red' : partial || tight || uncheckedCriticalItems ? 'amber' : 'green';
  const statusLabel = status === 'red'
    ? 'Not recommended'
    : partial
      ? 'Partial estimate'
    : status === 'amber'
      ? 'Needs review'
      : 'Looks suitable';
  const title = status === 'red'
    ? `Not recommended on this ${partial ? 'partial ' : ''}estimate`
    : partial
      ? 'Results available — add the missing details'
    : status === 'amber'
      ? 'Needs review on this estimate'
      : 'Appears suitable based on the information entered';

  const notes = [];
  if (partial) notes.push(`Add ${missingFields.join(', ')} to complete the estimate.`);
  if (remainingGvmMargin !== undefined && remainingGvmMargin < 0) notes.push(`Estimated loaded vehicle weight is ${kg(Math.abs(remainingGvmMargin))} over GVM.`);
  if (estimatedLoadedCamperWeight !== undefined && availablePayloadBeforeCamper !== undefined && estimatedLoadedCamperWeight > availablePayloadBeforeCamper) notes.push(`Estimated loaded camper weight is ${kg(estimatedLoadedCamperWeight - availablePayloadBeforeCamper)} over available payload before camper.`);
  if (trayLengthFit !== undefined && trayLengthFit < 0) notes.push(`Tray length is ${trayLength} mm, below the required ${requiredTrayLength} mm entered.`);
  if (trayWidthFit !== undefined && trayWidthFit < 0) notes.push(`Tray width is ${trayWidth} mm, below the required ${requiredTrayWidth} mm entered.`);
  if (!exceeded && tight) notes.push('Remaining GVM margin is tight. Small additions may change the result.');
  if (!rearAxleChecked) notes.push('Rear axle limits have not been confirmed.');
  if (!tyreRatingsChecked) notes.push('Tyre ratings have not been confirmed.');
  if (!centreOfGravityChecked) notes.push('Centre of gravity has not been confirmed.');
  notes.push(SLIDE_ON_FINAL_WARNING);
  notes.push(ESTIMATE_DISCLAIMER);

  return {
    status,
    statusLabel,
    title,
    summary: estimatedLoadedVehicleWeight !== undefined
      ? `Estimated loaded vehicle weight is ${kg(estimatedLoadedVehicleWeight)} against a ${kg(vehicleGvm)} GVM.`
      : 'The results below update as soon as each calculation has enough information.',
    recommendation: partial
      ? 'Add the missing details, then confirm the final result with Beyond RV.'
      : 'Confirm the final result with Beyond RV.',
    dataQuality: partial
      ? `Partial estimate: add ${missingFields.join(', ')}`
      : 'Complete estimate; Product data incomplete: Beyond RV must confirm product weights; Weighbridge required: actual loaded weights needed',
    notes,
    values: {
      vehiclePayloadBeforeAdditions,
      additionalVehicleLoad,
      availablePayloadBeforeCamper,
      estimatedLoadedCamperWeight,
      estimatedLoadedVehicleWeight,
      remainingGvmMargin,
      trayLengthFit,
      trayWidthFit,
      trayLength: trayLength ?? undefined,
      trayWidth: trayWidth ?? undefined,
      requiredTrayLength: requiredTrayLength ?? undefined,
      requiredTrayWidth: requiredTrayWidth ?? undefined
    }
  };
}
