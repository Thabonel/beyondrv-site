export const STRIPE_DEPOSIT_PERCENT = 1 / 3;

export function parseMoneyValue(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return Number.NaN;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function calculateDepositAmount(price: number, depositPercent = STRIPE_DEPOSIT_PERCENT): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.max(1, Math.round(price * depositPercent));
}
