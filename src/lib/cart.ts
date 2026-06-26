export interface CartItem {
  slug: string;
  quantity: number;
}

export interface CatalogueEntry {
  slug: string;
  name: string;
  price: number;
  image: string;
  href: string;
  fulfilmentMessage: string;
  checkoutEligible: boolean;
  shippable: boolean;
}

export type Catalogue = Record<string, CatalogueEntry>;

export const CART_STORAGE_KEY = 'byondrv-cart';
export const CART_EVENT = 'cart:change';
export const ORDER_MAX = 99;

export function clampQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return 1;
  const value = Math.floor(quantity);
  if (value < 1) return 1;
  if (max > 0 && value > max) return max;
  return value;
}

export function addItem(items: CartItem[], slug: string, max: number, amount = 1): CartItem[] {
  if (max < 1) return items;
  const existing = items.find((item) => item.slug === slug);
  if (existing) {
    return items.map((item) =>
      item.slug === slug ? { ...item, quantity: clampQuantity(item.quantity + amount, max) } : item,
    );
  }
  return [...items, { slug, quantity: clampQuantity(amount, max) }];
}

export function setQuantity(items: CartItem[], slug: string, quantity: number, max: number): CartItem[] {
  return items
    .map((item) => (item.slug === slug ? { ...item, quantity: clampQuantity(quantity, max) } : item))
    .filter((item) => item.quantity > 0);
}

export function removeItem(items: CartItem[], slug: string): CartItem[] {
  return items.filter((item) => item.slug !== slug);
}

export function totalCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function subtotal(items: CartItem[], catalogue: Catalogue): number {
  return items.reduce((sum, item) => {
    const entry = catalogue[item.slug];
    return entry ? sum + entry.price * item.quantity : sum;
  }, 0);
}

export function readCart(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.slug === 'string' && Number.isFinite(item.quantity))
      .map((item) => ({ slug: item.slug as string, quantity: Math.max(1, Math.floor(item.quantity)) }));
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function notifyCartChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}
