import type { ContractRecord } from './contract-core.ts';

export type ContractEmailClassification =
  | 'no_change'
  | 'clarification'
  | 'pre_signature_change'
  | 'post_signature_addendum'
  | 'cancellation_or_removal'
  | 'price_or_delivery_question'
  | 'ambiguous';

export interface ContractChangeExtraction {
  classification: ContractEmailClassification;
  confidence: number;
  customerEmail: string;
  mentionedContractNumber: string;
  mentionedProduct: string;
  requestedChanges: Array<{
    action: 'add' | 'remove' | 'replace' | 'clarify';
    item: string;
    previousValue: string;
    requestedValue: string;
    sourceExcerpt: string;
    needsPriceConfirmation: boolean;
    needsDeliveryConfirmation: boolean;
  }>;
  unresolvedQuestions: string[];
  ownerSummary: string;
}

const MODEL_ALLOWLIST = new Set(['gpt-5.4-nano', 'gpt-5.6-luna', 'gpt-5.6-terra']);

function configuredModel(value: string | undefined, fallback: string) {
  return value && MODEL_ALLOWLIST.has(value) ? value : fallback;
}

function reasoning(value: string | undefined, fallback: 'none' | 'low' | 'medium') {
  return ['none', 'low', 'medium'].includes(value || '') ? value as 'none' | 'low' | 'medium' : fallback;
}

export function contractAiConfig() {
  return {
    triage: {
      model: configuredModel(process.env.OPENAI_CONTRACT_TRIAGE_MODEL, 'gpt-5.4-nano'),
      reasoning: reasoning(process.env.OPENAI_CONTRACT_TRIAGE_REASONING, 'none'),
      costTier: 'lowest',
    },
    work: {
      model: configuredModel(process.env.OPENAI_CONTRACT_WORK_MODEL, 'gpt-5.6-luna'),
      reasoning: reasoning(process.env.OPENAI_CONTRACT_WORK_REASONING, 'low'),
      costTier: 'low-cost contract work',
    },
    escalation: {
      model: configuredModel(process.env.OPENAI_CONTRACT_ESCALATION_MODEL, 'gpt-5.6-terra'),
      reasoning: reasoning(process.env.OPENAI_CONTRACT_ESCALATION_REASONING, 'medium'),
      costTier: 'higher-cost careful review',
    },
    preapprovedWorkRouting: process.env.OPENAI_CONTRACT_PREAPPROVE_WORK_ROUTING === 'true',
  };
}

export function modelChangePrompt(from: 'triage' | 'work', reason: string) {
  const config = contractAiConfig();
  const current = config[from];
  const recommended = from === 'triage' ? config.work : config.escalation;
  return {
    required: from === 'work' || !config.preapprovedWorkRouting,
    fromTier: from,
    toTier: from === 'triage' ? 'work' : 'escalation',
    currentModel: current.model,
    currentCostTier: current.costTier,
    recommendedModel: recommended.model,
    recommendedCostTier: recommended.costTier,
    reason: reason.slice(0, 500),
    alternatives: from === 'triage'
      ? ['Keep the message for manual review without another model call.', 'Reject or mark it informational.']
      : ['Keep the current extraction and resolve uncertainties manually.', 'Reject the draft action.'],
  };
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function confidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function validateContractChangeExtraction(value: unknown): ContractChangeExtraction | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const classifications: ContractEmailClassification[] = ['no_change', 'clarification', 'pre_signature_change', 'post_signature_addendum', 'cancellation_or_removal', 'price_or_delivery_question', 'ambiguous'];
  const classification = classifications.includes(record.classification as ContractEmailClassification)
    ? record.classification as ContractEmailClassification
    : 'ambiguous';
  const requestedChanges = Array.isArray(record.requestedChanges) ? record.requestedChanges.slice(0, 30).map(item => {
    const change = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const action = ['add', 'remove', 'replace', 'clarify'].includes(String(change.action))
      ? change.action as ContractChangeExtraction['requestedChanges'][number]['action']
      : 'clarify';
    return {
      action,
      item: clean(change.item, 300),
      previousValue: clean(change.previousValue, 1000),
      requestedValue: clean(change.requestedValue, 1000),
      sourceExcerpt: clean(change.sourceExcerpt, 1000),
      needsPriceConfirmation: true,
      needsDeliveryConfirmation: true,
    };
  }).filter(change => change.item || change.requestedValue) : [];
  return {
    classification,
    confidence: confidence(record.confidence),
    customerEmail: clean(record.customerEmail, 320).toLowerCase(),
    mentionedContractNumber: clean(record.mentionedContractNumber, 120),
    mentionedProduct: clean(record.mentionedProduct, 300),
    requestedChanges,
    unresolvedQuestions: Array.isArray(record.unresolvedQuestions) ? record.unresolvedQuestions.map(item => clean(item, 500)).filter(Boolean).slice(0, 20) : [],
    ownerSummary: clean(record.ownerSummary, 1500),
  };
}

