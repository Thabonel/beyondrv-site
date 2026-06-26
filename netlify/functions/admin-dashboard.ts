import type { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  buildLeadIntelligence,
  OWNER_COPILOT_TASK_STORE,
  type OwnerLeadIntelligence,
} from './owner-copilot-core';
import { buildUnifiedLifecycleRecords } from './unified-lifecycle';
import catalogue from './product-catalogue.json';

const ENQUIRY_STORE = 'customer-enquiries';
const ORDER_STORE = 'customer-orders';
const LEAD_STATUS_STORE = 'customer-lead-status';
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_BASE = POSTHOG_PROJECT_ID
  ? `https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/query/`
  : '';
const openAiKey = process.env.OPENAI_API_KEY;
const openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const INSIGHTS_MODEL = process.env.OPENAI_MARKETING_INSIGHTS_MODEL ?? process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5-mini';

type LeadStatusValue = 'new' | 'contacted' | 'replied' | 'called' | 'qualified' | 'quoted' | 'follow-up-scheduled' | 'won' | 'lost' | 'spam';

interface ProductRecord {
  slug: string;
  title: string;
  price: string | number;
  status: string;
  category: string;
  featured?: boolean;
  onSale?: boolean;
  heroImage?: string;
  gallery?: string[];
  galleryCount?: number;
  relatedSlugs?: string[];
  internalStockEstimate?: string;
  targetAustraliaStock?: string;
  containerReorderQuantity?: string;
  minimumComfortStock?: string;
  lastStockCheckedAt?: string;
  lastStockCheckedBy?: string;
  containerEligible?: boolean;
  usualContainerLeadTimeDays?: string;
  supplierNotes?: string;
  availability?: string;
  sourceType?: string;
  leadTimeText?: string;
  containerEtaText?: string;
  containerEtaDate?: string;
}

interface EnquiryRecord {
  id: string;
  submittedAt: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  product_interest?: string;
  callback_date?: string;
  callback_time?: string;
  referral_source_self_reported?: string;
  referral_partner?: string;
  referral_utm_source?: string;
  referral_utm_campaign?: string;
}

interface LeadStatusRecord {
  enquiryId: string;
  status: LeadStatusValue;
  priority?: string;
  notes?: string;
  nextFollowUpDate?: string;
  firstResponseAt?: string;
  lastContactedAt?: string;
  outcomeReason?: string;
  updatedAt: string;
}

interface OrderRecord {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  productSlug?: string;
  productTitle?: string;
  productCategory?: string;
  orderType?: string;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  shippingMethod?: string;
  sourceEnquiryId?: string;
  amountPaidCents?: number;
  currency?: string;
  depositPaid?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface LeadRecord extends EnquiryRecord {
  leadStatus: LeadStatusRecord;
  intelligence: OwnerLeadIntelligence;
}

interface UnifiedLifecycleRecord {
  id: string;
  sourceRecordId: string;
  sourceType: 'stripe_order' | 'enquiry' | 'availability_request' | 'quote_request';
  sourceLabel: string;
  recordType: 'paid_shop_order' | 'unpaid_enquiry' | 'availability_request' | 'quote_request' | 'container_follow_up' | 'customer_order' | 'archived';
  recordLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productTitle: string;
  productSlug: string;
  paymentStatus: string;
  enquiryStatus: string;
  fulfilmentStatus: string;
  fulfilmentLabel: string;
  containerFollowUp: boolean;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
  sourceStore: 'customer-orders' | 'customer-enquiries';
}

interface MarketingInsight {
  title: string;
  recommendation: string;
  evidence: string;
  priority: 'high' | 'medium' | 'low';
}

const VALID_MARKETING_PRIORITIES = new Set(['high', 'medium', 'low']);

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function parsePrice(price: string | number | null | undefined) {
  if (typeof price === 'number') return Number.isFinite(price) ? Math.round(price) : 0;
  if (!price || /poa|contact|tba|coming/i.test(price)) return 0;
  const match = price.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1])) : 0;
}

function productPath(product: ProductRecord) {
  return product.slug.startsWith('expedition/')
    ? `/${product.slug}/`
    : `/${product.slug}/`;
}

