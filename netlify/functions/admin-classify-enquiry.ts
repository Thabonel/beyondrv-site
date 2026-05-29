import OpenAI from 'openai';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import catalogue from './product-catalogue.json';

const openAiKey = process.env.OPENAI_API_KEY;
const client = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const CLASSIFY_MODEL = process.env.OPENAI_ADMIN_CLASSIFY_MODEL ?? process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5-mini';
const ENQUIRY_STORE = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';

function clean(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

function parseJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Classification response was not JSON.');
  return JSON.parse(match[0]) as Record<string, unknown>;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  if (!client) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'OpenAI is not configured for lead classification.' }),
    };
  }

  let enquiryId = '';
  try {
    const body = JSON.parse(event.body ?? '{}') as { enquiryId?: unknown };
    enquiryId = clean(body.enquiryId, 240);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  if (!enquiryId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing enquiryId' }),
    };
  }

  let enquiry: Record<string, unknown> | null = null;
  let leadStatus: Record<string, unknown> | null = null;
  try {
    const enquiryStore = getBlobStore(ENQUIRY_STORE);
    const statusStore = getBlobStore(LEAD_STATUS_STORE);
    enquiry = await enquiryStore.get(enquiryId, { type: 'json' }) as Record<string, unknown> | null;
    try {
      leadStatus = await statusStore.get(leadKey(enquiryId), { type: 'json' }) as Record<string, unknown> | null;
    } catch {
      leadStatus = null;
    }
  } catch (error) {
    console.warn('admin-classify-enquiry: storage unavailable', {
      enquiryId,
      blobRuntimeSource,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }

  if (!enquiry) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Enquiry not found.' }),
    };
  }

  const input = {
    enquiry: {
      sourceType: clean(enquiry.source_type, 80),
      name: clean(enquiry.name, 120),
      productInterest: clean(enquiry.product_interest, 240),
      intent: clean(enquiry.enquiry_intent, 120),
      subject: clean(enquiry.email_subject, 240),
      message: clean(enquiry.message, 2500),
      mainQuestions: clean(enquiry.main_questions, 1500),
      vehicleDetails: clean(enquiry.vehicle_details, 1000),
      budgetNotes: clean(enquiry.budget_notes, 1000),
      timeline: clean(enquiry.timeline, 1000),
      sourceNote: clean(enquiry.source_note, 1000),
    },
    leadStatus,
    catalogue: (catalogue as Array<{ slug?: string; title?: string; category?: string; status?: string }>)
      .map(product => ({ slug: product.slug, title: product.title, category: product.category, status: product.status })),
  };

  const instructions = `Classify a Beyond RV sales enquiry for the owner.

Return only JSON with these exact keys:
{
  "suggestedPriority": "hot" | "warm" | "info-only" | "spam-low-quality",
  "intent": "quote" | "availability" | "fitment" | "finance" | "support" | "research" | "other",
  "urgency": "high" | "medium" | "low",
  "productInterest": "short product name or general enquiry",
  "missingDetails": ["short missing detail"],
  "reason": "one short reason",
  "nextBestAction": "one practical next step"
}

Rules:
- Do not invent customer facts.
- Do not classify as hot unless there is buying intent, urgency, a clear product fit, or follow-up value.
- Use spam-low-quality only for obvious spam or irrelevant enquiries.
- Keep all strings short.`;

  try {
    const response = await client.responses.create({
      model: CLASSIFY_MODEL,
      instructions,
      input: `LEAD CONTEXT:\n${JSON.stringify(input, null, 2)}`,
      max_output_tokens: 700,
    });

    const classification = parseJsonObject(response.output_text.trim());
    const statusStore = getBlobStore(LEAD_STATUS_STORE);
    const existing = leadStatus ?? {
      enquiryId,
      status: 'new',
      notes: '',
      nextFollowUpDate: '',
      priority: 'warm',
      outcomeReason: '',
      firstResponseAt: '',
      lastContactedAt: '',
      updatedAt: '',
    };
    const leadStatusNext = {
      ...existing,
      aiClassification: {
        ...classification,
        generatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    await statusStore.setJSON(leadKey(enquiryId), leadStatusNext);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification: leadStatusNext.aiClassification, leadStatus: leadStatusNext }),
    };
  } catch (error) {
    console.error('admin-classify-enquiry: classification failed', {
      enquiryId,
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' },
    });
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not classify this enquiry.' }),
    };
  }
};
