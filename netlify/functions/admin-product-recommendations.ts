import type { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import catalogue from './product-catalogue.json';

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MARKETING_INSIGHTS_MODEL ?? process.env.OPENAI_ADMIN_MODEL ?? 'gpt-5-mini';
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);
const VALID_CATEGORIES = new Set(['quick-fix', 'owner-action', 'marketing', 'technical']);

interface ProductRecord {
  slug: string;
  title: string;
  price: string;
  status: string;
  category: string;
  tagline?: string;
  onSale?: boolean;
  heroImage?: string;
  gallery?: string[];
  galleryCount?: number;
  keySpecs?: { label: string; value: string }[];
  description?: string;
}

interface Recommendation {
  title: string;
  action: string;
  evidence: string;
  priority: 'high' | 'medium' | 'low';
  category: 'quick-fix' | 'owner-action' | 'marketing' | 'technical';
}

function clean(value: unknown, max = 400) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function fallbackRecommendations(product: ProductRecord, flags: string[], pageViews: number, enquiries30Days: number) {
  const items: Recommendation[] = [];
  const photoCount = product.galleryCount ?? product.gallery?.length ?? 0;
  if (flags.some(flag => /no enquiries/i.test(flag))) {
    items.push({
      title: pageViews > 0 ? 'Improve product-page conversion' : 'Increase qualified visibility',
      action: pageViews > 0
        ? 'Review the opening copy, price presentation, buyer objections, and enquiry call-to-action before increasing promotion.'
        : 'Feature the product in a targeted homepage, email, or social campaign and measure product-page visits before changing the offer.',
      evidence: `${pageViews} recorded page views and ${enquiries30Days} enquiries in the selected period.`,
      priority: 'high',
      category: pageViews > 0 ? 'quick-fix' : 'marketing',
    });
  }
  if (flags.some(flag => /on sale/i.test(flag))) {
    items.push({
      title: 'Clarify the sale offer',
      action: 'Confirm the sale price, original value, stock condition, inclusions, and urgency are explicit near the first enquiry action.',
      evidence: 'The product is marked on sale but has no recent enquiries.',
      priority: 'high',
      category: 'owner-action',
    });
  }
  if (flags.some(flag => /image|photo|gallery/i.test(flag))) {
    items.push({
      title: 'Complete the inspection gallery',
      action: 'Add clear exterior, interior, storage, fitment, construction-detail, and access photos with accurate captions.',
      evidence: `${photoCount} gallery images are currently recorded.`,
      priority: 'high',
      category: 'owner-action',
    });
  }
  items.push({
    title: 'Answer the next buyer questions',
    action: 'Add verified FAQs covering suitability, dimensions, weights, inclusions, lead time, warranty, and the next step to enquire.',
    evidence: `Current product data contains ${product.keySpecs?.length ?? 0} key specifications.`,
    priority: 'medium',
    category: 'quick-fix',
  });
  return items.slice(0, 5);
}

function validateResult(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.recommendations)) return null;
  const recommendations = raw.recommendations.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    const priority = clean(entry.priority, 20);
    const category = clean(entry.category, 30);
    if (!VALID_PRIORITIES.has(priority) || !VALID_CATEGORIES.has(category)) return null;
    const result = {
      title: clean(entry.title, 120),
      action: clean(entry.action, 500),
      evidence: clean(entry.evidence, 300),
      priority: priority as Recommendation['priority'],
      category: category as Recommendation['category'],
    };
    return result.title && result.action && result.evidence ? result : null;
  }).filter((item): item is Recommendation => Boolean(item)).slice(0, 6);
  if (!recommendations.length) return null;
  return {
    diagnosis: clean(raw.diagnosis, 500),
    ownerInputs: Array.isArray(raw.ownerInputs) ? raw.ownerInputs.map(item => clean(item, 220)).filter(Boolean).slice(0, 5) : [],
    recommendations,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const slug = clean(body.slug, 240);
  const product = (catalogue as ProductRecord[]).find(item => item.slug === slug);
  if (!product) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Product not found' }) };

  const flags = Array.isArray(body.flags) ? body.flags.map(flag => clean(flag, 160)).filter(Boolean).slice(0, 10) : [];
  const pageViews = Math.max(0, Number(body.pageViews) || 0);
  const enquiries30Days = Math.max(0, Number(body.enquiries30Days) || 0);
  const totalEnquiries = Math.max(0, Number(body.totalEnquiries) || 0);
  const fallback = fallbackRecommendations(product, flags, pageViews, enquiries30Days);

  if (!client) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'fallback',
        message: 'OpenAI is not configured. Showing evidence-based rule recommendations.',
        diagnosis: `${product.title} needs attention because ${flags.join(', ') || 'the listing has incomplete performance signals'}.`,
        ownerInputs: ['Confirm current stock status, price, inclusions, and any missing product specifications before publishing changes.'],
        recommendations: fallback,
      }),
    };
  }

  const context = {
    product: {
      slug: product.slug,
      title: product.title,
      category: product.category,
      status: product.status,
      onSale: Boolean(product.onSale || product.status === 'on-sale'),
      price: product.price,
      tagline: product.tagline ?? '',
      description: product.description ?? '',
      keySpecs: product.keySpecs ?? [],
      hasHeroImage: Boolean(product.heroImage),
      galleryCount: product.galleryCount ?? product.gallery?.length ?? 0,
    },
    performance: { pageViews, enquiries30Days, totalEnquiries },
    attentionFlags: flags,
  };

  try {
    const response = await client.responses.create({
      model: MODEL,
      instructions: `You are the product merchandising adviser for Beyond RV, a small Australian RV business.

Diagnose one product listing using only the supplied verified context. Distinguish low visibility from weak conversion only when the page-view evidence supports it. Do not invent specifications, pricing, stock, customer demand, discounts, performance results, or competitor facts. Recommend owner confirmation when evidence is missing. Suggestions must be practical and must not imply that any website change has already been made.

Return JSON matching the schema. Recommendations should be ranked and specific.`,
      input: `VERIFIED PRODUCT CONTEXT:\n${JSON.stringify(context, null, 2)}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'product_attention_recommendations',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['diagnosis', 'ownerInputs', 'recommendations'],
            properties: {
              diagnosis: { type: 'string', maxLength: 500 },
              ownerInputs: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 220 } },
              recommendations: {
                type: 'array', minItems: 3, maxItems: 6,
                items: {
                  type: 'object', additionalProperties: false,
                  required: ['title', 'action', 'evidence', 'priority', 'category'],
                  properties: {
                    title: { type: 'string', maxLength: 120 },
                    action: { type: 'string', maxLength: 500 },
                    evidence: { type: 'string', maxLength: 300 },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                    category: { type: 'string', enum: ['quick-fix', 'owner-action', 'marketing', 'technical'] },
                  },
                },
              },
            },
          },
        },
      },
      max_output_tokens: 1600,
    });
    const result = validateResult(JSON.parse(response.output_text));
    if (!result) throw new Error('invalid_recommendation_response');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready', message: '', ...result }) };
  } catch (error) {
    console.warn('admin-product-recommendations: AI generation failed', {
      model: MODEL,
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' },
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'fallback',
        message: 'AI analysis was unavailable. Showing evidence-based rule recommendations.',
        diagnosis: `${product.title} needs attention because ${flags.join(', ') || 'the listing has incomplete performance signals'}.`,
        ownerInputs: ['Confirm current stock status, price, inclusions, and any missing product specifications before publishing changes.'],
        recommendations: fallback,
      }),
    };
  }
};
