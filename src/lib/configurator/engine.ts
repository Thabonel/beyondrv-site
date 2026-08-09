import type {
  CatalogueValidation,
  ConfigurationCustomItem,
  ConfigurationEvaluation,
  ConfigurationIssue,
  ConfigurationSelection,
  ConfiguratorCatalogue,
  ResolvedConfigurationSelection,
} from './types.ts';

function integer(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function optionQuantity(selection: ConfigurationSelection, min = 1, max = 1) {
  return Math.min(max, Math.max(min, integer(selection.quantity, min)));
}

function pushIssue(target: ConfigurationIssue[], issue: ConfigurationIssue) {
  if (!target.some(existing => existing.code === issue.code && existing.ruleId === issue.ruleId && existing.optionId === issue.optionId)) {
    target.push(issue);
  }
}

function issueTarget(evaluation: Pick<ConfigurationEvaluation, 'errors' | 'warnings' | 'information'>, severity: ConfigurationIssue['severity']) {
  if (severity === 'hard') return evaluation.errors;
  if (severity === 'warning') return evaluation.warnings;
  return evaluation.information;
}

export function validateConfiguratorCatalogue(catalogue: ConfiguratorCatalogue): CatalogueValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const categoryIds = new Set<string>();
  const modelIds = new Set<string>();
  const optionIds = new Set<string>();

  if (!catalogue.schemaVersion) errors.push('Catalogue schemaVersion is required.');
  if (!catalogue.catalogueVersion) errors.push('Catalogue catalogueVersion is required.');

  for (const category of catalogue.categories) {
    if (!category.id || !category.name) errors.push('Every category requires an id and name.');
    if (categoryIds.has(category.id)) errors.push(`Duplicate category id: ${category.id}.`);
    categoryIds.add(category.id);
  }

  for (const model of catalogue.models) {
    if (!model.id || !model.name || !model.productSlug) errors.push('Every model requires an id, productSlug and name.');
    if (modelIds.has(model.id)) errors.push(`Duplicate model id: ${model.id}.`);
    if (!Number.isInteger(model.basePriceCents) || model.basePriceCents < 0) errors.push(`Model ${model.id} has an invalid base price.`);
    if (!model.orderProcess?.availability || !model.orderProcess?.buildStartsOn || !model.orderProcess?.customerSummary) errors.push(`Model ${model.id} is missing its order process.`);
    if (model.orderProcess?.availability === 'made_to_order' && !['deposit_paid', 'owner_confirmation'].includes(model.orderProcess.buildStartsOn)) errors.push(`Made-to-order model ${model.id} is missing a valid build trigger.`);
    if (model.visualAsset) {
      const safeAssetUrl = (value: string) => !value || value.startsWith('/') || /^https:\/\//i.test(value);
      if (!safeAssetUrl(model.visualAsset.glbUrl) || !safeAssetUrl(model.visualAsset.posterUrl)) errors.push(`Model ${model.id} has an unsafe visual asset URL.`);
      if (model.visualAsset.status === 'ready' && !model.visualAsset.glbUrl) errors.push(`Model ${model.id} is marked visual-ready without a GLB URL.`);
      if (!Number.isInteger(model.visualAsset.maxBytes) || model.visualAsset.maxBytes <= 0 || model.visualAsset.maxBytes > 25 * 1024 * 1024) errors.push(`Model ${model.id} has an invalid visual asset size limit.`);
      if (!Array.isArray(model.visualAsset.bindings) || !Array.isArray(model.visualAsset.hotspots)) errors.push(`Model ${model.id} visual bindings and hotspots must be arrays.`);
    }
    modelIds.add(model.id);
  }

  for (const option of catalogue.options) {
    if (!option.id || !option.name) errors.push('Every option requires an id and name.');
    if (optionIds.has(option.id)) errors.push(`Duplicate option id: ${option.id}.`);
    if (!categoryIds.has(option.categoryId)) errors.push(`Option ${option.id} references unknown category ${option.categoryId}.`);
    if (!Number.isInteger(option.retailPriceDeltaCents) || option.retailPriceDeltaCents < 0) errors.push(`Option ${option.id} has an invalid retail price.`);
    for (const modelId of option.modelIds) if (!modelIds.has(modelId)) errors.push(`Option ${option.id} references unknown model ${modelId}.`);
    if (option.selectionMode === 'quantity' && integer(option.maxQuantity) < Math.max(1, integer(option.minQuantity, 1))) {
      errors.push(`Option ${option.id} has an invalid quantity range.`);
    }
    optionIds.add(option.id);
  }

  for (const model of catalogue.models) {
    for (const optionId of [...model.standardOptionIds, ...model.defaultOptionIds]) {
      if (!optionIds.has(optionId)) errors.push(`Model ${model.id} references unknown default or standard option ${optionId}.`);
    }
    for (const binding of Array.isArray(model.visualAsset?.bindings) ? model.visualAsset.bindings : []) {
      if (!optionIds.has(binding.optionId)) errors.push(`Model ${model.id} visual binding references unknown option ${binding.optionId}.`);
      if (!Array.isArray(binding.nodeNames) || !binding.nodeNames.length || binding.nodeNames.some(name => typeof name !== 'string' || !name.trim())) errors.push(`Model ${model.id} has a visual binding without valid node names.`);
    }
    for (const hotspot of Array.isArray(model.visualAsset?.hotspots) ? model.visualAsset.hotspots : []) {
      if (!hotspot.id || !hotspot.label || !Array.isArray(hotspot.position) || hotspot.position.length !== 3 || hotspot.position.some(value => !Number.isFinite(value))) errors.push(`Model ${model.id} has an invalid visual hotspot.`);
    }
  }

  for (const rule of catalogue.rules) {
    if (!optionIds.has(rule.whenOptionId)) errors.push(`Rule ${rule.id} references unknown trigger option ${rule.whenOptionId}.`);
    for (const targetId of rule.targetOptionIds) if (!optionIds.has(targetId)) errors.push(`Rule ${rule.id} references unknown target option ${targetId}.`);
    if (!rule.targetOptionIds.length && rule.type !== 'warning_when') errors.push(`Rule ${rule.id} requires at least one target option.`);
  }

  if (!catalogue.rules.length) warnings.push('No technical compatibility rules are approved yet.');
  if (catalogue.readiness === 'development_seed') warnings.push('Catalogue is a development seed and is not approved for customer use.');
  if (catalogue.readiness === 'owner_review') warnings.push('Catalogue retail prices are owner-reviewed, but the catalogue is not yet approved for contract use.');
  if (catalogue.options.some(option => option.internalCostDeltaCents === null)) warnings.push('Some option costs are unknown.');
  if (catalogue.options.some(option => option.weightDeltaKg === null)) warnings.push('Some option weights are unknown.');
  if (catalogue.models.some(model => model.priceVerificationStatus === 'unverified')) warnings.push('Some models remain inactive until their base prices are confirmed.');

  return { valid: errors.length === 0, errors, warnings };
}

