export interface DraftValidationResult {
  warnings: string[];
  blockedPhrases: string[];
}

const UNSUPPORTED_CLAIM_PATTERNS = [
  { pattern: /\b(in stock|available now|ready now|ready for immediate delivery)\b/i, label: 'Stock or availability commitment needs owner confirmation.' },
  { pattern: /\b(deliver(?:y|ed)? by|ready by|built by|will arrive|lead time is)\b/i, label: 'Delivery or build timing commitment needs owner confirmation.' },
  { pattern: /\b(fits your|will fit|is suitable for your|payload is enough|gvm is enough|legally compliant|adr compliant)\b/i, label: 'Vehicle suitability or compliance commitment needs owner confirmation.' },
  { pattern: /\b(warranty is|guaranteed|guarantee that|covered for)\b/i, label: 'Warranty or guarantee commitment needs current owner-approved terms.' },
  { pattern: /\b(finance approved|finance is available|repayments? (?:are|will be)|payment plan)\b/i, label: 'Finance or repayment claims need owner confirmation.' },
  { pattern: /\$\s?\d[\d,]*(?:\.\d{2})?/i, label: 'Exact pricing in drafts needs current quote/catalogue confirmation.' },
];

export function validateDraftOutput(draft: string): DraftValidationResult {
  const warnings: string[] = [];
  const blockedPhrases: string[] = [];

  for (const rule of UNSUPPORTED_CLAIM_PATTERNS) {
    const match = draft.match(rule.pattern);
    if (match?.[0]) {
      warnings.push(rule.label);
      blockedPhrases.push(match[0]);
    }
  }

  return {
    warnings: [...new Set(warnings)],
    blockedPhrases: [...new Set(blockedPhrases)],
  };
}