function normalise(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanInsightString(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function validateMarketingInsights(value: unknown) {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) return [];
  return (value as { items: unknown[] }).items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const priority = cleanInsightString(raw.priority, 20);
      if (!VALID_MARKETING_PRIORITIES.has(priority)) return null;
      const insight = {
        title: cleanInsightString(raw.title, 120),
        recommendation: cleanInsightString(raw.recommendation, 320),
        evidence: cleanInsightString(raw.evidence, 220),
        priority: priority as MarketingInsight['priority'],
      };
      return insight.title && insight.recommendation && insight.evidence ? insight : null;
    })
    .filter((item): item is MarketingInsight => Boolean(item))
    .slice(0, 6);
}

function matchProduct(enquiry: EnquiryRecord, products: ProductRecord[]) {
  const interest = normalise(enquiry.product_interest);
  const message = normalise(enquiry.message);
  if (!interest && !message) return null;

  const exact = products.find((product) => normalise(product.slug) === interest);
  if (exact) return exact;

  return products.find((product) => {
    const title = normalise(product.title);
    const slug = normalise(product.slug);
    return Boolean(
      (interest && (title.includes(interest) || slug.includes(interest) || interest.includes(title) || interest.includes(slug))) ||
      (message && (message.includes(title) || message.includes(slug)))
    );
  }) ?? null;
}

async function getAllJson<T>(storeName: string) {
  try {
    const store = getBlobStore(storeName);
    const { blobs } = await store.list();
    const records = await Promise.all(
      blobs.map(async (blob) => {
        try {
          return await store.get(blob.key, { type: 'json' }) as T | null;
        } catch {
          return null;
        }
      })
    );
    return records.filter(Boolean) as T[];
  } catch (error) {
    console.warn(`admin-dashboard: ${storeName} unavailable`, {
      store: storeName,
      error: safeBlobStoreError(error),
    });
    return [];
  }
}

async function getLeadStatuses(enquiries: EnquiryRecord[]) {
  if (enquiries.length === 0) return new Map<string, LeadStatusRecord | null>();
  try {
    const store = getBlobStore(LEAD_STATUS_STORE);
    const entries = await Promise.all(
      enquiries.map(async (enquiry) => {
        try {
          const status = await store.get(leadKey(enquiry.id), { type: 'json' }) as LeadStatusRecord | null;
          return [enquiry.id, status] as const;
        } catch {
          return [enquiry.id, null] as const;
        }
      })
    );
    return new Map(entries);
  } catch (error) {
    console.warn('admin-dashboard: lead status store unavailable', {
      store: LEAD_STATUS_STORE,
      error: safeBlobStoreError(error),
    });
    return new Map<string, LeadStatusRecord | null>();
  }
}

