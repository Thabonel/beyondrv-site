export type SalesOutcome = 'no_answer' | 'follow_up' | 'not_proceeding' | 'visit_booked' | 'agreement_in_progress';

export interface SalesOutcomeInput {
  outcome: SalesOutcome;
  followUpAt?: string;
  lossReason?: string;
  note?: string;
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function dateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function twoDaysLater(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));
  return date.toISOString().slice(0, 10);
}

export function applySalesOutcome(existing: Record<string, unknown> | null, input: SalesOutcomeInput, now = new Date()) {
  const outcome = input.outcome;
  const note = clean(input.note, 4000);
  const requestedDate = dateOnly(clean(input.followUpAt, 10));
  const lossReason = clean(input.lossReason, 80);
  if (!['no_answer', 'follow_up', 'not_proceeding', 'visit_booked', 'agreement_in_progress'].includes(outcome)) {
    throw new Error('Unsupported sales outcome.');
  }
  if (outcome === 'follow_up' || outcome === 'visit_booked') {
    if (!requestedDate) throw new Error('Choose the promised follow-up or visit date.');
  }
  if (outcome === 'not_proceeding' && !lossReason) throw new Error('Choose a reason the customer is not proceeding.');

  const nextFollowUpDate = outcome === 'no_answer' ? twoDaysLater(now)
    : outcome === 'follow_up' || outcome === 'visit_booked' ? requestedDate
      : '';
  const status = outcome === 'not_proceeding' ? 'lost'
    : outcome === 'agreement_in_progress' ? 'quoted'
      : 'follow-up-scheduled';
  const labels: Record<SalesOutcome, string> = {
    no_answer: 'No answer — follow up scheduled',
    follow_up: 'Spoke — follow up scheduled',
    not_proceeding: 'Not proceeding',
    visit_booked: 'Visit booked',
    agreement_in_progress: 'Agreement in progress',
  };
  return {
    leadStatus: {
      ...existing,
      status,
      nextFollowUpDate,
      outcomeReason: outcome === 'not_proceeding' ? lossReason : '',
      lastContactedAt: now.toISOString(),
      appointmentAt: outcome === 'visit_booked' ? requestedDate : '',
      notes: note || clean(existing?.notes, 4000),
      updatedAt: now.toISOString(),
    },
    summary: labels[outcome],
    nextFollowUpDate,
  };
}