export function contractChangeExtractionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['classification', 'confidence', 'customerEmail', 'mentionedContractNumber', 'mentionedProduct', 'requestedChanges', 'unresolvedQuestions', 'ownerSummary'],
    properties: {
      classification: { type: 'string', enum: ['no_change', 'clarification', 'pre_signature_change', 'post_signature_addendum', 'cancellation_or_removal', 'price_or_delivery_question', 'ambiguous'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      customerEmail: { type: 'string', maxLength: 320 },
      mentionedContractNumber: { type: 'string', maxLength: 120 },
      mentionedProduct: { type: 'string', maxLength: 300 },
      requestedChanges: {
        type: 'array', maxItems: 30,
        items: {
          type: 'object', additionalProperties: false,
          required: ['action', 'item', 'previousValue', 'requestedValue', 'sourceExcerpt', 'needsPriceConfirmation', 'needsDeliveryConfirmation'],
          properties: {
            action: { type: 'string', enum: ['add', 'remove', 'replace', 'clarify'] },
            item: { type: 'string', maxLength: 300 },
            previousValue: { type: 'string', maxLength: 1000 },
            requestedValue: { type: 'string', maxLength: 1000 },
            sourceExcerpt: { type: 'string', maxLength: 1000 },
            needsPriceConfirmation: { type: 'boolean' },
            needsDeliveryConfirmation: { type: 'boolean' },
          },
        },
      },
      unresolvedQuestions: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 500 } },
      ownerSummary: { type: 'string', maxLength: 1500 },
    },
  };
}

export function deterministicContractEmailTriage(subject: string, body: string, contract?: ContractRecord | null) {
  const content = `${subject}\n${body}`.toLowerCase();
  const changeSignal = /\b(change|swap|replace|remove|delete|cancel|add|include|upgrade|downgrade|instead|different|amend|variation|modify)\b/.test(content);
  const questionSignal = /\b(price|cost|payment|delivery|arrival|when|how much)\b/.test(content) && /\?|\b(can you|could you|please confirm)\b/.test(content);
  const clarificationSignal = /\b(confirm|clarify|what does|does this mean|question about)\b/.test(content);
  if (!changeSignal && !questionSignal && !clarificationSignal) return { classification: 'no_change' as const, material: false, reason: 'No explicit contract-change, price, delivery, or clarification signal was found.' };
  if (!contract) return { classification: 'ambiguous' as const, material: true, reason: 'The message may concern a contract, but no single contract was safely matched.' };
  if (/\b(cancel|remove|delete)\b/.test(content)) return { classification: 'cancellation_or_removal' as const, material: true, reason: 'The customer appears to request a cancellation or removal.' };
  if (changeSignal) return {
    classification: contract.status === 'signed' ? 'post_signature_addendum' as const : 'pre_signature_change' as const,
    material: true,
    reason: contract.status === 'signed' ? 'A change is requested against a signed contract.' : 'A change is requested before contract completion.',
  };
  if (questionSignal) return { classification: 'price_or_delivery_question' as const, material: false, reason: 'The message asks about price, payment, or delivery without a clear change instruction.' };
  return { classification: 'clarification' as const, material: false, reason: 'The message appears to ask for clarification only.' };
}

export function matchEmailToContracts(fromEmail: string, subject: string, body: string, contracts: ContractRecord[]) {
  const content = `${subject}\n${body}`.toLowerCase();
  const sender = fromEmail.trim().toLowerCase();
  const exactNumber = contracts.filter(contract => content.includes(contract.contractNumber.toLowerCase()));
  const currentNumberVersion = exactNumber.filter(contract => !['cancelled', 'superseded'].includes(contract.status));
  if (currentNumberVersion.length === 1) return { contract: currentNumberVersion[0], confidence: 1, method: 'contract_number', ambiguous: false };
  if (exactNumber.length === 1) return { contract: exactNumber[0], confidence: 1, method: 'contract_number', ambiguous: false };
  if (exactNumber.length > 1) return { contract: null, confidence: 0, method: 'contract_number', ambiguous: true };
  const exactEmail = contracts.filter(contract => contract.buyer.email.trim().toLowerCase() === sender && !['cancelled', 'superseded'].includes(contract.status));
  if (exactEmail.length === 1) return { contract: exactEmail[0], confidence: 0.95, method: 'buyer_email', ambiguous: false };
  return { contract: null, confidence: 0, method: exactEmail.length > 1 ? 'buyer_email' : 'none', ambiguous: exactEmail.length > 1 };
}