async function loadTaskSummary() {
  try {
    const store = getBlobStore(OWNER_COPILOT_TASK_STORE);
    const { blobs } = await store.list();
    const tasks = (await Promise.all(blobs.map(async (blob) => {
      try {
        return await store.get(blob.key, { type: 'json' }) as Record<string, unknown> | null;
      } catch {
        return null;
      }
    }))).filter((task): task is Record<string, unknown> => Boolean(task?.id));
    const today = todayKey(new Date());
    return {
      open: tasks.filter(task => task.status === 'open').length,
      dueToday: tasks.filter(task => task.status === 'open' && task.dueDate === today).length,
      overdue: tasks.filter(task => task.status === 'open' && typeof task.dueDate === 'string' && task.dueDate < today).length,
      recent: tasks
        .filter(task => task.status === 'open')
        .sort((a, b) => String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31')))
        .slice(0, 6),
    };
  } catch (error) {
    console.warn('admin-dashboard: owner copilot task summary unavailable', {
      store: OWNER_COPILOT_TASK_STORE,
      error: safeBlobStoreError(error),
    });
    return { open: 0, dueToday: 0, overdue: 0, recent: [] as Record<string, unknown>[] };
  }
}

async function hogql(query: string) {
  if (!POSTHOG_API_KEY || !POSTHOG_BASE) throw new Error('PostHog server analytics are not configured.');
  const res = await fetch(POSTHOG_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`PostHog query failed with ${res.status}`);
  return await res.json() as { results: unknown[][] };
}

async function loadAnalytics(days: number, products: ProductRecord[]) {
  const emptyChat = {
    recent: [] as { timestamp: string; question: string; answer: string; topic: string; page: string; productSlug: string }[],
    topTopics: [] as { topic: string; count: number }[],
  };

  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return {
      status: 'unavailable',
      message: 'PostHog server analytics are not configured.',
      productPageViews: [] as { slug: string; path: string; views: number }[],
      funnel: [] as { label: string; count: number; dropOff?: string }[],
      sources: [] as { source: string; sessions: number; enquiries: number; conversionRate: string }[],
      chat: emptyChat,
    };
  }

  const paths = products.map(productPath);
  const pathList = paths.map((path) => `'${path.replace(/'/g, "\\'")}'`).join(', ');

  try {
    const [productViewsRes, funnelRes, sourcesRes, chatTopicsRes, recentChatRes] = await Promise.all([
      hogql(`
        SELECT properties.$pathname as path, count() as views
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - INTERVAL ${days} DAY
          AND properties.$pathname IN (${pathList})
        GROUP BY path
        ORDER BY views DESC
      `),
      hogql(`
        SELECT
          countIf(event = '$pageview' AND properties.$pathname IN (${pathList})) as product_views,
          countIf(event = '$pageview' AND properties.$pathname = '/inquiry-form/') as enquiry_form_views,
          countIf(event = 'enquiry_submitted') as enquiries
        FROM events
        WHERE timestamp > now() - INTERVAL ${days} DAY
      `),
      hogql(`
        SELECT
          multiIf(
            properties.utm_source LIKE '%youtube%' OR properties.$referring_domain LIKE '%youtube%', 'YouTube',
            properties.utm_source LIKE '%facebook%' OR properties.$referring_domain LIKE '%facebook%', 'Facebook',
            properties.utm_source LIKE '%instagram%' OR properties.$referring_domain LIKE '%instagram%', 'Instagram',
            properties.$referring_domain LIKE '%google%', 'Google',
            properties.$referring_domain IS NULL OR properties.$referring_domain = '', 'Direct',
            'Other'
          ) as source,
          count(DISTINCT properties.$session_id) as sessions,
          countIf(event = 'enquiry_submitted') as enquiries
        FROM events
        WHERE timestamp > now() - INTERVAL ${days} DAY
        GROUP BY source
        ORDER BY sessions DESC
      `),
      hogql(`
        SELECT coalesce(properties.topic, 'general') as topic, count() as total
        FROM events
        WHERE event = 'chat_interaction'
          AND timestamp > now() - INTERVAL ${days} DAY
        GROUP BY topic
        ORDER BY total DESC
        LIMIT 8
      `),
      hogql(`
        SELECT
          timestamp,
          properties.question as question,
          properties.answer as answer,
          coalesce(properties.topic, 'general') as topic,
          coalesce(properties.page, '') as page,
          coalesce(properties.product_slug, '') as product_slug
        FROM events
        WHERE event = 'chat_interaction'
          AND timestamp > now() - INTERVAL ${days} DAY
        ORDER BY timestamp DESC
        LIMIT 10
      `),
    ]);

    const productPageViews = productViewsRes.results.map(([path, views]) => {
      const product = products.find((item) => productPath(item) === path);
      return { slug: product?.slug ?? String(path), path: String(path), views: Number(views) || 0 };
    });

    const [productViews = 0, formViews = 0, enquiries = 0] = (funnelRes.results[0] ?? []).map(Number);
    const formDrop = productViews > 0 ? `${Math.max(0, 100 - (formViews / productViews) * 100).toFixed(0)}%` : '0%';
    const submitDrop = formViews > 0 ? `${Math.max(0, 100 - (enquiries / formViews) * 100).toFixed(0)}%` : '0%';

    return {
      status: 'ready',
      message: '',
      productPageViews,
      funnel: [
        { label: 'Product page views', count: productViews },
        { label: 'Enquiry form views', count: formViews, dropOff: formDrop },
        { label: 'Submitted enquiries', count: enquiries, dropOff: submitDrop },
      ],
      sources: sourcesRes.results.map(([source, sessions, enquiries]) => {
        const sessionCount = Number(sessions) || 0;
        const enquiryCount = Number(enquiries) || 0;
        return {
          source: String(source),
          sessions: sessionCount,
          enquiries: enquiryCount,
          conversionRate: sessionCount > 0 ? ((enquiryCount / sessionCount) * 100).toFixed(1) : '0.0',
        };
      }),
      chat: {
        topTopics: chatTopicsRes.results.map(([topic, count]) => ({
          topic: String(topic),
          count: Number(count) || 0,
        })),
        recent: recentChatRes.results.map(([timestamp, question, answer, topic, page, productSlug]) => ({
          timestamp: String(timestamp),
          question: String(question ?? ''),
          answer: String(answer ?? ''),
          topic: String(topic ?? 'general'),
          page: String(page ?? ''),
          productSlug: String(productSlug ?? ''),
        })),
      },
    };
  } catch (error) {
    console.error('admin-dashboard analytics error:', error);
    return {
      status: 'error',
      message: 'Analytics could not be loaded. Product and enquiry data are still available.',
      productPageViews: [] as { slug: string; path: string; views: number }[],
      funnel: [] as { label: string; count: number; dropOff?: string }[],
      sources: [] as { source: string; sessions: number; enquiries: number; conversionRate: string }[],
      chat: emptyChat,
    };
  }
}

