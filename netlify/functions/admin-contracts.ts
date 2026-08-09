import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  CONTRACT_STORE,
  contractKey,
  normaliseContractInput,
  renderContractHtml,
  validateContract,
  type ContractRecord,
} from './contract-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import { idempotencyKey, normaliseIdempotencyKey, readIdempotencyRecord, writeIdempotencyRecord } from './command-idempotency-core';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    body: JSON.stringify(body),
  };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function readBody(raw: string | null) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function listContracts() {
  const store = getBlobStore(CONTRACT_STORE);
  const { blobs } = await store.list({ prefix: 'contracts/' });
  const records = await Promise.all(blobs.map(async blob => {
    try {
      return await store.get(blob.key, { type: 'json' }) as ContractRecord | null;
    } catch {
      return null;
    }
  }));
  return records
    .filter((record): record is ContractRecord => Boolean(record?.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const handler: Handler = async event => {
  if (!['GET', 'POST', 'PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, event.httpMethod === 'GET' ? 'agreements:read' : 'agreements:write')) {
    return forbiddenResponse(event.httpMethod === 'GET' ? 'agreements:read' : 'agreements:write');
  }
  const blobRuntimeSource = connectBlobStore(event);

  let store: ReturnType<typeof getBlobStore>;
  try {
    store = getBlobStore(CONTRACT_STORE);
  } catch (error) {
    console.warn('admin-contracts: store unavailable', { blobRuntimeSource, error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }

  if (event.httpMethod === 'GET') {
    const id = clean(event.queryStringParameters?.id);
    if (id) {
      const contract = await store.get(contractKey(id), { type: 'json' }) as ContractRecord | null;
      if (!contract) return json(404, { error: 'Contract not found.' });
      return json(200, { contract, validation: validateContract(contract) });
    }
    const contracts = await listContracts();
    return json(200, { contracts });
  }

  const body = await readBody(event.body);
  if (!body) return json(400, { error: 'Invalid JSON request.' });
  if ((body.action === 'approve' || body.status === 'approved') && !hasAdminCapability(actor, 'agreements:approve')) {
    return forbiddenResponse('agreements:approve');
  }

  if (event.httpMethod === 'POST' && body.action === 'preview') {
    const draft = normaliseContractInput(body.contract && typeof body.contract === 'object' ? body.contract as Record<string, unknown> : body);
    const validation = validateContract(draft);
    return json(200, { contract: draft, validation, html: renderContractHtml(draft) });
  }

  if (event.httpMethod === 'POST') {
    const requestIdempotencyKey = normaliseIdempotencyKey(body.idempotencyKey);
    if (requestIdempotencyKey) {
      const prior = await readIdempotencyRecord('agreement:create', requestIdempotencyKey);
      if (prior?.targetType === 'agreement' && prior.targetId) {
        const priorContract = await store.get(contractKey(prior.targetId), { type: 'json' }) as ContractRecord | null;
        if (!priorContract) return json(409, { error: 'The previous agreement creation result could not be recovered. Do not retry without resolving the stored idempotency record.' });
        return json(200, { ok: true, idempotentReplay: true, contract: priorContract, validation: validateContract(priorContract) });
      }
    }
    const requested = body.status === 'approved' && body.action !== 'approve' ? { ...body, status: 'draft' } : body;
    const contract = normaliseContractInput(requested, null, { actorUserId: actor.id });
    const validation = validateContract(contract);
    if (contract.status === 'approved' && !validation.valid) {
      return json(400, { error: 'Fix validation errors before approving this contract.', validation });
    }
    await store.setJSON(contractKey(contract.id), contract);
    if (requestIdempotencyKey) {
      await writeIdempotencyRecord('agreement:create', requestIdempotencyKey, {
        actorUserId: actor.id,
        targetType: 'agreement',
        targetId: contract.id,
      });
    }
    await Promise.all([
      appendOwnerAudit('contract_created', 'contract', contract.id, {
        contractNumber: contract.contractNumber,
        status: contract.status,
        totalCents: validation.totalCents,
        templateVersion: contract.templateVersion,
      }, actor),
      appendOwnerTimeline('contract_created', `Contract ${contract.contractNumber} created for ${contract.buyer.name || contract.buyer.email || 'buyer'}.`, {
        relatedLeadId: contract.leadId,
        relatedCustomerId: contract.customerId,
        source: 'admin-contracts',
      }),
      appendSalesActivity(buildSalesActivityEvent({
        commandId: requestIdempotencyKey ? idempotencyKey('agreement:create', requestIdempotencyKey) : '',
        activityType: 'agreement_created',
        summary: `Agreement ${contract.contractNumber} created for ${contract.buyer.name || contract.buyer.email || 'buyer'}.`,
        customerId: contract.customerId,
        opportunityId: contract.opportunityId,
        enquiryId: contract.sourceEnquiryId,
        agreementId: contract.id,
        configurationId: contract.configurationReference?.configurationId || '',
        source: 'gm_ui',
        metadata: { status: contract.status, totalCents: validation.totalCents, templateVersion: contract.templateVersion },
      }, actor)),
    ]);
    return json(201, { ok: true, contract, validation });
  }

  const id = clean(body.id);
  if (!id) return json(400, { error: 'Missing contract id.' });
  const existing = await store.get(contractKey(id), { type: 'json' }) as ContractRecord | null;
  if (!existing) return json(404, { error: 'Contract not found.' });
  if (['sent', 'signed', 'superseded'].includes(existing.status)) {
    return json(409, { error: 'Sent and signed contract versions are immutable. Create a revision or addendum instead.' });
  }
  if (existing.signature?.documentId) {
    return json(409, { error: 'This historical contract version already has a signature-provider document and is immutable. Create a revision instead.' });
  }
  if (existing.documentSnapshot?.sha256 || (existing.acceptance?.status && existing.acceptance.status !== 'not_prepared')) {
    return json(409, { error: 'The final copy for this contract version has already been prepared and is immutable. Create a revision instead.' });
  }

  const requested = body.status === 'approved' && body.action !== 'approve' ? { ...body, status: 'draft' } : body;
  const contract = normaliseContractInput(requested, existing, { actorUserId: actor.id });
  const validation = validateContract(contract);
  if (contract.status === 'approved' && !validation.valid) {
    return json(400, { error: 'Fix validation errors before approving this contract.', validation });
  }
  await store.setJSON(contractKey(id), contract);
  await Promise.all([
    appendOwnerAudit(contract.status === 'approved' && existing.status !== 'approved' ? 'contract_approved' : 'contract_updated', 'contract', id, {
      contractNumber: contract.contractNumber,
      previousStatus: existing.status,
      status: contract.status,
      totalCents: validation.totalCents,
    }, actor),
    appendOwnerTimeline('contract_updated', `Contract ${contract.contractNumber} updated${contract.status !== existing.status ? ` from ${existing.status} to ${contract.status}` : ''}.`, {
      relatedLeadId: contract.leadId,
      relatedCustomerId: contract.customerId,
      source: 'admin-contracts',
    }),
    appendSalesActivity(buildSalesActivityEvent({
      activityType: contract.status === 'approved' && existing.status !== 'approved' ? 'agreement_approved' : 'agreement_updated',
      summary: `Agreement ${contract.contractNumber} ${contract.status === 'approved' && existing.status !== 'approved' ? 'approved' : 'updated'}.`,
      customerId: contract.customerId,
      opportunityId: contract.opportunityId,
      enquiryId: contract.sourceEnquiryId,
      agreementId: contract.id,
      configurationId: contract.configurationReference?.configurationId || '',
      source: 'gm_ui',
      metadata: { previousStatus: existing.status, status: contract.status, totalCents: validation.totalCents },
    }, actor)),
  ]);
  return json(200, { ok: true, contract, validation });
};