export function evaluateConfiguration(
  catalogue: ConfiguratorCatalogue,
  modelId: string,
  requestedSelections: ConfigurationSelection[] = [],
  customItems: ConfigurationCustomItem[] = [],
): ConfigurationEvaluation {
  const model = catalogue.models.find(item => item.id === modelId && item.active) ?? null;
  const result: ConfigurationEvaluation = {
    valid: false,
    model,
    selections: [],
    errors: [],
    warnings: [],
    information: [],
    appliedRuleIds: [],
    pricing: {
      basePriceCents: model?.basePriceCents ?? 0,
      optionsTotalCents: 0,
      customItemsTotalCents: 0,
      discountsTotalCents: 0,
      configuredTotalCents: model?.basePriceCents ?? 0,
      internalCostCents: null,
      marginCents: null,
      costStatus: 'unknown',
    },
    weight: {
      baseWeightKg: model?.baseWeightKg ?? null,
      optionsDeltaKg: null,
      customDeltaKg: null,
      configuredWeightKg: null,
      status: 'unknown',
    },
  };

  if (!model) {
    result.errors.push({ code: 'UNKNOWN_MODEL', message: 'Select an active configurable model.', severity: 'hard' });
    return result;
  }

  const availableOptions = new Map(catalogue.options.filter(option => option.active && option.modelIds.includes(model.id)).map(option => [option.id, option]));
  const quantities = new Map<string, number>();
  const automatic = new Set<string>();

  for (const optionId of [...model.standardOptionIds, ...model.defaultOptionIds]) {
    if (availableOptions.has(optionId)) {
      quantities.set(optionId, 1);
      automatic.add(optionId);
    }
  }

  for (const selection of requestedSelections) {
    const option = availableOptions.get(selection.optionId);
    if (!option) {
      pushIssue(result.errors, {
        code: 'OPTION_NOT_AVAILABLE',
        message: `Option ${selection.optionId || '(missing id)'} is not available for ${model.name}.`,
        severity: 'hard',
        optionId: selection.optionId,
      });
      continue;
    }
    const max = option.selectionMode === 'quantity' ? Math.max(1, integer(option.maxQuantity, 1)) : 1;
    const min = option.selectionMode === 'quantity' ? Math.max(1, integer(option.minQuantity, 1)) : 1;
    const quantity = optionQuantity(selection, min, max);
    if (integer(selection.quantity, 1) !== quantity) {
      pushIssue(result.warnings, {
        code: 'QUANTITY_ADJUSTED',
        message: `${option.name} quantity was adjusted to the permitted range ${min}–${max}.`,
        severity: 'warning',
        optionId: option.id,
      });
    }
    quantities.set(option.id, quantity);
  }

  for (let pass = 0; pass < 20; pass += 1) {
    let changed = false;
    for (const rule of catalogue.rules) {
      if (!quantities.has(rule.whenOptionId)) continue;
      const selectedTargets = rule.targetOptionIds.filter(targetId => quantities.has(targetId));

      if ((rule.type === 'requires_all' || rule.type === 'auto_select') && selectedTargets.length !== rule.targetOptionIds.length && rule.autoResolve) {
        for (const targetId of rule.targetOptionIds) {
          if (!quantities.has(targetId) && availableOptions.has(targetId)) {
            quantities.set(targetId, 1);
            automatic.add(targetId);
            changed = true;
          }
        }
        result.appliedRuleIds.push(rule.id);
      }

      if (rule.type === 'requires_any' && selectedTargets.length === 0 && rule.autoResolve) {
        const targetId = rule.targetOptionIds.find(id => availableOptions.has(id));
        if (targetId) {
          quantities.set(targetId, 1);
          automatic.add(targetId);
          changed = true;
          result.appliedRuleIds.push(rule.id);
        }
      }

      if (rule.type === 'auto_remove' && selectedTargets.length && rule.autoResolve) {
        for (const targetId of selectedTargets) quantities.delete(targetId);
        changed = true;
        result.appliedRuleIds.push(rule.id);
      }
    }
    if (!changed) break;
    if (pass === 19) result.errors.push({ code: 'RULE_RESOLUTION_LIMIT', message: 'Configuration rules could not be resolved safely.', severity: 'hard' });
  }

  for (const rule of catalogue.rules) {
    if (!quantities.has(rule.whenOptionId)) continue;
    const selectedTargets = rule.targetOptionIds.filter(targetId => quantities.has(targetId));
    let violated = false;
    if (rule.type === 'requires_all') violated = selectedTargets.length !== rule.targetOptionIds.length;
    if (rule.type === 'requires_any') violated = selectedTargets.length === 0;
    if (rule.type === 'excludes') violated = selectedTargets.length > 0;
    if (rule.type === 'warning_when') violated = true;
    if (!violated) continue;
    const target = issueTarget(result, rule.severity);
    pushIssue(target, { code: `RULE_${rule.type.toUpperCase()}`, message: rule.adminMessage, severity: rule.severity, ruleId: rule.id, optionId: rule.whenOptionId });
  }

  const categoryOrder = new Map(catalogue.categories.map(category => [category.id, category.sortOrder]));
  result.selections = [...quantities.entries()]
    .map(([optionId, quantity]): ResolvedConfigurationSelection | null => {
      const option = availableOptions.get(optionId);
      if (!option) return null;
      return {
        optionId,
        quantity,
        option,
        retailTotalCents: option.retailPriceDeltaCents * quantity,
        internalCostTotalCents: option.internalCostDeltaCents === null ? null : option.internalCostDeltaCents * quantity,
        weightTotalKg: option.weightDeltaKg === null ? null : option.weightDeltaKg * quantity,
        automaticallySelected: automatic.has(optionId),
      };
    })
    .filter((selection): selection is ResolvedConfigurationSelection => Boolean(selection))
    .sort((left, right) => (categoryOrder.get(left.option.categoryId) ?? 999) - (categoryOrder.get(right.option.categoryId) ?? 999) || left.option.sortOrder - right.option.sortOrder);

  const optionsTotalCents = result.selections.reduce((sum, selection) => sum + selection.retailTotalCents, 0);
  const customItemsTotalCents = customItems.filter(item => item.kind === 'custom').reduce((sum, item) => sum + Math.max(0, integer(item.retailPriceCents)), 0);
  const discountsTotalCents = customItems.filter(item => item.kind === 'discount').reduce((sum, item) => sum + Math.max(0, integer(item.retailPriceCents)), 0);
  const configuredTotalCents = Math.max(0, model.basePriceCents + optionsTotalCents + customItemsTotalCents - discountsTotalCents);

  const knownOptionCosts = result.selections.filter(selection => selection.internalCostTotalCents !== null);
  const knownCustomCosts = customItems.filter(item => item.kind === 'custom' && item.internalCostCents !== null);
  const anyCostKnown = model.baseCostCents !== null || knownOptionCosts.length > 0 || knownCustomCosts.length > 0;
  const allCostsKnown = model.baseCostCents !== null
    && knownOptionCosts.length === result.selections.length
    && knownCustomCosts.length === customItems.filter(item => item.kind === 'custom').length;
  const internalCostCents = anyCostKnown
    ? (model.baseCostCents ?? 0)
      + knownOptionCosts.reduce((sum, selection) => sum + (selection.internalCostTotalCents ?? 0), 0)
      + knownCustomCosts.reduce((sum, item) => sum + (item.internalCostCents ?? 0), 0)
    : null;

  result.pricing = {
    basePriceCents: model.basePriceCents,
    optionsTotalCents,
    customItemsTotalCents,
    discountsTotalCents,
    configuredTotalCents,
    internalCostCents,
    marginCents: allCostsKnown && internalCostCents !== null ? configuredTotalCents - internalCostCents : null,
    costStatus: allCostsKnown ? 'known' : anyCostKnown ? 'partial' : 'unknown',
  };

  const knownOptionWeights = result.selections.filter(selection => selection.weightTotalKg !== null);
  const knownCustomWeights = customItems.filter(item => item.kind === 'custom' && item.weightDeltaKg !== null);
  const customWeightItems = customItems.filter(item => item.kind === 'custom');
  const anyWeightKnown = model.baseWeightKg !== null || knownOptionWeights.length > 0 || knownCustomWeights.length > 0;
  const allWeightsKnown = model.baseWeightKg !== null
    && knownOptionWeights.length === result.selections.length
    && knownCustomWeights.length === customWeightItems.length;
  const optionsDeltaKg = knownOptionWeights.length ? knownOptionWeights.reduce((sum, selection) => sum + (selection.weightTotalKg ?? 0), 0) : null;
  const customDeltaKg = knownCustomWeights.length ? knownCustomWeights.reduce((sum, item) => sum + (item.weightDeltaKg ?? 0), 0) : null;
  result.weight = {
    baseWeightKg: model.baseWeightKg,
    optionsDeltaKg,
    customDeltaKg,
    configuredWeightKg: allWeightsKnown ? (model.baseWeightKg ?? 0) + (optionsDeltaKg ?? 0) + (customDeltaKg ?? 0) : null,
    status: allWeightsKnown ? 'known' : anyWeightKnown ? 'partial' : 'unknown',
  };

  for (const item of customItems) {
    if (!item.description.trim()) result.errors.push({ code: 'CUSTOM_ITEM_DESCRIPTION', message: 'Every custom item or discount needs a description.', severity: 'hard' });
    if (!item.reason.trim()) result.errors.push({ code: 'CUSTOM_ITEM_REASON', message: `${item.description || 'Custom item'} needs an owner-entered reason.`, severity: 'hard' });
    if (item.kind === 'custom' && integer(item.retailPriceCents) <= 0) result.errors.push({ code: 'CUSTOM_ALTERATION_PRICE', message: `${item.description || 'Custom alteration'} must have a positive customer charge.`, severity: 'hard' });
    if (item.kind === 'custom' && !item.visualBrief.trim()) result.errors.push({ code: 'CUSTOM_ALTERATION_VISUAL_BRIEF', message: `${item.description || 'Custom alteration'} needs a visual brief for the 3D drawing.`, severity: 'hard' });
    if (item.kind === 'custom' && item.drawingStatus !== 'approved') result.errors.push({ code: 'CUSTOM_ALTERATION_DRAWING_APPROVAL', message: `${item.description || 'Custom alteration'} cannot be approved until its 3D drawing is approved.`, severity: 'hard' });
  }

  result.valid = result.errors.length === 0;
  return result;
}
