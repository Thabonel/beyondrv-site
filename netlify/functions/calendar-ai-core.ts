/**
 * Reading dates out of the mailbox.
 *
 * A supplier writes "the container lands on the 18th". A customer writes "we
 * will drive up Saturday morning". Both are dates the business needs on the
 * calendar, and both used to live only in the email. This module is the pure
 * part of getting them out: the schema the model must answer in, the prompt,
 * the checks a candidate has to pass, and the rule that catches a supplier's
 * date disagreeing with the one on the product.
 *
 * The scheduled job in google-gmail-calendar-sync does the I/O.
 */

import { addMinutes, DEFAULT_DURATION_MINUTES, isIsoDate, isWallTime } from './calendar-events-core.ts';
import { STORE_KINDS, type CompanyCalendarEvent, type StoreEventKind } from './calendar-store-core.ts';

const MODEL_ALLOWLIST = new Set(['gpt-5.4-nano', 'gpt-5.6-luna', 'gpt-5.6-terra']);

export function calendarAiConfig() {
  const model = process.env.OPENAI_CALENDAR_MODEL;
  return {
    model: model && MODEL_ALLOWLIST.has(model) ? model : 'gpt-5.4-nano',
    reasoning: 'none' as const,
    /** Messages per run. Keeps a run inside one function timeout and one cent. */
    maxMessages: 40,
    /** Only recent mail; anything older was either handled or is stale. */
    lookbackDays: 14,
    minConfidence: 0.6,
  };
}

export const BUSINESS_HOURS_TEXT = 'Monday to Saturday 08:00 to 17:00, lunch 12:00 to 13:00, Sunday by arrangement.';

export interface CalendarCandidate {
  title: string;
  kind: StoreEventKind;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  confidence: number;
  sourceExcerpt: string;
  relatedOrderId: string;
  relatedProductSlug: string;
  relatedCustomerEmail: string;
  reasoning: string;
}

export interface ExtractionContext {
  /** Brisbane date, YYYY-MM-DD. */
  today: string;
  orders: ReadonlyArray<{ id: string; customerName: string; customerEmail: string; productSlug: string; productTitle: string; status: string }>;
  products: ReadonlyArray<{ slug: string; title: string; containerEtaDate: string }>;
}

export interface CalendarMessage {
  threadId: string;
  messageId: string;
  fromEmail: string;
  subject: string;
  bodyText: string;
  snippet: string;
  receivedAt: string;
}

export function calendarExtractionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'kind', 'date', 'startTime', 'endTime', 'allDay', 'confidence', 'sourceExcerpt', 'relatedOrderId', 'relatedProductSlug', 'relatedCustomerEmail', 'reasoning'],
          properties: {
            title: { type: 'string', maxLength: 180 },
            kind: { type: 'string', enum: [...STORE_KINDS] },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            startTime: { type: 'string', description: 'HH:MM 24-hour, or empty when the email gives no time' },
            endTime: { type: 'string', description: 'HH:MM 24-hour, or empty' },
            allDay: { type: 'boolean' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            sourceExcerpt: { type: 'string', maxLength: 500 },
            relatedOrderId: { type: 'string', maxLength: 240 },
            relatedProductSlug: { type: 'string', maxLength: 240 },
            relatedCustomerEmail: { type: 'string', maxLength: 320 },
            reasoning: { type: 'string', maxLength: 300 },
          },
        },
      },
    },
  };
}

