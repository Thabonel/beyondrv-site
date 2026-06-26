import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { parse, stringify } from 'yaml';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

type ProductStatus = 'available' | 'on-sale' | 'coming-soon';
type SuitabilityDataStatus = 'draft' | 'target' | 'confirmed';
type CommerceAvailability = 'available_in_australia' | 'coming_next_container' | 'made_to_order' | 'ask_availability' | 'unavailable';
type SourceType = 'china_container' | 'local_supplier' | 'workshop_stock' | 'custom_made_to_order' | 'other';

interface ProductEditPayload {
  slug?: string;
  title?: string;
  price?: string;
  compareAtPrice?: string;
  saleLabel?: string;
  status?: ProductStatus;
  availability?: CommerceAvailability;
  purchasableOnline?: boolean;
  depositEnabled?: boolean;
  fullPaymentEnabled?: boolean;
  sourceType?: SourceType;
  leadTimeText?: string;
  containerEtaText?: string;
  containerEtaDate?: string;
  onSale?: boolean;
  featured?: boolean;
  tagline?: string;
  heroImage?: string;
  gallery?: string[];
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
  youtubeVideo?: {
    url?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    uploadDate?: string;
    duration?: string;
    transcriptSummary?: string;
  } | null;
  suitabilityData?: {
    status?: SuitabilityDataStatus;
    dryWeightKg?: string;
    estimatedLoadedWeightKg?: string;
    requiredTrayLengthMm?: string;
    requiredTrayWidthMm?: string;
    centreOfGravityMm?: string;
    atmKg?: string;
    gtmKg?: string;
    towBallWeightKg?: string;
    notes?: string;
  };
}

function isSafeProductSlug(slug: string) {
  return /^[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(slug) && !slug.includes('..') && !slug.includes('//');
}

async function githubFetch(path: string): Promise<string | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

function parseMarkdownFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Product file is missing YAML frontmatter.');
  return {
    data: parse(match[1]) as Record<string, unknown>,
    body: match[2] ?? '',
  };
}

function extractYouTubeVideoId(input = '') {
  const value = input.trim();
  if (!value) return '';
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] ?? '';
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return watchId;
      const parts = url.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex(part => ['embed', 'shorts', 'live'].includes(part));
      if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
    }
  } catch {
    return '';
  }

  return '';
}

function extractYouTubeStartSeconds(input = '') {
  try {
    const url = new URL(input.trim());
    const value = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!match) return undefined;
    const seconds =
      Number(match[1] ?? 0) * 3600 +
      Number(match[2] ?? 0) * 60 +
      Number(match[3] ?? 0);
    return seconds > 0 ? seconds : undefined;
  } catch {
    return undefined;
  }
}

function cleanString(value = '') {
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'none' ? trimmed : undefined;
}

