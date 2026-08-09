import type { AgreementAcceptance, AcceptanceMethod } from './contract-core.ts';

function text(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cents(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function termsApprovedForCustomerUse(termsVersion: string) {
  return Boolean(termsVersion) && process.env.CONTRACT_TERMS_APPROVED_VERSION === termsVersion;
}

export function acceptanceMethodLabel(method: AcceptanceMethod) {
  if (method === 'hand_signed_copy') return 'Hand-signed copy returned by email';
  if (method === 'deposit_payment') return 'Deposit payment after receipt of the complete agreement';
  if (method === 'email_confirmation') return 'Explicit acceptance received by email';
  return 'Not recorded';
}

export function validateAcceptanceEvidence(
  input: Record<string, unknown>,
  options: { expectedEmail: string; depositDueCents?: number; allowDeposit: boolean },
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const method = ['hand_signed_copy', 'deposit_payment', 'email_confirmation'].includes(String(input.method))
    ? String(input.method) as AcceptanceMethod
    : '';
  const acceptedByName = text(input.acceptedByName, 180);
  const acceptedByEmail = text(input.acceptedByEmail, 240).toLowerCase();
  const acceptedAt = text(input.acceptedAt, 80);
  const evidenceReference = text(input.evidenceReference, 1000);
  const depositAmountCents = cents(input.depositAmountCents);
  const depositReference = text(input.depositReference, 300);

  if (!method) errors.push('Select how the customer accepted the agreement.');
  if (method === 'deposit_payment' && !options.allowDeposit) errors.push('Deposit payment cannot be used to accept this document.');
  if (!acceptedByName) errors.push('Record the accepting customer’s name.');
  if (!acceptedByEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acceptedByEmail)) errors.push('Record a valid customer email address.');
  if (!acceptedAt || Number.isNaN(Date.parse(acceptedAt))) errors.push('Record the acceptance date and time.');
  if (!evidenceReference) errors.push('Record the Gmail message, signed-copy location, receipt, or other evidence reference.');

  if (method === 'deposit_payment') {
    if (depositAmountCents <= 0) errors.push('Record the deposit amount received.');
    if (!depositReference) errors.push('Record the bank or payment reference.');
    if (options.depositDueCents && depositAmountCents !== options.depositDueCents) {
      warnings.push(`The recorded deposit differs from the scheduled deposit by ${Math.abs(options.depositDueCents - depositAmountCents)} cents.`);
    }
  }
  if (options.expectedEmail && acceptedByEmail && options.expectedEmail.toLowerCase() !== acceptedByEmail) {
    warnings.push('The recorded acceptance email differs from the buyer email on the agreement. Confirm the accepting person’s authority.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    evidence: {
      method,
      acceptedByName,
      acceptedByEmail,
      acceptedAt: acceptedAt ? new Date(acceptedAt).toISOString() : '',
      evidenceReference,
      evidenceNotes: text(input.evidenceNotes, 2000),
      depositAmountCents,
      depositReference,
    },
  };
}

export function markPrepared(acceptance: AgreementAcceptance, now = new Date(), actorUserId = 'legacy-admin'): AgreementAcceptance {
  return {
    ...acceptance,
    status: acceptance.status === 'accepted' ? 'accepted' : 'prepared',
    preparedAt: acceptance.preparedAt || now.toISOString(),
    preparedByUserId: acceptance.preparedByUserId || actorUserId,
  };
}

export function markSent(
  acceptance: AgreementAcceptance,
  sentToEmail: string,
  now = new Date(),
  actorUserId = 'legacy-admin',
): AgreementAcceptance {
  return {
    ...acceptance,
    status: 'sent',
    preparedAt: acceptance.preparedAt || now.toISOString(),
    sentAt: now.toISOString(),
    sentToEmail: sentToEmail.trim().toLowerCase(),
    sentByUserId: actorUserId,
  };
}

export function recordAcceptance(
  acceptance: AgreementAcceptance,
  evidence: ReturnType<typeof validateAcceptanceEvidence>['evidence'],
  now = new Date(),
  actorUserId = 'legacy-admin',
): AgreementAcceptance {
  return {
    ...acceptance,
    status: 'accepted',
    method: evidence.method,
    acceptedAt: evidence.acceptedAt,
    acceptedByName: evidence.acceptedByName,
    acceptedByEmail: evidence.acceptedByEmail,
    evidenceReference: evidence.evidenceReference,
    evidenceNotes: evidence.evidenceNotes,
    depositAmountCents: evidence.depositAmountCents,
    depositReference: evidence.depositReference,
    recordedAt: now.toISOString(),
    recordedBy: actorUserId,
  };
}