function ruleBasedMarketingInsights({
  productPerformance,
  unknownProductEnquiries,
  analytics,
}: {
  productPerformance: Array<{
    title: string;
    status: string;
    onSale: boolean;
    enquiries30Days: number;
    totalEnquiries: number;
    pageViews: number;
    conversionRate: string;
    flags: string[];
  }>;
  unknownProductEnquiries: number;
  analytics: Awaited<ReturnType<typeof loadAnalytics>>;
}) {
  const insights: MarketingInsight[] = [];
  const hotProducts = productPerformance
    .filter(product => product.enquiries30Days > 0)
    .sort((a, b) => b.enquiries30Days - a.enquiries30Days)
    .slice(0, 3);
  const viewedNoLead = productPerformance
    .filter(product => product.pageViews >= 20 && product.enquiries30Days === 0 && product.status !== 'coming-soon')
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, 3);
  const lowConversion = productPerformance
    .filter(product => product.pageViews >= 20 && Number(product.conversionRate) < 1 && product.status !== 'coming-soon')
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, 3);

  if (hotProducts.length) {
    insights.push({
      title: 'Promote products already drawing enquiries',
      recommendation: `Put ${hotProducts.map(product => product.title).join(', ')} into social posts, email follow-ups, or homepage proof points this week.`,
      evidence: hotProducts.map(product => `${product.title}: ${product.enquiries30Days} enquiries`).join('; '),
      priority: 'high',
    });
  }

  if (viewedNoLead.length) {
    insights.push({
      title: 'Fix high-traffic products with no leads',
      recommendation: `Review the call-to-action, photos, pricing clarity, and fitment copy for ${viewedNoLead.map(product => product.title).join(', ')}.`,
      evidence: viewedNoLead.map(product => `${product.title}: ${product.pageViews} views and 0 enquiries`).join('; '),
      priority: 'high',
    });
  }

  if (lowConversion.length) {
    insights.push({
      title: 'Improve product page conversion',
      recommendation: `Add sharper enquiry prompts and objection-handling copy to ${lowConversion.map(product => product.title).join(', ')}.`,
      evidence: lowConversion.map(product => `${product.title}: ${product.conversionRate}% page-to-lead`).join('; '),
      priority: 'medium',
    });
  }

  const bestSources = analytics.sources
    .filter(source => source.enquiries > 0)
    .sort((a, b) => Number(b.conversionRate) - Number(a.conversionRate))
    .slice(0, 2);
  if (bestSources.length) {
    insights.push({
      title: 'Lean into converting traffic sources',
      recommendation: `Prioritise follow-up content and posting cadence for ${bestSources.map(source => source.source).join(' and ')}.`,
      evidence: bestSources.map(source => `${source.source}: ${source.enquiries} leads at ${source.conversionRate}%`).join('; '),
      priority: 'medium',
    });
  }

  if (unknownProductEnquiries > 0) {
    insights.push({
      title: 'Reduce general enquiry ambiguity',
      recommendation: 'Add clearer product selection prompts and common use-case language so more enquiries map to a specific model.',
      evidence: `${unknownProductEnquiries} enquiries could not be matched to a product.`,
      priority: 'low',
    });
  }

  if (analytics.chat.topTopics.length) {
    const topics = analytics.chat.topTopics.slice(0, 3).map(topic => topic.topic).join(', ');
    insights.push({
      title: 'Turn chatbot questions into page content',
      recommendation: `Create or improve FAQ copy around ${topics} to answer buying questions before enquiry.`,
      evidence: analytics.chat.topTopics.slice(0, 3).map(topic => `${topic.topic}: ${topic.count}`).join('; '),
      priority: 'medium',
    });
  }

  return insights.slice(0, 6);
}

