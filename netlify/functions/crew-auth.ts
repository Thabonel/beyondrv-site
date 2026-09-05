/**
 * Turning a key in a header into a person, or into a refusal.
 *
 * Shared by the two crew endpoints so there is exactly one place that decides
 * whether a link works. The key is read from `X-Crew-Key` and nowhere else:
 * a key in a path or a query string would be written to Netlify's access log
 * the first time it was used, which is the thing the fragment exists to avoid.
 */
import type { HandlerEvent } from '@netlify/functions';
import { getBlobStore, safeBlobStoreError } from './blob-store';
import {
  CREW_STORE,
  crewKey,
  findCrewByKey,
  isLockedOut,
  KEY_REFUSAL,
  looksLikeCrewKey,
  registerFailedAttempt,
  type AttemptRecord,
  type CrewMember,
} from './crew-core';
import { appendOwnerAudit } from './owner-copilot-store-utils';

const ATTEMPT_STORE = 'calendar-crew-attempts';

export function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    body: JSON.stringify(body),
  };
}

function attemptKey(address: string) {
  // The address is only ever used to slow a guesser down, so it is hashed
  // rather than stored: this file has no reason to keep anyone's IP.
  return `attempts/${Buffer.from(address).toString('base64url').slice(0, 60)}.json`;
}

function callerAddress(event: HandlerEvent) {
  const forwarded = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '';
  return forwarded.split(',')[0].trim() || 'unknown';
}

export async function listCrew(): Promise<CrewMember[]> {
  const store = getBlobStore(CREW_STORE);
  const { blobs } = await store.list({ prefix: 'crew/' });
  const members = await Promise.all(blobs.map(async (blob) => {
    try {
      return await store.get(blob.key, { type: 'json' }) as CrewMember | null;
    } catch {
      return null;
    }
  }));
  return members.filter((member): member is CrewMember => Boolean(member?.id));
}

export type CrewAuth =
  | { ok: true; member: CrewMember }
  | { ok: false; statusCode: number };

/**
 * An unknown key, a revoked one and a locked-out caller are all refused the
 * same way, so a link that stops working never says why.
 */
export async function authenticateCrew(event: HandlerEvent): Promise<CrewAuth> {
  const key = event.headers['x-crew-key'] || '';
  const address = callerAddress(event);
  const attempts = getBlobStore(ATTEMPT_STORE);
  const now = Date.now();

  let record: AttemptRecord | null = null;
  try {
    record = await attempts.get(attemptKey(address), { type: 'json' }) as AttemptRecord | null;
  } catch {
    record = null;
  }
  if (isLockedOut(record, now)) return { ok: false, statusCode: 429 };

  if (looksLikeCrewKey(key)) {
    const member = findCrewByKey(await listCrew(), key);
    if (member) {
      // Recorded so Alex can see whether a link is actually being used, and
      // written without blocking the response if the store is unhappy.
      const store = getBlobStore(CREW_STORE);
      store.setJSON(crewKey(member.id), { ...member, lastSeenAt: new Date().toISOString() })
        .catch((error) => console.warn('crew-auth: could not record last seen', { id: member.id, error: safeBlobStoreError(error) }));
      return { ok: true, member };
    }
  }

  const next = registerFailedAttempt(record, now);
  try {
    await attempts.setJSON(attemptKey(address), next);
  } catch (error) {
    console.warn('crew-auth: could not record a failed attempt', { error: safeBlobStoreError(error) });
  }
  if (next.lockedUntil > now) {
    await appendOwnerAudit('crew_key_lockout', 'crew', 'unknown', { failures: next.failures.length }, 'crew-auth');
  }
  return { ok: false, statusCode: 401 };
}

export function refusal(statusCode: number) {
  return json(statusCode, { error: KEY_REFUSAL });
}
