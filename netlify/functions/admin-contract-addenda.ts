import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { CONTRACT_STORE, contractKey, type ContractRecord } from './contract-core';
import {
  CONTRACT_ADDENDUM_STORE,
  addendumKey,
  calculateEffectiveDeal,
  normaliseAddendumInput,
  renderAddendumHtml,
  validateAddendum,
  type ContractAddendumRecord,
} from './contract-change-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }, body: JSON.stringify(body) };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function listAddenda(contractId?: string) {
  const store = getBlobStore(CONTRACT_ADDENDUM_STORE);
  const { blobs } = await store.list({ prefix: 'addenda/' });
  const records = await Promise.all(blobs.map(async blob => {
    try { return await store.get(blob.key, { type: 'json' }) as ContractAddendumRecord | null; }
    catch { return null; }
  }));
  return records
    .filter((record): record is ContractAddendumRecord => Boolean(record?.id))
    .filter(record => !contractId || record.contractId === contractId)
    .sort((a, b) => a.sequence - b.sequence);
}

function requestedStatus(body: Record<string, unknown>, existing?: ContractAddendumRecord | null) {
  if (body.action === 'approve') return 'approved';
  if (body.action === 'ready_for_review') return 'ready_for_review';
  if (existing?.status === 'approved') return 'draft';
  return existing?.status || 'draft';
}

export const handler: Handler = async event => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, event.httpMethod === 'GET' ? 'agreements:read' : 'agreements:write')) {
    return forbiddenResponse(event.httpMethod === 'GET' ? 'agreements:read' : 'agreements:write');
  }
  const blobRuntimeSource = connectBlobStore(event);

  let contractStore: ReturnType<typeof getBlobStore>;
  let addendumStore: ReturnType<typeof getBlobStore>;
  try {
    contractStore = getBlobStore(CONTRACT_STORE);
    addendumStore = getBlobStore(CONTRACT_ADDENDUM_STORE);
  } catch (error) {
    console.warn('admin-contract-addenda: store unavailable', { blobRuntimeSource, error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }

  if (event.httpMethod === 'GET') {
    const id = clean(event.queryStringParameters?.id);
    if (id) {
      const addendum = await addendumStore.get(addendumKey(id), { type: 'json' }) as ContractAddendumRecord | null;
      if (!addendum) return json(404, { error: 'Addendum not found.' });
      const contract = await contractStore.get(contractKey(addendum.contractId), { type: 'json' }) as ContractRecord | null;
      return json(200, { addendum, validation: validateAddendum(addendum, contract), html: contract ? renderAddendumHtml(addendum, contract) : '' });
    }
    const contractId = clean(event.queryStringParameters?.contractId);
    if (!contractId) return json(400, { error: 'Missing contract id.' });
    const contract = await contractStore.get(contractKey(contractId), { type: 'json' }) as ContractRecord | null;
    if (!contract) return json(404, { error: 'Contract not found.' });
    const addenda = await listAddenda(contractId);
    return json(200, { addenda, effectiveDeal: calculateEffectiveDeal(contract, addenda) });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
  catch { return json(400, { error: 'Invalid JSON request.' }); }

  const existingId = event.httpMethod === 'PATCH' ? clean(body.id) : '';
  const existing = existingId
    ? await addendumStore.get(addendumKey(existingId), { type: 'json' }) as ContractAddendumRecord | null
    : null;
  if (existingId && !existing) return json(404, { error: 'Addendum not found.' });
  if (existing && (['sent', 'signed'].includes(existing.status) || existing.signature?.documentId)) {
    return json(409, { error: 'Sent and accepted addenda are immutable. Create a new addendum for any further change.' });
  }
  if (existing?.documentSnapshot?.sha256 || (existing?.acceptance?.status && existing.acceptance.status !== 'not_prepared')) {
    return json(409, { error: 'The final copy for this addendum has already been prepared and is immutable. Create a new addendum for any further change.' });
  }

  const contractId = existing?.contractId || clean(body.contractId);
  if (!contractId) return json(400, { error: 'Missing signed contract id.' });
  const contract = await contractStore.get(contractKey(contractId), { type: 'json' }) as ContractRecord | null;
  if (!contract) return json(404, { error: 'Contract not found.' });

  const addenda = await listAddenda(contractId);
  const sequence = existing?.sequence || Math.max(0, ...addenda.map(addendum => addendum.sequence)) + 1;
  const effectiveDeal = calculateEffectiveDeal(contract, addenda);
  const previousTotalCents = existing?.previousTotalCents ?? effectiveDeal.effectiveTotalCents;
  const input = { ...body, status: requestedStatus(body, existing) };
  if (body.action === 'approve' && !hasAdminCapability(actor, 'agreements:approve')) return forbiddenResponse('agreements:approve');
  const addendum = normaliseAddendumInput(input, contract, previousTotalCents, sequence, existing, { actorUserId: actor.id });
  const validation = validateAddendum(addendum, contract);
  const html = renderAddendumHtml(addendum, contract);

  if (body.action === 'preview') return json(200, { addendum, validation, html, effectiveDeal });
  if (['ready_for_review', 'approve'].includes(String(body.action)) && !validation.valid) {
    return json(400, { error: 'Fix validation errors before advancing this addendum.', validation, addendum });
  }

  await addendumStore.setJSON(addendumKey(addendum.id), addendum);
  const eventType = !existing ? 'contract_addendum_created' : addendum.status === 'approved' && existing.status !== 'approved' ? 'contract_addendum_approved' : 'contract_addendum_updated';
  await Promise.all([
    appendOwnerAudit(eventType, 'contract_addendum', addendum.id, {
      addendumNumber: addendum.addendumNumber,
      contractId,
      status: addendum.status,
      netChangeCents: addendum.netChangeCents,
      revisedTotalCents: addendum.revisedTotalCents,
      sourceType: addendum.sourceType,
    }, actor),
    appendOwnerTimeline(eventType, `${addendum.addendumNumber} ${existing ? 'updated' : 'created'} for contract ${contract.contractNumber}.`, {
      relatedLeadId: contract.leadId,
      relatedCustomerId: contract.customerId,
      source: 'admin-contract-addenda',
    }),
  ]);
  return json(existing ? 200 : 201, { ok: true, addendum, validation, html, effectiveDeal });
};