function parseMoneyInput(value = '') {
  const cleaned = value.trim().replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function cleanSuitabilityData(value: ProductEditPayload['suitabilityData']) {
  const status = ['draft', 'target', 'confirmed'].includes(value?.status ?? '') ? value!.status : 'draft';
  const data = {
    status,
    ...(cleanString(value?.dryWeightKg) && { dryWeightKg: cleanString(value?.dryWeightKg) }),
    ...(cleanString(value?.estimatedLoadedWeightKg) && { estimatedLoadedWeightKg: cleanString(value?.estimatedLoadedWeightKg) }),
    ...(cleanString(value?.requiredTrayLengthMm) && { requiredTrayLengthMm: cleanString(value?.requiredTrayLengthMm) }),
    ...(cleanString(value?.requiredTrayWidthMm) && { requiredTrayWidthMm: cleanString(value?.requiredTrayWidthMm) }),
    ...(cleanString(value?.centreOfGravityMm) && { centreOfGravityMm: cleanString(value?.centreOfGravityMm) }),
    ...(cleanString(value?.atmKg) && { atmKg: cleanString(value?.atmKg) }),
    ...(cleanString(value?.gtmKg) && { gtmKg: cleanString(value?.gtmKg) }),
    ...(cleanString(value?.towBallWeightKg) && { towBallWeightKg: cleanString(value?.towBallWeightKg) }),
    ...(cleanString(value?.notes) && { notes: cleanString(value?.notes) }),
  };
  return data;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  let payload: ProductEditPayload;
  try {
    payload = JSON.parse(event.body ?? '{}') as ProductEditPayload;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const slug = payload.slug?.trim() ?? '';
  if (!slug || !isSafeProductSlug(slug)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid product slug' }) };
  }

  const required = [payload.title, payload.price, payload.status, payload.tagline, payload.heroImage];
  if (required.some(value => typeof value !== 'string' || !value.trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required product fields' }) };
  }
  if (!Array.isArray(payload.gallery) || payload.gallery.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Gallery must include at least one image' }) };
  }

  const path = `src/content/products/${slug}.md`;
  const current = await githubFetch(path);
  if (!current) {
    return { statusCode: 404, body: JSON.stringify({ error: `Could not read ${path}` }) };
  }

  let parsed;
  try {
    parsed = parseMarkdownFrontmatter(current);
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error instanceof Error ? error.message : 'Could not parse product file' }) };
  }

  const data = parsed.data;
  const isStoreProduct = data.store === true;
  data.title = payload.title!.trim();
  if (isStoreProduct) {
    data.name = payload.title!.trim();
    const parsedPrice = parseMoneyInput(payload.price!);
    if (parsedPrice === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Price must be numeric for shop products' }) };
    }
    data.price = parsedPrice;
  } else {
    data.price = payload.price!.trim();
  }
  data.status = payload.status;
  data.onSale = Boolean(payload.onSale);
  data.featured = Boolean(payload.featured);
  data.tagline = payload.tagline!.trim();
  data.heroImage = payload.heroImage!.trim();
  const gallery = payload.gallery.map(item => item.trim()).filter(Boolean);
  data.gallery = gallery;
  data.relatedSlugs = Array.isArray(payload.relatedSlugs)
    ? payload.relatedSlugs.map(item => item.trim()).filter(Boolean)
    : [];
  if (payload.compareAtPrice !== undefined) {
    const parsedCompare = isStoreProduct ? parseMoneyInput(payload.compareAtPrice) : cleanString(payload.compareAtPrice);
    if (parsedCompare === undefined) delete data.compareAtPrice;
    else data.compareAtPrice = parsedCompare;
  }
  if (payload.saleLabel !== undefined) {
    const saleLabel = cleanString(payload.saleLabel);
    if (saleLabel) data.saleLabel = saleLabel;
    else delete data.saleLabel;
  }
  if (payload.availability) data.availability = payload.availability;
  if (payload.purchasableOnline !== undefined) data.purchasableOnline = Boolean(payload.purchasableOnline);
  if (payload.depositEnabled !== undefined) data.depositEnabled = Boolean(payload.depositEnabled);
  if (payload.fullPaymentEnabled !== undefined) data.fullPaymentEnabled = Boolean(payload.fullPaymentEnabled);
  if (payload.sourceType) data.sourceType = payload.sourceType;
  if (payload.leadTimeText !== undefined) {
    const value = cleanString(payload.leadTimeText);
    if (value) data.leadTimeText = value;
    else delete data.leadTimeText;
  }
  if (payload.containerEtaText !== undefined) {
    const value = cleanString(payload.containerEtaText);
    if (value) data.containerEtaText = value;
    else delete data.containerEtaText;
  }
  if (payload.containerEtaDate !== undefined) {
    const value = cleanString(payload.containerEtaDate);
    if (value) data.containerEtaDate = value;
    else delete data.containerEtaDate;
  }
  if (payload.internalStockEstimate !== undefined) {
    const value = cleanString(payload.internalStockEstimate);
    if (value) data.internalStockEstimate = value;
    else delete data.internalStockEstimate;
  }
  if (payload.targetAustraliaStock !== undefined) {
    const value = cleanString(payload.targetAustraliaStock);
    if (value) data.targetAustraliaStock = value;
    else delete data.targetAustraliaStock;
  }
  if (payload.containerReorderQuantity !== undefined) {
    const value = cleanString(payload.containerReorderQuantity);
    if (value) data.containerReorderQuantity = value;
    else delete data.containerReorderQuantity;
  }
  if (payload.minimumComfortStock !== undefined) {
    const value = cleanString(payload.minimumComfortStock);
    if (value) data.minimumComfortStock = value;
    else delete data.minimumComfortStock;
  }
  if (payload.lastStockCheckedAt !== undefined) {
    const value = cleanString(payload.lastStockCheckedAt);
    if (value) data.lastStockCheckedAt = value;
    else delete data.lastStockCheckedAt;
  }
  if (payload.lastStockCheckedBy !== undefined) {
    const value = cleanString(payload.lastStockCheckedBy);
    if (value) data.lastStockCheckedBy = value;
    else delete data.lastStockCheckedBy;
  }
  if (payload.containerEligible !== undefined) data.containerEligible = Boolean(payload.containerEligible);
  if (payload.usualContainerLeadTimeDays !== undefined) {
    const value = cleanString(payload.usualContainerLeadTimeDays);
    if (value) data.usualContainerLeadTimeDays = value;
    else delete data.usualContainerLeadTimeDays;
  }
  if (payload.supplierNotes !== undefined) {
    const value = cleanString(payload.supplierNotes);
    if (value) data.supplierNotes = value;
    else delete data.supplierNotes;
  }
  if (isStoreProduct) {
    data.description = payload.tagline!.trim();
    data.images = [payload.heroImage!.trim(), ...gallery];
  }

  const videoId = extractYouTubeVideoId(payload.youtubeVideo?.url);
  if (videoId) {
    data.youtubeVideo = {
      id: videoId,
      title: cleanString(payload.youtubeVideo?.title) ?? 'Product walkthrough video',
      ...(cleanString(payload.youtubeVideo?.description) && { description: cleanString(payload.youtubeVideo?.description) }),
      ...(cleanString(payload.youtubeVideo?.thumbnail) && { thumbnail: cleanString(payload.youtubeVideo?.thumbnail) }),
      ...(cleanString(payload.youtubeVideo?.uploadDate) && { uploadDate: cleanString(payload.youtubeVideo?.uploadDate) }),
      ...(cleanString(payload.youtubeVideo?.duration) && { duration: cleanString(payload.youtubeVideo?.duration) }),
      ...(extractYouTubeStartSeconds(payload.youtubeVideo?.url) && { startSeconds: extractYouTubeStartSeconds(payload.youtubeVideo?.url) }),
      ...(cleanString(payload.youtubeVideo?.transcriptSummary) && { transcriptSummary: cleanString(payload.youtubeVideo?.transcriptSummary) }),
    };
  } else {
    delete data.youtubeVideo;
  }

  data.suitabilityData = cleanSuitabilityData(payload.suitabilityData);

  const content = `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n\n${parsed.body.trimStart()}`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pendingChange: {
        path,
        content,
        description: `Update ${data.title} product details`,
        proposal_id: `admin-ui-${Date.now()}-${randomUUID()}`,
        judgeDecision: 'allow',
        risk_flags: [],
      },
    }),
  };
};
