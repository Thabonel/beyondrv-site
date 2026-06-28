export const DEFAULT_VIDEO_UPLOAD_DATE = '2026-06-01T00:00:00+10:00';
const BRAND = {
  "@type": "Brand",
  name: "Beyond RV",
};
const MANUFACTURER = {
  "@type": "Organization",
  name: "Beyond RV",
  url: "https://beyondrv.com.au/",
};
const MERCHANT_RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "AU",
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
};
const MERCHANT_SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingDestination: {
    "@type": "DefinedRegion",
    addressCountry: "AU",
  },
  shippingRate: {
    "@type": "MonetaryAmount",
    value: "0",
    currency: "AUD",
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 0,
      unitCode: "DAY",
    },
    transitTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 0,
      unitCode: "DAY",
    },
  },
  shippingLabel: "Workshop pickup or delivery arranged directly with Beyond RV.",
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
  const offer = buildProductOffer({ price, status, url, availability });
  if (!offer) return undefined;
  return {
    ...offer,
    hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY,
    shippingDetails: MERCHANT_SHIPPING_DETAILS,
  };
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
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name,
    description,
    url,
    sku: buildProductSku(slug),
    brand: BRAND,
    manufacturer: MANUFACTURER,
    image,
    category,
    itemCondition: "https://schema.org/NewCondition",
    areaServed: {
      "@type": "Country",
      name: "Australia",
    },
  };

  const offer = buildMerchantOffer({ price, status, url, availability });
  if (offer) product.offers = offer;

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
