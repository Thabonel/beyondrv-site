import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { toIsoDateString } from './lib/contentDates';

// Frontmatter dates arrive as a Date when the value is written unquoted, because
// Astro parses with js-yaml's YAML 1.1 schema. Coerce before validating so one
// unquoted timestamp cannot fail the build. See src/lib/contentDates.ts.
const dateString = z.preprocess(toIsoDateString, z.string());

const specRow = z.object({ label: z.string(), value: z.string() });
const specGroup = z.object({ group: z.string(), items: z.array(specRow) });
const commerceAvailability = z.enum([
  'available_in_australia',
  'coming_next_container',
  'made_to_order',
  'ask_availability',
  'unavailable',
]);
const youtubeVideo = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  uploadDate: dateString.optional(),
  duration: z.string().optional(),
  startSeconds: z.number().int().nonnegative().optional(),
  transcriptSummary: z.string().optional(),
});
const suitabilityData = z.object({
  status: z.enum(['draft', 'target', 'confirmed']).default('draft'),
  dryWeightKg: z.string().optional(),
  estimatedLoadedWeightKg: z.string().optional(),
  requiredTrayLengthMm: z.string().optional(),
  requiredTrayWidthMm: z.string().optional(),
  centreOfGravityMm: z.string().optional(),
  atmKg: z.string().optional(),
  gtmKg: z.string().optional(),
  towBallWeightKg: z.string().optional(),
  notes: z.string().optional(),
});

function availabilityFromStatus(status: 'available' | 'on-sale' | 'coming-soon') {
  return status === 'coming-soon' ? 'coming_next_container' : 'available_in_australia';
}

const vehicleProduct = z.object({
  store:         z.literal(false).optional(),
  archived:      z.boolean().default(false),
  archivedAt:    dateString.optional(),
  title:         z.string(),
  compareAtPrice: z.string().optional(),
  saleLabel:     z.string().optional(),
  category:      z.enum(['caravan', 'slide-on', 'expedition']),
  tagline:       z.string(),
  price:         z.string(),
  priceBadge:    z.string().optional(),
  status:        z.enum(['available', 'on-sale', 'coming-soon']).default('available'),
  availability:  commerceAvailability.optional(),
  onlinePurchaseEnabled: z.boolean().optional(),
  purchasableOnline: z.boolean().optional(),
  depositEnabled: z.boolean().optional(),
  fullPaymentEnabled: z.boolean().optional(),
  sourceType:    z.enum(['china_container', 'local_supplier', 'workshop_stock', 'custom_made_to_order', 'other']).optional(),
  leadTimeText:  z.string().optional(),
  containerEtaText: z.string().optional(),
  containerEtaDate: dateString.optional(),
  onSale:        z.boolean().default(false),
  featured:      z.boolean().default(false),
  heroImage:     z.string(),
  gallery:       z.array(z.string()),
  keySpecs:      z.array(specRow),
  specs:         z.array(specRow).optional(),
  specGroups:    z.array(specGroup).optional(),
  features:      z.array(z.string()).optional(),
  faq:           z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  relatedSlugs:  z.array(z.string()).optional(),
  youtubeVideo:  youtubeVideo.optional(),
  suitabilityData: suitabilityData.optional(),
  seoTitle:      z.string().optional(),
  seoDesc:       z.string().optional(),
  canonicalUrl:  z.string().optional(),
}).transform((product) => {
  const availability = product.availability ?? availabilityFromStatus(product.status);
  return {
    ...product,
    availability,
    onlinePurchaseEnabled: product.onlinePurchaseEnabled ?? product.purchasableOnline ?? false,
    purchasableOnline: product.purchasableOnline ?? availability === 'available_in_australia',
    depositEnabled: product.depositEnabled ?? availability === 'available_in_australia',
    fullPaymentEnabled: product.fullPaymentEnabled ?? availability === 'available_in_australia',
    sourceType: product.sourceType ?? 'other',
    leadTimeText: product.leadTimeText,
    containerEtaText: product.containerEtaText,
    containerEtaDate: product.containerEtaDate,
  };
});

