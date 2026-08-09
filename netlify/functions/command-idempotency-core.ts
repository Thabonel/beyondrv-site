import { createHash } from 'crypto';
import { getBlobStore } from './blob-store.ts';

export const SALES_IDEMPOTENCY_STORE = 'sales-command-idempotency';

export interface IdempotencyRecord {
  scope: string;
  keyHash: string;
  actorUserId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export function normaliseIdempotencyKey(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 240) : '';
}

function cleanScope(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, '-').slice(0, 100);
}

export function idempotencyKey(scope: string, rawKey: string) {
  const safeScope = cleanScope(scope) || 'command';
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  return `${safeScope}/${keyHash}.json`;
}

export async function readIdempotencyRecord(scope: string, rawKey: string) {
  const key = normaliseIdempotencyKey(rawKey);
  if (!key) return null;
  return getBlobStore(SALES_IDEMPOTENCY_STORE).get(idempotencyKey(scope, key), { type: 'json' }) as Promise<IdempotencyRecord | null>;
}

export async function writeIdempotencyRecord(
  scope: string,
  rawKey: string,
  record: Pick<IdempotencyRecord, 'actorUserId' | 'targetType' | 'targetId'>,
) {
  const key = normaliseIdempotencyKey(rawKey);
  if (!key) return null;
  const keyHash = createHash('sha256').update(key).digest('hex');
  const saved: IdempotencyRecord = {
    scope: cleanScope(scope),
    keyHash,
    actorUserId: record.actorUserId,
    targetType: record.targetType,
    targetId: record.targetId,
    createdAt: new Date().toISOString(),
  };
  await getBlobStore(SALES_IDEMPOTENCY_STORE).setJSON(idempotencyKey(scope, key), saved);
  return saved;
}
