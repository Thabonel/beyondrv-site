/**
 * Alex adds the people who will not log in, and takes their links away again.
 *
 * A key is shown exactly once, when it is made. After that only its hash
 * exists, so "send it again" is not an option: the answer is Reissue, which
 * takes one tap and kills the old link.
 */
import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { CREW_STORE, crewKey, generateCrewKey, hashCrewKey, newCrewId, validateCrewMember, type CrewMember } from './crew-core';
import { listCrew } from './crew-auth';
import { appendOwnerAudit } from './owner-copilot-store-utils';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Never includes the key or its hash: Alex's list has no need for either. */
function forDisplay(member: CrewMember) {
  return {
    id: member.id,
    name: member.name,
    scope: member.scope,
    keyIssuedAt: member.keyIssuedAt,
    revokedAt: member.revokedAt,
    lastSeenAt: member.lastSeenAt,
  };
}

export const handler: Handler = async (event) => {
  const method = event.httpMethod;
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return { statusCode: 405, body: 'Method Not Allowed' };

  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  const capability = method === 'GET' ? 'sales:read' : 'sales:write';
  if (!hasAdminCapability(actor, capability)) return forbiddenResponse(capability);

  connectBlobStore(event);
  const by = actor.displayName || actor.id || 'admin';

  try {
    const store = getBlobStore(CREW_STORE);

    if (method === 'GET') {
      const members = (await listCrew()).sort((a, b) => a.name.localeCompare(b.name));
      return json(200, { crew: members.map(forDisplay) });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    } catch {
      return json(400, { error: 'Invalid request' });
    }

    if (method === 'POST') {
      const validation = validateCrewMember(body);
      if (!validation.ok) return json(400, { error: validation.error });
      const key = generateCrewKey();
      const now = new Date().toISOString();
      const member: CrewMember = {
        id: newCrewId(),
        name: validation.name,
        scope: validation.scope,
        keyHash: hashCrewKey(key),
        keyIssuedAt: now,
        revokedAt: '',
        lastSeenAt: '',
        createdBy: by,
        createdAt: now,
        updatedAt: now,
      };
      await store.setJSON(crewKey(member.id), member);
      await appendOwnerAudit('crew_member_added', 'crew', member.id, { name: member.name, scope: member.scope }, actor);
      // The one time the key is ever returned.
      return json(200, { ok: true, member: forDisplay(member), key, message: `${member.name} is set up. Send them the link now: it cannot be shown again.` });
    }

    const id = clean(body.id);
    if (!id) return json(400, { error: 'Which person?' });
    const existing = await store.get(crewKey(id), { type: 'json' }) as CrewMember | null;
    if (!existing) return json(404, { error: 'No such person.' });

    if (method === 'DELETE') {
      await store.setJSON(crewKey(id), { ...existing, revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await appendOwnerAudit('crew_member_revoked', 'crew', id, { name: existing.name }, actor);
      return json(200, { ok: true, message: `${existing.name}'s link no longer works.` });
    }

    // PATCH reissues: a new key, and the old one stops working immediately.
    const key = generateCrewKey();
    const now = new Date().toISOString();
    const member: CrewMember = { ...existing, keyHash: hashCrewKey(key), keyIssuedAt: now, revokedAt: '', updatedAt: now };
    await store.setJSON(crewKey(id), member);
    await appendOwnerAudit('crew_key_reissued', 'crew', id, { name: existing.name }, actor);
    return json(200, { ok: true, member: forDisplay(member), key, message: `${existing.name} has a new link. Their old one stopped working just now.` });
  } catch (error) {
    console.warn('admin-crew: failed', { error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