const shopBase = {
  store:       z.literal(true),
  archived:    z.boolean().default(false),
  archivedAt:  dateString.optional(),
  name:        z.string().min(1),
  title:       z.string().optional(),
  slug:        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1),
  tagline:     z.string().optional(),
  price:       z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  saleLabel:   z.string().optional(),
  onSale:      z.boolean().default(false),
  images:      z.array(z.string()).min(1),
  heroImage:   z.string().optional(),
  gallery:     z.array(z.string()).optional(),
  category:    z.string().min(1),
  featured:    z.boolean().default(false),
  availability: commerceAvailability.optional(),
  onlinePurchaseEnabled: z.boolean().default(false),
  purchasableOnline: z.boolean().default(false),
  sourceType:   z.enum(['china_container', 'local_supplier', 'workshop_stock', 'custom_made_to_order', 'other']).optional(),
  leadTimeText: z.string().optional(),
  containerEtaText: z.string().optional(),
  containerEtaDate: dateString.optional(),
  priceBadge:   z.string().optional(),
  depositEnabled: z.boolean().optional(),
  fullPaymentEnabled: z.boolean().optional(),
  specs:        z.array(specRow).optional(),
  specGroups:   z.array(specGroup).optional(),
  features:     z.array(z.string()).optional(),
  faq:          z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  relatedSlugs: z.array(z.string()).optional(),
  youtubeVideo: youtubeVideo.optional(),
  suitabilityData: suitabilityData.optional(),
  canonicalUrl: z.string().optional(),
  seoTitle:    z.string().optional(),
  seoDesc:     z.string().optional(),
};

const stockProduct = z.object({
  ...shopBase,
  productType:   z.literal('stock'),
  weight:        z.number().positive().optional(),
  dimensions:    z.object({
    length: z.number().positive().optional(),
    width:  z.number().positive().optional(),
    height: z.number().positive().optional(),
  }).refine(
    dimensions => dimensions.length !== undefined || dimensions.width !== undefined || dimensions.height !== undefined,
    { message: 'Dimensions must include at least one of length, width, or height.' }
  ).optional(),
  availability:  z.enum(['available_in_australia', 'coming_next_container', 'made_to_order', 'ask_availability', 'unavailable']),
  purchasableOnline: z.boolean().default(false),
  fulfilmentType: z.enum(['ship', 'pickup', 'install', 'quote_required']).default('quote_required'),
  shippingSize:   z.enum(['small', 'medium', 'large', 'oversized']).default('medium'),
  pickupLocation: z.string().optional(),
  requiresInstallation: z.boolean().optional(),
  packedWeightKg: z.number().positive().optional(),
  packedLengthCm: z.number().positive().optional(),
  packedWidthCm:  z.number().positive().optional(),
  packedHeightCm: z.number().positive().optional(),
  shippingDataStatus: z.enum(['estimated', 'confirmed']).optional(),
});

const serviceProduct = z.object({
  ...shopBase,
  productType: z.literal('service'),
});

const shopProduct = z.discriminatedUnion('productType', [stockProduct, serviceProduct]).superRefine((product, ctx) => {
  if (product.productType === 'stock' && product.fulfilmentType === 'ship') {
    const requiredShippingFields = ['packedWeightKg', 'packedLengthCm', 'packedWidthCm', 'packedHeightCm', 'shippingDataStatus'] as const;
    for (const field of requiredShippingFields) {
      if (product[field] === undefined) {
        ctx.addIssue({ code: 'custom', path: [field], message: `Ship products must declare ${field}.` });
      }
    }
  }
}).transform((product) => ({
  ...product,
  name: product.title ?? product.name,
  description: product.tagline ?? product.description,
  title: product.title ?? product.name,
  tagline: product.tagline ?? product.description,
  price: String(product.price),
  compareAtPrice: product.compareAtPrice !== undefined ? String(product.compareAtPrice) : undefined,
  saleLabel: product.saleLabel,
  status: product.productType === 'stock'
    ? (product.availability === 'available_in_australia' || product.availability === 'made_to_order'
        ? 'available' as const
        : 'coming-soon' as const)
    : 'available' as const,
  availability: product.productType === 'stock'
    ? product.availability
    : (product.availability ?? 'available_in_australia'),
  onlinePurchaseEnabled: product.productType === 'stock'
    ? (product.onlinePurchaseEnabled ?? product.purchasableOnline ?? false)
    : (product.onlinePurchaseEnabled ?? product.purchasableOnline ?? false),
  purchasableOnline: product.productType === 'stock'
    ? (product.purchasableOnline ?? (product.availability === 'available_in_australia'))
    : (product.purchasableOnline ?? false),
  sourceType: product.sourceType ?? 'other',
  leadTimeText: product.leadTimeText,
  containerEtaText: product.containerEtaText,
  containerEtaDate: product.containerEtaDate,
  onSale: Boolean(product.onSale || product.compareAtPrice || product.saleLabel),
  heroImage: product.heroImage ?? product.images[0],
  gallery: product.gallery ?? product.images.slice(1),
  images: [product.heroImage ?? product.images[0], ...(product.gallery ?? product.images.slice(1))].filter(Boolean),
  keySpecs: [],
}));

const product = z.unknown().transform((value, ctx) => {
  const candidate = value && typeof value === 'object' && 'store' in value && value.store === true
    ? shopProduct
    : vehicleProduct;
  const result = candidate.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
  return z.NEVER;
});

const products = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/products' }),
  schema: product,
});

export const collections = { products };
