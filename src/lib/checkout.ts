import { calculateDepositAmount, parseMoneyValue, STRIPE_DEPOSIT_PERCENT } from './payment.ts';

export type ShopAvailability =
  | 'available_in_australia'
  | 'coming_next_container'
  | 'made_to_order'
  | 'ask_availability'
  | 'unavailable';

export type FulfilmentType = 'ship' | 'pickup' | 'install' | 'quote_required';

export type ShippingSize = 'small' | 'medium' | 'large' | 'oversized';

export type ShippingDataStatus = 'estimated' | 'confirmed';

export const CHECKOUT_MAX_QUANTITY = 99;

export function canPurchaseOnline(product: { availability: ShopAvailability; purchasableOnline: boolean }): boolean {
  return product.purchasableOnline === true && product.availability === 'available_in_australia';
}

export function isOnlinePayableFulfilment(fulfilmentType: FulfilmentType | undefined): boolean {
  return fulfilmentType === 'ship' || fulfilmentType === 'pickup';
}

function isVehicleOnlinePurchaseEnabled(product: {
  onlinePurchaseEnabled?: boolean;
  purchasableOnline?: boolean;
}) {
  return product.onlinePurchaseEnabled === true || product.purchasableOnline === true;
}

function isVehicleAvailabilityEligible(availability?: ShopAvailability) {
  return Boolean(availability && ['available_in_australia', 'coming_next_container', 'made_to_order'].includes(availability));
}

function normaliseDepositPercent(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : STRIPE_DEPOSIT_PERCENT;
}

export function canPurchaseVehicleOnline(product: {
  availability?: ShopAvailability;
  onlinePurchaseEnabled?: boolean;
  purchasableOnline?: boolean;
  depositEnabled?: boolean;
  fullPaymentEnabled?: boolean;
}, purchaseType: 'deposit' | 'full'): boolean {
  if (!isVehicleOnlinePurchaseEnabled(product)) return false;
  if (!isVehicleAvailabilityEligible(product.availability)) return false;
  if (purchaseType === 'deposit') return product.depositEnabled !== false;
  return product.fullPaymentEnabled !== false;
}

export interface ProductCheckoutOptions {
  isEligible: boolean;
  salePrice: number;
  depositPercentage: number;
  depositAmount: number;
  legalNoticeText: string[];
  supportsDeposit: boolean;
  supportsFullPrice: boolean;
  fullPriceAmount: number;
}

export function getProductCheckoutOptions(product: {
  price?: string | number;
  availability?: ShopAvailability;
  onlinePurchaseEnabled?: boolean;
  purchasableOnline?: boolean;
  depositEnabled?: boolean;
  fullPaymentEnabled?: boolean;
}, depositPercent = STRIPE_DEPOSIT_PERCENT, legalNoticeText: string[] = []): ProductCheckoutOptions {
  const salePrice = parseMoneyValue(product.price ?? '');
  const depositPercentage = normaliseDepositPercent(depositPercent);
  const hasTrustedPrice = Number.isFinite(salePrice) && salePrice > 0;
  const onlinePurchaseEnabled = isVehicleOnlinePurchaseEnabled(product);
  const availabilityEligible = isVehicleAvailabilityEligible(product.availability);
  const supportsDeposit = onlinePurchaseEnabled && availabilityEligible && hasTrustedPrice && product.depositEnabled !== false;
  const supportsFullPrice = onlinePurchaseEnabled && availabilityEligible && hasTrustedPrice && product.fullPaymentEnabled !== false;
  const isEligible = supportsDeposit || supportsFullPrice;
  const noticeLines = Array.isArray(legalNoticeText)
    ? legalNoticeText.map((line) => line.trim()).filter(Boolean)
    : [];

  return {
    isEligible,
    salePrice: hasTrustedPrice ? salePrice : 0,
    depositPercentage,
    depositAmount: supportsDeposit ? calculateDepositAmount(salePrice, depositPercentage) : 0,
    legalNoticeText: noticeLines,
    supportsDeposit,
    supportsFullPrice,
    fullPriceAmount: supportsFullPrice ? Math.max(1, Math.round(salePrice)) : 0,
  };
}

export interface ShopManifestEntry {
  slug: string;
  name: string;
  price: number;
  image: string;
  productType: 'stock' | 'service';
  availability?: ShopAvailability;
  purchasableOnline?: boolean;
  fulfilmentType?: FulfilmentType;
  shippingSize?: ShippingSize;
  packedWeightKg?: number;
  packedLengthCm?: number;
  packedWidthCm?: number;
  packedHeightCm?: number;
  shippingDataStatus?: ShippingDataStatus;
}

export type ShopCatalogue = Record<string, ShopManifestEntry>;

export interface CheckoutLineItem {
  slug: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export type CheckoutErrorCode =
  | 'EMPTY_CART'
  | 'INVALID_ITEM'
  | 'INVALID_QUANTITY'
  | 'UNKNOWN_PRODUCT'
  | 'NOT_PURCHASABLE'
  | 'INVALID_PRICE';

export type CheckoutValidation =
  | { ok: true; items: CheckoutLineItem[] }
  | { ok: false; code: CheckoutErrorCode; message: string };

export function buildCatalogue(entries: ShopManifestEntry[]): ShopCatalogue {
  const catalogue: ShopCatalogue = {};
  for (const entry of entries) catalogue[entry.slug] = entry;
  return catalogue;
}

/**
 * Validates a requested cart against trusted published product data.
 * The client may only supply { slug, quantity }; price, title, availability
 * and purchasability are always taken from the trusted catalogue, never the client.
 */
export function validateCheckout(catalogue: ShopCatalogue, requested: unknown): CheckoutValidation {
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, code: 'EMPTY_CART', message: 'Your cart is empty.' };
  }

  const items: CheckoutLineItem[] = [];

  for (const raw of requested) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, code: 'INVALID_ITEM', message: 'Your cart could not be read. Please refresh and try again.' };
    }

    const slug = (raw as { slug?: unknown }).slug;
    const quantity = (raw as { quantity?: unknown }).quantity;

    if (typeof slug !== 'string' || slug.length === 0) {
      return { ok: false, code: 'INVALID_ITEM', message: 'Your cart could not be read. Please refresh and try again.' };
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > CHECKOUT_MAX_QUANTITY) {
      return { ok: false, code: 'INVALID_QUANTITY', message: 'One of the quantities in your cart is not valid.' };
    }

    const product = catalogue[slug];
    if (!product) {
      return { ok: false, code: 'UNKNOWN_PRODUCT', message: 'One of the items in your cart is no longer available.' };
    }

    const purchasable =
      product.productType === 'stock' &&
      canPurchaseOnline({
        availability: product.availability ?? 'unavailable',
        purchasableOnline: product.purchasableOnline ?? false,
      }) &&
      isOnlinePayableFulfilment(product.fulfilmentType);

    if (!purchasable) {
      return {
        ok: false,
        code: 'NOT_PURCHASABLE',
        message: `"${product.name}" is not available for online checkout yet. Please ask us about availability.`,
      };
    }

    if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0) {
      return { ok: false, code: 'INVALID_PRICE', message: 'This item cannot be purchased online right now.' };
    }

    items.push({ slug: product.slug, name: product.name, unitPrice: product.price, quantity });
  }

  return { ok: true, items };
}
