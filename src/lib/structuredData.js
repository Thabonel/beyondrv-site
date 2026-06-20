export const DEFAULT_VIDEO_UPLOAD_DATE = '2026-06-01T00:00:00+10:00';

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
    "priceValidUntil": "2026-12-31",
    "itemCondition": "https://schema.org/NewCondition",
    "availability": availability ?? (isComingSoon ? "https://schema.org/PreOrder" : "https://schema.org/InStock"),
    "seller": {
      "@type": "Organization",
      "name": "Beyond RV",
      "url": "https://beyondrv.com.au/"
    }
  };
}