async function aiMarketingInsights(input: {
  days: number;
  ruleInsights: MarketingInsight[];
  productPerformance: Array<{
    title: string;
    category: string;
    status: string;
    onSale: boolean;
    enquiries30Days: number;
    totalEnquiries: number;
    pageViews: number;
    conversionRate: string;
    flags: string[];
  }>;
  traffic: { source: string; sessions: number; enquiries: number; conversionRate: string }[];
  funnel: { label: string; count: number; dropOff?: string }[];
  chatTopics: { topic: string; count: number }[];
}) {
  if (!openAiClient) return { status: 'unavailable', message: 'OpenAI is not configured for marketing insights.', items: input.ruleInsights };

  const sanitized = {
    days: input.days,
    ruleInsights: input.ruleInsights,
    products: input.productPerformance
      .map(product => ({
        title: product.title,
        category: product.category,
        status: product.status,
        onSale: product.onSale,
        enquiries30Days: product.enquiries30Days,
        totalEnquiries: product.totalEnquiries,
        pageViews: product.pageViews,
        conversionRate: product.conversionRate,
        flags: product.flags,
      }))
      .slice(0, 20),
    traffic: input.traffic.slice(0, 8),
    funnel: input.funnel,
    chatTopics: input.chatTopics.slice(0, 8),
  };

  try {
    const response = await openAiClient.responses.create({
      model: INSIGHTS_MODEL,
      instructions: `You advise Beyond RV's owner on practical marketing actions.

Use only the aggregate, non-PII data provided.
Return JSON only:
{
  "items": [
    {
      "title": "short title",
      "recommendation": "specific practical action",
      "evidence": "short metric-based evidence",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Do not mention customer names, emails, phone numbers, or raw messages.
- Do not invent traffic sources, product demand, prices, or stock status.
- Keep recommendations suitable for a small Australian RV business.
- Prefer actions the owner can take this week.
- Return 3 to 6 items.`,
      input: `AGGREGATE MARKETING DATA:\n${JSON.stringify(sanitized, null, 2)}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'marketing_insights',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                minItems: 3,
                maxItems: 6,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'recommendation', 'evidence', 'priority'],
                  properties: {
                    title: { type: 'string', maxLength: 120 },
                    recommendation: { type: 'string', maxLength: 320 },
                    evidence: { type: 'string', maxLength: 220 },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  },
                },
              },
            },
          },
        },
      },
      max_output_tokens: 1000,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new Error('model_returned_invalid_json');
    }
    const items = validateMarketingInsights(parsed);
    if (!items.length) throw new Error('model_returned_no_valid_insights');
    return { status: 'ready', message: '', items };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenAI error';
    const fallbackReason = /model|unsupported|not found|does not exist|invalid_request_error/i.test(message)
      ? 'AI insights fell back because the configured marketing model is unavailable.'
      : /invalid_json|no_valid_insights/i.test(message)
        ? 'AI insights fell back because the model returned invalid JSON.'
        : 'AI insights fell back because the OpenAI request failed.';
    console.warn('admin-dashboard: marketing insight generation failed', {
      model: INSIGHTS_MODEL,
      reason: fallbackReason,
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' },
    });
    return { status: 'fallback', message: fallbackReason, items: input.ruleInsights };
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  const range = event.queryStringParameters?.range ?? '30';
  const days = ['7', '30', '90'].includes(range) ? Number(range) : 30;
  const products = catalogue as ProductRecord[];
  const now = new Date();
  const today = todayKey(now);
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);

  const enquiries = (await getAllJson<EnquiryRecord>(ENQUIRY_STORE))
    .filter((enquiry) => enquiry?.id && enquiry?.submittedAt)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const orders = (await getAllJson<OrderRecord>(ORDER_STORE))
    .filter((order) => Boolean(order?.id))
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
  const leadStatuses = await getLeadStatuses(enquiries);
  const [analytics, taskSummary] = await Promise.all([
    loadAnalytics(days, products),
    loadTaskSummary(),
  ]);

  const byCategory = new Map<string, { category: string; count: number; value: number }>();
  const byStatus = new Map<string, { status: string; count: number }>();
  let estimatedListedValue = 0;

  for (const product of products) {
    const price = product.status === 'coming-soon' ? 0 : parsePrice(product.price);
    estimatedListedValue += price;
    const category = byCategory.get(product.category) ?? { category: product.category, count: 0, value: 0 };
    category.count += 1;
    category.value += price;
    byCategory.set(product.category, category);
    const status = byStatus.get(product.status) ?? { status: product.status, count: 0 };
    status.count += 1;
    byStatus.set(product.status, status);
  }

  const leadRecords: LeadRecord[] = enquiries.map((enquiry) => {
    const leadStatus = leadStatuses.get(enquiry.id) ?? null;
    const mergedStatus = leadStatus ?? {
      enquiryId: enquiry.id,
      status: 'new' as LeadStatusValue,
      notes: '',
      nextFollowUpDate: enquiry.callback_date || '',
      updatedAt: enquiry.submittedAt,
    };
    return {
      ...enquiry,
      leadStatus: mergedStatus,
      intelligence: buildLeadIntelligence(enquiry, mergedStatus, now),
    };
  });

  const activeLeads = leadRecords.filter((enquiry) => !['won', 'lost', 'spam'].includes(enquiry.leadStatus.status));
  const priorityQueue = activeLeads
    .filter((lead) => ['hot', 'warm', 'waiting_on_byondrv'].includes(lead.intelligence.urgency) || Boolean(lead.intelligence.followUpDueDate && lead.intelligence.followUpDueDate <= today))
    .sort((a, b) => {
      const urgencyRank = { waiting_on_byondrv: 4, hot: 3, warm: 2, cold: 1, waiting_on_customer: 1, dormant: 0, won: 0, lost: 0 } as Record<string, number>;
      return (urgencyRank[b.intelligence.urgency] ?? 0) - (urgencyRank[a.intelligence.urgency] ?? 0)
        || b.intelligence.score - a.intelligence.score
        || String(a.intelligence.followUpDueDate || '9999-12-31').localeCompare(String(b.intelligence.followUpDueDate || '9999-12-31'));
    })
    .slice(0, 10);
  const followUpQueue = activeLeads
    .filter((enquiry) => enquiry.leadStatus.nextFollowUpDate && enquiry.leadStatus.nextFollowUpDate <= today)
    .sort((a, b) => String(a.leadStatus.nextFollowUpDate).localeCompare(String(b.leadStatus.nextFollowUpDate)))
    .slice(0, 10);

  const byLeadStatus = ['new', 'contacted', 'replied', 'called', 'qualified', 'quoted', 'follow-up-scheduled', 'won', 'lost', 'spam'].map((status) => ({
    status,
    count: leadRecords.filter((enquiry) => enquiry.leadStatus.status === status).length,
  }));

  const productPerformance = products.map((product) => {
    const productEnquiries = enquiries.filter((enquiry) => matchProduct(enquiry, products)?.slug === product.slug);
    const recentEnquiries = productEnquiries.filter((enquiry) => new Date(enquiry.submittedAt) >= thirtyDaysAgo);
    const pageViews = analytics.productPageViews.find((view) => view.slug === product.slug)?.views ?? 0;
    return {
      slug: product.slug,
      title: product.title,
      category: product.category,
      status: product.status,
      onSale: Boolean(product.onSale || product.status === 'on-sale'),
      price: product.price,
      enquiries30Days: recentEnquiries.length,
      totalEnquiries: productEnquiries.length,
      pageViews,
      conversionRate: pageViews > 0 ? ((recentEnquiries.length / pageViews) * 100).toFixed(1) : '0.0',
      flags: [
        product.status !== 'coming-soon' && recentEnquiries.length === 0 && 'No enquiries in 30 days',
        (product.onSale || product.status === 'on-sale') && recentEnquiries.length === 0 && 'On sale with no recent enquiries',
        !product.heroImage && 'Missing hero image',
        (product.galleryCount ?? product.gallery?.length ?? 0) < 3 && 'Low photo count',
      ].filter((flag): flag is string => typeof flag === 'string'),
    };
  });

  const unknownProductEnquiries = enquiries.filter((enquiry) => !matchProduct(enquiry, products)).length;
  const ruleInsights = ruleBasedMarketingInsights({
    productPerformance,
    unknownProductEnquiries,
    analytics,
  });
  const marketingInsights = await aiMarketingInsights({
    days,
    ruleInsights,
    productPerformance,
    traffic: analytics.sources,
    funnel: analytics.funnel,
    chatTopics: analytics.chat.topTopics,
  });
  const weakListings = products
    .filter((product) => !product.heroImage || (product.galleryCount ?? product.gallery?.length ?? 0) < 3)
    .map((product) => ({
      slug: product.slug,
      title: product.title,
      issue: !product.heroImage ? 'Missing hero image' : 'Fewer than three gallery images',
    }));
  const planningProducts = products
    .filter((product) => Boolean(
      product.containerEligible ||
      product.internalStockEstimate ||
      product.targetAustraliaStock ||
      product.containerReorderQuantity ||
      product.minimumComfortStock ||
      product.containerEtaText ||
      product.leadTimeText ||
      product.sourceType === 'china_container'
    ))
    .map((product) => ({
      slug: product.slug,
      title: product.title,
      availability: product.availability,
      sourceType: product.sourceType,
      leadTimeText: product.leadTimeText,
      containerEtaText: product.containerEtaText,
      containerEtaDate: product.containerEtaDate,
      internalStockEstimate: product.internalStockEstimate,
      targetAustraliaStock: product.targetAustraliaStock,
      containerReorderQuantity: product.containerReorderQuantity,
      minimumComfortStock: product.minimumComfortStock,
      lastStockCheckedAt: product.lastStockCheckedAt,
      lastStockCheckedBy: product.lastStockCheckedBy,
      containerEligible: product.containerEligible,
      usualContainerLeadTimeDays: product.usualContainerLeadTimeDays,
    }))
    .slice(0, 12);

  const orderStatuses = ['enquiry', 'deposit_received', 'ordered_from_factory', 'in_china_production', 'awaiting_shipping', 'in_transit', 'arrived_mutdapilly', 'local_fitout', 'ready_for_handover', 'delivered', 'cancelled']
    .map((status) => ({
      status,
      count: orders.filter((order) => order.status === status).length,
    }))
    .filter((row) => row.count > 0);
  const shippingStatuses = ['pending', 'ready', 'label_created', 'in_transit', 'delivered', 'blocked']
    .map((status) => ({
      status,
      count: orders.filter((order) => order.shippingStatus === status).length,
    }))
    .filter((row) => row.count > 0);
  const lifecycle = buildUnifiedLifecycleRecords({
    orders,
    enquiries: leadRecords,
  }).slice(0, 20) as UnifiedLifecycleRecord[];
  const recentOrders = orders.slice(0, 6);
  const paidOrders = orders.filter((order) => Boolean(order.depositPaid || order.paymentStatus === 'paid' || order.paymentStatus === 'succeeded'));

  const contactReady = Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);
  const readiness = [
    { label: 'Admin password configured', status: process.env.ADMIN_PASSWORD ? 'ready' : 'blocker', detail: process.env.ADMIN_PASSWORD ? 'Admin endpoints are protected.' : 'Set ADMIN_PASSWORD in Netlify.' },
    { label: 'Contact recipient configured', status: process.env.CONTACT_TO_EMAIL ? 'ready' : 'warning', detail: process.env.CONTACT_TO_EMAIL ?? 'Using fallback beyondcaravans@gmail.com.' },
    { label: 'Resend email API configured', status: process.env.RESEND_API_KEY ? 'ready' : 'blocker', detail: process.env.RESEND_API_KEY ? 'Email provider key is present.' : 'Set RESEND_API_KEY in Netlify.' },
    { label: 'Verified sender configured', status: process.env.CONTACT_FROM_EMAIL ? 'ready' : 'blocker', detail: process.env.CONTACT_FROM_EMAIL ? process.env.CONTACT_FROM_EMAIL : 'Set CONTACT_FROM_EMAIL in Netlify.' },
    { label: 'Product catalogue available', status: products.length > 0 ? 'ready' : 'blocker', detail: `${products.length} products found.` },
    { label: 'PostHog public key configured', status: process.env.PUBLIC_POSTHOG_KEY ? 'ready' : 'warning', detail: process.env.PUBLIC_POSTHOG_KEY ? 'Browser analytics can load after consent.' : 'Set PUBLIC_POSTHOG_KEY for browser analytics.' },
    { label: 'PostHog server API configured', status: POSTHOG_API_KEY && POSTHOG_PROJECT_ID ? 'ready' : 'warning', detail: POSTHOG_API_KEY && POSTHOG_PROJECT_ID ? 'Server-side analytics queries are available.' : 'Set POSTHOG_API_KEY and POSTHOG_PROJECT_ID for dashboard analytics.' },
    { label: 'Active products have hero images', status: products.filter((product) => product.status !== 'coming-soon' && !product.heroImage).length === 0 ? 'ready' : 'warning', detail: `${products.filter((product) => product.status !== 'coming-soon' && !product.heroImage).length} active products missing hero images.` },
    { label: 'Active products have galleries', status: products.filter((product) => product.status !== 'coming-soon' && (product.galleryCount ?? product.gallery?.length ?? 0) === 0).length === 0 ? 'ready' : 'warning', detail: `${products.filter((product) => product.status !== 'coming-soon' && (product.galleryCount ?? product.gallery?.length ?? 0) === 0).length} active products missing galleries.` },
  ];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      generatedAt: now.toISOString(),
      range: String(days),
      decisions: [
        'Lead status is admin-only for Phase 1 to avoid exposing private customer links in email.',
        'Won leads do not automatically mark products sold; the owner stays in control of stock changes.',
        'Paid checkout records and manual order records share the same order store.',
        'Stale stock uses no enquiries in 30 days by default.',
        'Listed value uses the current public price only and excludes POA/contact pricing.',
        'Weekly summary emails are a later enhancement after real usage data exists.',
      ],
      inventory: {
        totalProducts: products.length,
        available: products.filter((product) => product.status === 'available').length,
        onSale: products.filter((product) => product.onSale || product.status === 'on-sale').length,
        comingSoon: products.filter((product) => product.status === 'coming-soon').length,
        featured: products.filter((product) => product.featured).length,
        estimatedListedValue,
        byCategory: [...byCategory.values()],
        byStatus: [...byStatus.values()],
        planning: planningProducts,
        weakListings,
      },
      leads: {
        last7Days: enquiries.filter((enquiry) => new Date(enquiry.submittedAt) >= sevenDaysAgo).length,
        last30Days: enquiries.filter((enquiry) => new Date(enquiry.submittedAt) >= thirtyDaysAgo).length,
        open: activeLeads.length,
        dueToday: activeLeads.filter((enquiry) => enquiry.leadStatus.nextFollowUpDate === today).length,
        overdue: activeLeads.filter((enquiry) => enquiry.leadStatus.nextFollowUpDate && enquiry.leadStatus.nextFollowUpDate < today).length,
        byStatus: byLeadStatus,
        priorityQueue,
        followUpQueue,
        recent: leadRecords.slice(0, 5),
      },
      orders: {
        total: orders.length,
        paid: paidOrders.length,
        enquiryLinked: orders.filter((order) => Boolean(order.sourceEnquiryId)).length,
        shippingBlocked: orders.filter((order) => order.shippingStatus === 'blocked').length,
        byStatus: orderStatuses,
        byShippingStatus: shippingStatuses,
        recent: recentOrders,
      },
      lifecycle,
      tasks: taskSummary,
      productPerformance,
      productInterest: {
        unknownProductEnquiries,
        topProducts: productPerformance
          .filter((product) => product.totalEnquiries > 0)
          .sort((a, b) => b.totalEnquiries - a.totalEnquiries)
          .slice(0, 8),
        staleProducts: productPerformance.filter((product) => product.status !== 'coming-soon' && product.enquiries30Days === 0),
      },
      traffic: analytics.sources,
      funnel: analytics.funnel,
      marketingInsights,
      analytics: {
        status: analytics.status,
        message: analytics.message,
      },
      contact: {
        ready: contactReady,
        toEmail: process.env.CONTACT_TO_EMAIL ?? 'beyondcaravans@gmail.com',
        fromEmail: process.env.CONTACT_FROM_EMAIL ?? '',
      },
      readiness,
    }),
  };
};
