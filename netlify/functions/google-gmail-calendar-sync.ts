/**
 * Every fifteen minutes: read what the mailbox sync has stored, ask the model
 * which dated items are in each new message, and put them on the calendar.
 *
 * Writes straight to the calendar rather than into a review queue, by the
 * owner's decision. Everything it writes carries the email it came from, so the
 * GM can see why an item is there and dismiss it in one click, and a dismissed
 * item stays dismissed.
 *
 * The one thing it does beyond adding events: when a supplier's date for a
 * product disagrees with the ETA on the product, it says so. That is the
 * comparison nobody made the day a customer flew to an empty yard.
 */
import OpenAI from 'openai';
import type { Handler, HandlerResponse } from '@netlify/functions';
import { connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  calendarAiConfig,
  calendarExtractionSchema,
  candidateToEventInput,
  etaDisagreement,
  extractionInput,
  extractionInstructions,
  selectUnprocessedMessages,
  validateCandidates,
  type ExtractionContext,
} from './calendar-ai-core';
import { CALENDAR_EVENT_STORE, calendarEventKey, isDuplicate, validateEvent, type CompanyCalendarEvent } from './calendar-store-core';
import { appendGoogleAudit, getGoogleConnection, googleOAuthConfig, publicGoogleConnectionState } from './google-oauth-core';
import { gmailThreadKey, OWNER_COPILOT_GMAIL_THREAD_STORE } from './owner-copilot-core';
import { appendOwnerTimeline, listJsonStore } from './owner-copilot-store-utils';
import catalogue from './product-catalogue.json';

export const config = {
  schedule: '*/15 * * * *',
};

const ORDER_STORE = 'customer-orders';
const OPEN_ORDER_STATUSES = new Set(['deposit_received', 'factory_ordered', 'in_production', 'in_transit', 'arrived_mutdapilly', 'local_fitout', 'ready_for_handover']);

function respond(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function text(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function brisbaneToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function buildContext(): Promise<ExtractionContext> {
  const orders = (await listJsonStore(ORDER_STORE).catch(() => []))
    .filter((order) => OPEN_ORDER_STATUSES.has(text(order.status)) || !text(order.status))
    .map((order) => ({
      id: text(order.id),
      customerName: text(order.customerName, 180),
      customerEmail: text(order.customerEmail, 320).toLowerCase(),
      productSlug: text(order.productSlug),
      productTitle: text(order.productTitle),
      status: text(order.status, 40),
    }))
    .filter((order) => order.id);
  const products = (catalogue as Array<Record<string, unknown>>)
    .map((product) => ({ slug: text(product.slug), title: text(product.title), containerEtaDate: text(product.containerEtaDate, 10) }))
    .filter((product) => product.slug);
  return { today: brisbaneToday(), orders, products };
}

export async function runGmailCalendarSync(event: Parameters<Handler>[0]): Promise<HandlerResponse> {
  connectBlobStore(event);
  const settings = calendarAiConfig();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return respond(200, { ready: false, message: 'OPENAI_API_KEY is not configured; the calendar sync did nothing.' });

  try {
    const connection = await getGoogleConnection();
    const state = publicGoogleConnectionState(connection, googleOAuthConfig(event).missing);
    if (state !== 'connected') return respond(200, { ready: false, state, message: 'Google is not connected; the calendar sync did nothing.' });

    const threads = await listJsonStore(OWNER_COPILOT_GMAIL_THREAD_STORE);
    const context = await buildContext();
    const messages = selectUnprocessedMessages(threads, context.today, settings.lookbackDays, settings.maxMessages);
    if (!messages.length) return respond(200, { ready: true, read: 0, written: 0, message: 'No new mail to read.' });

    const client = new OpenAI({ apiKey });
    const eventStore = getBlobStore(CALENDAR_EVENT_STORE);
    const threadStore = getBlobStore(OWNER_COPILOT_GMAIL_THREAD_STORE);
    const { blobs } = await eventStore.list({ prefix: 'events/' });
    const existing = (await Promise.all(blobs.map(async (blob) => {
      try { return await eventStore.get(blob.key, { type: 'json' }) as CompanyCalendarEvent | null; } catch { return null; }
    }))).filter((item): item is CompanyCalendarEvent => Boolean(item?.id));

    const instructions = extractionInstructions(context);
    let candidates = 0;
    let written = 0;
    let duplicates = 0;
    let rejected = 0;
    const disagreements: string[] = [];

    for (const message of messages) {
      let raw: unknown = { candidates: [] };
      try {
        const response = await client.responses.create({
          model: settings.model,
          instructions,
          input: extractionInput(message),
          reasoning: { effort: settings.reasoning },
          max_output_tokens: 1200,
          text: { format: { type: 'json_schema', name: 'calendar_extraction', strict: true, schema: calendarExtractionSchema() } },
        } as never);
        raw = JSON.parse((response as { output_text?: string }).output_text || '{"candidates":[]}');
      } catch (error) {
        // One bad message must not stop the run; leave it unprocessed for next time.
        console.warn('google-gmail-calendar-sync: extraction failed', { messageId: message.messageId, error: error instanceof Error ? error.message : String(error) });
        continue;
      }

      const validated = validateCandidates(raw, context, settings.minConfidence);
      candidates += validated.accepted.length + validated.rejected.length;
      rejected += validated.rejected.length;

      for (const candidate of validated.accepted) {
        const input = candidateToEventInput(candidate, message);
        const result = validateEvent(input, { actor: 'gmail-calendar-sync' });
        if (!result.ok) { rejected += 1; continue; }
        if (isDuplicate(result.event, existing)) { duplicates += 1; continue; }
        await eventStore.setJSON(calendarEventKey(result.event.id), result.event);
        existing.push(result.event);
        written += 1;

        const disagreement = etaDisagreement(candidate, context);
        if (disagreement) {
          disagreements.push(disagreement);
          await appendOwnerTimeline('container_eta_disagreement', disagreement, {
            relatedThreadId: message.threadId, source: 'google-gmail-calendar-sync', aiGenerated: true,
          });
        }
      }

      // Mark the message read whether or not it produced anything.
      try {
        const key = gmailThreadKey(message.threadId);
        const thread = await threadStore.get(key, { type: 'json' }) as Record<string, unknown> | null;
        if (thread) {
          const done = Array.isArray(thread.calendarProcessedMessageIds) ? thread.calendarProcessedMessageIds as string[] : [];
          await threadStore.setJSON(key, { ...thread, calendarProcessedMessageIds: [...new Set([...done, message.messageId])] });
        }
      } catch (error) {
        console.warn('google-gmail-calendar-sync: could not mark message processed', { messageId: message.messageId, error: safeBlobStoreError(error) });
      }
    }

    await appendGoogleAudit('gmail_calendar_sync_completed', { read: messages.length, candidates, written, duplicates, rejected, disagreements, model: settings.model });
    return respond(200, { ready: true, read: messages.length, candidates, written, duplicates, rejected, disagreements });
  } catch (error) {
    console.warn('google-gmail-calendar-sync: unavailable', { error: safeBlobStoreError(error) });
    return respond(503, { ready: false, message: 'Calendar sync could not run.' });
  }
}

export const handler: Handler = async (event) => {
  if (event.headers['x-nf-event'] !== 'schedule') return { statusCode: 403, body: 'Scheduled invocation only.' };
  return runGmailCalendarSync(event);
};
