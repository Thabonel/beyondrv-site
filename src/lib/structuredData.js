import {
  MERCHANT_RETURN_POLICY_ID,
  MERCHANT_SHIPPING_SERVICE_ID,
  ORGANIZATION_ID,
} from '../data/siteIdentity.js';

export const DEFAULT_VIDEO_UPLOAD_DATE = '2026-06-01T00:00:00+10:00';
const BRAND = {
  "@type": "Brand",
  name: "Beyond RV",
};
const AVAILABILITY = {
  available: 'https://schema.org/InStock',
  available_in_australia: 'https://schema.org/InStock',
  in_stock: 'https://schema.org/InStock',
  sold: 'https://schema.org/SoldOut',
  sold_out: 'https://schema.org/SoldOut',
  unavailable: 'https://schema.org/OutOfStock',
  out_of_stock: 'https://schema.org/OutOfStock',
  preorder: 'https://schema.org/PreOrder',
  pre_order: 'https://schema.org/PreOrder',
  made_to_order: 'https://schema.org/PreOrder',
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const ZONED_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidDateTime(value) {
  return Number.isFinite(Date.parse(value));
}

export function normalizeVideoUploadDate(value) {
  const uploadDate = value?.trim();
  if (!uploadDate) return DEFAULT_VIDEO_UPLOAD_DATE;

  if (DATE_ONLY.test(uploadDate)) {
    const zonedDate = `${uploadDate}T00:00:00+10:00`;
    return isValidDateTime(zonedDate) ? zonedDate : DEFAULT_VIDEO_UPLOAD_DATE;
  }

  if (LOCAL_DATE_TIME.test(uploadDate)) {
    const zonedDate = `${uploadDate}+10:00`;
    return isValidDateTime(zonedDate) ? zonedDate : DEFAULT_VIDEO_UPLOAD_DATE;
  }

  if (ZONED_DATE_TIME.test(uploadDate) && isValidDateTime(uploadDate)) return uploadDate;

  return DEFAULT_VIDEO_UPLOAD_DATE;
}

export function parsePriceNumeric(price) {
  if (!price) return undefined;
  const numeric = String(price).replace(/[^0-9.]/g, '');
  return numeric || undefined;
}

export function buildProductSku(slug) {
  const input = String(slug ?? '');
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let hash = 0;
  for (const char of input) hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  const suffix = hash.toString(36).toUpperCase().padStart(6, '0').slice(-6);
  const prefix = cleaned.slice(0, 12).replace(/-+$/g, '') || 'ITEM';
  return `BRV-${prefix}-${suffix}`;
}

export function buildMerchantOffer({ price, status, url, availability }) {
  return buildProductOffer({ price, status, url, availability });
}

export function buildMerchantProduct({
  slug,
  name,
  description,
  url,
  image,
  price,
  status,
  availability,
  category,
}) {
  const offer = buildMerchantOffer({ price, status, url, availability });
  if (!offer) return undefined;

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name,
    description,
    url,
    sku: buildProductSku(slug),
    brand: BRAND,
    image,
    category,
    itemCondition: "https://schema.org/NewCondition",
    areaServed: {
      "@type": "Country",
      name: "Australia",
    },
    offers: offer,
  };

  return product;
}

/**
 * Build a schema.org Offer object for a product.
 * @param {Object} options
 * @param {any} options.price
 * @param {any} options.status
 * @param {any} options.url
 * @param {any} [options.availability]
 * @returns {Object|undefined}
 */
export function buildProductOffer({ price, status, url, availability }) {
  const priceNum = parsePriceNumeric(price);
  if (!priceNum) return undefined;
  const isComingSoon = status === 'coming-soon';
  return {
    "@type": "Offer",
    "url": url,
    "priceCurrency": "AUD",
    "price": priceNum,
    "itemCondition": "https://schema.org/NewCondition",
    "availability": normalizeAvailability(availability, isComingSoon),
    "hasMerchantReturnPolicy": {
      "@id": MERCHANT_RETURN_POLICY_ID
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "hasShippingService": {
        "@id": MERCHANT_SHIPPING_SERVICE_ID
      }
    },
    "seller": {
      "@id": ORGANIZATION_ID
    }
  };
}

export function normalizeAvailability(value, isComingSoon = false) {
  if (typeof value === 'string' && value.startsWith('https://schema.org/')) return value;
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return AVAILABILITY[key] ?? (isComingSoon ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock');
}
