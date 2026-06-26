import { canPurchaseOnline, canPurchaseVehicleOnline, getProductCheckoutOptions, isOnlinePayableFulfilment, type ShopAvailability, type FulfilmentType } from './checkout';

export function formatShopPrice(price: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(price);
}

export function shopProductPrice(price: string | number) {
  if (typeof price === 'number') return price;
  return Number(price.replace(/[^0-9.]/g, ''));
}

export function categorySlug(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export { canPurchaseOnline, canPurchaseVehicleOnline, getProductCheckoutOptions, isOnlinePayableFulfilment };
export type { ShopAvailability, FulfilmentType };

export interface FulfilmentInfo {
  message: string;
  checkoutEligible: boolean;
}

export function fulfilmentInfo(fulfilmentType: FulfilmentType): FulfilmentInfo {
  switch (fulfilmentType) {
    case 'ship':
      return { message: 'Delivery: Shipping available', checkoutEligible: true };
    case 'pickup':
      return { message: 'Delivery: Pickup from ByondRV Service Centre', checkoutEligible: true };
    case 'install':
      return { message: 'This item requires installation by the ByondRV team. Please enquire.', checkoutEligible: false };
    case 'quote_required':
      return { message: 'Freight or supply needs to be quoted. Please enquire.', checkoutEligible: false };
  }
}

export function availabilityLabel(availability: ShopAvailability): string {
  switch (availability) {
    case 'available_in_australia': return 'In stock';
    case 'coming_next_container': return 'Coming next container';
    case 'made_to_order': return 'Made to order';
    case 'ask_availability': return 'Ask about availability';
    case 'unavailable': return 'Unavailable';
  }
}

export function normalizeSaleLabel(value?: string) {
  const label = value?.trim();
  if (!label) return '';
  const upper = label.toUpperCase();
  switch (upper) {
    case 'IMMEDIATE DELIVERY':
      return 'Available now';
    case 'ON SALE':
      return 'On sale';
    case 'BUILD TO ORDER':
      return 'Build to order';
    case 'NEGOTIABLE':
      return 'Negotiable';
    case 'IMAGES COMING SOON':
      return 'Images coming soon';
    default:
      return label.replace(/\s+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

export function sourceTypeLabel(sourceType?: string) {
  switch (sourceType) {
    case 'china_container':
      return 'Source: China container';
    case 'local_supplier':
      return 'Source: Local supplier';
    case 'workshop_stock':
      return 'Source: Workshop stock';
    case 'custom_made_to_order':
      return 'Source: Custom made to order';
    case 'other':
    case undefined:
      return 'Source: Byond RV';
    default:
      return `Source: ${sourceType.replace(/_/g, ' ')}`;
  }
}

export function availabilitySchema(availability: ShopAvailability): string {
  switch (availability) {
    case 'available_in_australia': return 'https://schema.org/InStock';
    case 'coming_next_container': return 'https://schema.org/PreOrder';
    case 'made_to_order': return 'https://schema.org/MadeToOrder';
    case 'ask_availability': return 'https://schema.org/LimitedAvailability';
    case 'unavailable': return 'https://schema.org/OutOfStock';
  }
}