export function extractionInstructions(context: ExtractionContext) {
  const orders = context.orders.slice(0, 60).map((order) =>
    `- ${order.id} | ${order.customerName} | ${order.customerEmail || 'no email'} | ${order.productTitle}${order.productSlug ? ` (${order.productSlug})` : ''} | ${order.status}`);
  const products = context.products.slice(0, 60).map((product) =>
    `- ${product.slug} | ${product.title} | container ETA ${product.containerEtaDate || 'not set'}`);
  return [
    'You read one email for Beyond RV, an Australian camper and caravan business, and list the dated items in it that belong on the company calendar.',
    `Today in Brisbane is ${context.today}. Business hours: ${BUSINESS_HOURS_TEXT}`,
    '',
    'Return a candidate for each of these, when the email states a specific date:',
    '- A customer saying when they will visit, call, or collect. kind: customer_visit for a visit in person, meeting for a call.',
    '- A supplier or shipping line giving a container, vessel, or arrival date. kind: container_eta.',
    '- A supplier giving a production, dispatch, or delivery date for a vehicle. kind: expected_arrival.',
    '- A meeting, inspection, or appointment with a date. kind: meeting.',
    '- A payment, document, or registration due date. kind: reminder.',
    '',
    'Return nothing for marketing, receipts, newsletters, automated notifications, or dates only quoted from an earlier message in the thread.',
    'Resolve relative wording ("next Tuesday", "the 18th") against the date the email was received. Never invent a time: leave startTime empty and set allDay true when the email gives no time.',
    'Set relatedOrderId only when the sender or the named customer matches an order below. Set relatedProductSlug only when the email names a product below. Leave both empty otherwise; a wrong link is worse than none.',
    'confidence is how sure you are that this is a real, specific, future-facing date that affects the business.',
    '',
    'Open orders:',
    ...(orders.length ? orders : ['- none']),
    '',
    'Products with container ETAs:',
    ...(products.length ? products : ['- none']),
  ].join('\n');
}

