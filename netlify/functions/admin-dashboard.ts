import { getStore } from '@netlify/blobs';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import catalogue from './product-catalogue.json';

const ENQUIRY_STORE = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_BASE = POSTHOG_PROJECT_ID
  ? `https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/query/`
  : '';

type LeadStatusValue = 'new' | 'contacted' | 'quoted' | 'won' | 'lost' | 'spam';

interface ProductRecord {
  slug: string;
  title: string;
  price: string;
  status: string;
  category: string;
  featured?: boolean;
  onSale?: boolean;
  heroImage?: string;
  gallery?: string[];
  galleryCount?: number;
  relatedSlugs?: string[];
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
  notes?: string;
  nextFollowUpDate?: string;
  updatedAt: string;
}

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

function parsePrice(price: string) {
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
    const store = getStore({ name: storeName, consistency: 'strong' });
    const { blobs } = await store.list();
    const records = await Promise.all(
      blobs.map(async (blob) => {
        try {
          return await store.get(blob.key, { type: 'json', consistency: 'strong' }) as T | null;
        } catch {
          return null;
        }
      })
    );
    return records.filter(Boolean) as T[];
  } catch (error) {
    console.warn(`admin-dashboard: ${storeName} unavailable`, error);
    return [];
  }
}

async function getLeadStatuses(enquiries: EnquiryRecord[]) {
  if (enquiries.length === 0) return new Map<string, LeadStatusRecord | null>();
  try {
    const store = getStore({ name: LEAD_STATUS_STORE, consistency: 'strong' });
    const entries = await Promise.all(
      enquiries.map(async (enquiry) => {
        try {
          const status = await store.get(leadKey(enquiry.id), { type: 'json', consistency: 'strong' }) as LeadStatusRecord | null;
          return [enquiry.id, status] as const;
        } catch {
          return [enquiry.id, null] as const;
        }
      })
    );
    return new Map(entries);
  } catch (error) {
    console.warn('admin-dashboard: lead status store unavailable', error);
    return new Map<string, LeadStatusRecord | null>();
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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

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
  const leadStatuses = await getLeadStatuses(enquiries);
  const analytics = await loadAnalytics(days, products);

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

  const leadRecords = enquiries.map((enquiry) => {
    const leadStatus = leadStatuses.get(enquiry.id) ?? null;
    return {
      ...enquiry,
      leadStatus: leadStatus ?? {
        enquiryId: enquiry.id,
        status: 'new' as LeadStatusValue,
        notes: '',
        nextFollowUpDate: enquiry.callback_date || '',
        updatedAt: enquiry.submittedAt,
      },
    };
  });

  const activeLeads = leadRecords.filter((enquiry) => !['won', 'lost', 'spam'].includes(enquiry.leadStatus.status));
  const followUpQueue = activeLeads
    .filter((enquiry) => enquiry.leadStatus.nextFollowUpDate && enquiry.leadStatus.nextFollowUpDate <= today)
    .sort((a, b) => String(a.leadStatus.nextFollowUpDate).localeCompare(String(b.leadStatus.nextFollowUpDate)))
    .slice(0, 10);

  const byLeadStatus = ['new', 'contacted', 'quoted', 'won', 'lost', 'spam'].map((status) => ({
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
      ].filter(Boolean),
    };
  });

  const unknownProductEnquiries = enquiries.filter((enquiry) => !matchProduct(enquiry, products)).length;
  const weakListings = products
    .filter((product) => !product.heroImage || (product.galleryCount ?? product.gallery?.length ?? 0) < 3)
    .map((product) => ({
      slug: product.slug,
      title: product.title,
      issue: !product.heroImage ? 'Missing hero image' : 'Fewer than three gallery images',
    }));

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
        weakListings,
      },
      leads: {
        last7Days: enquiries.filter((enquiry) => new Date(enquiry.submittedAt) >= sevenDaysAgo).length,
        last30Days: enquiries.filter((enquiry) => new Date(enquiry.submittedAt) >= thirtyDaysAgo).length,
        open: activeLeads.length,
        dueToday: activeLeads.filter((enquiry) => enquiry.leadStatus.nextFollowUpDate === today).length,
        overdue: activeLeads.filter((enquiry) => enquiry.leadStatus.nextFollowUpDate && enquiry.leadStatus.nextFollowUpDate < today).length,
        byStatus: byLeadStatus,
        followUpQueue,
        recent: leadRecords.slice(0, 5),
      },
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