export function extractionInput(message: CalendarMessage) {
  return [
    `From: ${message.fromEmail}`,
    `Received: ${message.receivedAt}`,
    `Subject: ${message.subject}`,
    '',
    (message.bodyText || message.snippet || '').slice(0, 6000),
  ].join('\n');
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function daysFrom(today: string, date: string) {
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
}

export interface ValidatedCandidates {
  accepted: CalendarCandidate[];
  rejected: Array<{ candidate: Partial<CalendarCandidate>; reason: string }>;
}

/**
 * The model's answer is a claim, and this is where the claim meets the data.
 * Anything below the confidence floor, outside a sensible window, or pointing
 * at an order or product that does not exist is dropped with a reason, so the
 * audit log says why the calendar stayed quiet.
 */
export function validateCandidates(raw: unknown, context: ExtractionContext, minConfidence = 0.6): ValidatedCandidates {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const list = Array.isArray(record.candidates) ? record.candidates.slice(0, 10) : [];
  const orderIds = new Set(context.orders.map((order) => order.id));
  const productSlugs = new Set(context.products.map((product) => product.slug));
  const accepted: CalendarCandidate[] = [];
  const rejected: ValidatedCandidates['rejected'] = [];

  for (const item of list) {
    const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const kind = clean(value.kind, 40) as StoreEventKind;
    const confidence = Number(value.confidence);
    const candidate: CalendarCandidate = {
      title: clean(value.title, 180),
      kind,
      date: clean(value.date, 10),
      startTime: clean(value.startTime, 5),
      endTime: clean(value.endTime, 5),
      allDay: Boolean(value.allDay) || !clean(value.startTime, 5),
      confidence: Number.isFinite(confidence) ? confidence : 0,
      sourceExcerpt: clean(value.sourceExcerpt, 500),
      relatedOrderId: clean(value.relatedOrderId, 240),
      relatedProductSlug: clean(value.relatedProductSlug, 240),
      relatedCustomerEmail: clean(value.relatedCustomerEmail, 320).toLowerCase(),
      reasoning: clean(value.reasoning, 300),
    };
    const reject = (reason: string) => rejected.push({ candidate, reason });

    if (!candidate.title) { reject('no title'); continue; }
    if (!STORE_KINDS.includes(kind)) { reject(`unknown kind "${kind}"`); continue; }
    if (!isIsoDate(candidate.date)) { reject(`"${candidate.date}" is not a date`); continue; }
    const offset = daysFrom(context.today, candidate.date);
    if (offset < -7) { reject('more than a week in the past'); continue; }
    if (offset > 365) { reject('more than a year away'); continue; }
    if (candidate.confidence < minConfidence) { reject(`confidence ${candidate.confidence.toFixed(2)} below ${minConfidence}`); continue; }
    if (!candidate.allDay && !isWallTime(candidate.startTime)) { reject(`"${candidate.startTime}" is not a time`); continue; }
    if (candidate.endTime && !isWallTime(candidate.endTime)) candidate.endTime = '';
    if (candidate.relatedOrderId && !orderIds.has(candidate.relatedOrderId)) { reject(`order ${candidate.relatedOrderId} does not exist`); continue; }
    if (candidate.relatedProductSlug && !productSlugs.has(candidate.relatedProductSlug)) { reject(`product ${candidate.relatedProductSlug} does not exist`); continue; }

    // The order knows its product; a candidate linked to an order inherits it
    // so the clash rule can match the visit against the right container.
    if (candidate.relatedOrderId && !candidate.relatedProductSlug) {
      const order = context.orders.find((item) => item.id === candidate.relatedOrderId);
      if (order?.productSlug && productSlugs.has(order.productSlug)) candidate.relatedProductSlug = order.productSlug;
    }
    accepted.push(candidate);
  }
  return { accepted, rejected };
}

/** Turns an accepted candidate into the record the store validator accepts. */
export function candidateToEventInput(candidate: CalendarCandidate, message: CalendarMessage): Record<string, unknown> {
  const start = candidate.allDay ? candidate.date : `${candidate.date}T${candidate.startTime}`;
  const end = candidate.allDay
    ? candidate.date
    : candidate.endTime && candidate.endTime > candidate.startTime
      ? `${candidate.date}T${candidate.endTime}`
      : addMinutes(start, DEFAULT_DURATION_MINUTES);
  return {
    title: candidate.title,
    kind: candidate.kind,
    start,
    end,
    allDay: candidate.allDay,
    notes: candidate.reasoning,
    location: '',
    source: 'ai',
    sourceEmail: {
      threadId: message.threadId,
      messageId: message.messageId,
      subject: message.subject,
      from: message.fromEmail,
      excerpt: candidate.sourceExcerpt,
    },
    links: {
      ...(candidate.relatedOrderId ? { orderId: candidate.relatedOrderId } : {}),
      ...(candidate.relatedProductSlug ? { productSlug: candidate.relatedProductSlug } : {}),
    },
  };
}

/**
 * The rule from the incident. A supplier's date for a product that already
 * carries a different ETA is not merely a new event: it is two sources
 * disagreeing about when a vehicle lands, and someone may have booked a flight
 * against the old one.
 */
export function etaDisagreement(candidate: CalendarCandidate, context: ExtractionContext): string {
  if (candidate.kind !== 'container_eta' || !candidate.relatedProductSlug) return '';
  const product = context.products.find((item) => item.slug === candidate.relatedProductSlug);
  if (!product?.containerEtaDate || product.containerEtaDate === candidate.date) return '';
  return `An email gives ${candidate.date} for the ${product.title} container; the product says ${product.containerEtaDate}.`;
}

interface ThreadLike {
  id?: string;
  threadId?: string;
  messageId?: string;
  fromEmail?: string;
  subject?: string;
  bodyText?: string;
  snippet?: string;
  receivedAt?: string;
  messages?: unknown;
  calendarProcessedMessageIds?: unknown;
}

/**
 * Which messages the job has not read yet. Older threads keep a single
 * message on the thread record; newer ones carry a messages array. Both are
 * handled so the first run after this ships does not skip the backlog.
 */
export function selectUnprocessedMessages(threads: ReadonlyArray<Record<string, unknown>>, today: string, lookbackDays: number, max: number) {
  const cutoff = Date.parse(`${today}T00:00:00Z`) - lookbackDays * 86_400_000;
  const selected: CalendarMessage[] = [];
  for (const raw of threads) {
    const thread = raw as ThreadLike;
    const done = new Set(Array.isArray(thread.calendarProcessedMessageIds) ? thread.calendarProcessedMessageIds as string[] : []);
    const threadId = clean(thread.threadId, 240) || clean(thread.id, 240);
    const list = Array.isArray(thread.messages) && thread.messages.length
      ? thread.messages as ThreadLike[]
      : [thread];
    for (const message of list) {
      const messageId = clean(message.messageId, 240);
      if (!messageId || done.has(messageId)) continue;
      const receivedAt = clean(message.receivedAt, 40);
      if (!receivedAt || Number.isNaN(Date.parse(receivedAt)) || Date.parse(receivedAt) < cutoff) continue;
      selected.push({
        threadId,
        messageId,
        fromEmail: clean(message.fromEmail ?? thread.fromEmail, 320),
        subject: clean(message.subject ?? thread.subject, 500),
        bodyText: clean(message.bodyText, 12_000),
        snippet: clean(message.snippet, 1000),
        receivedAt,
      });
      if (selected.length >= max) return selected;
    }
  }
  return selected;
}

export type { CompanyCalendarEvent };
