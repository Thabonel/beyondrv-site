import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import { CONTRACT_STORE, contractKey, createContractRevision, diffContractVersions, type ContractRecord } from './contract-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function listContracts() {
  const store = getBlobStore(CONTRACT_STORE);
  const { blobs } = await store.list({ prefix: 'contracts/' });
  const records = await Promise.all(blobs.map(blob => store.get(blob.key, { type: 'json' }).catch(() => null) as Promise<ContractRecord | null>));
  return records.filter((record): record is ContractRecord => Boolean(record?.id));
}

export const handler: Handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, event.httpMethod === 'GET' ? 'agreements:read' : 'agreements:write')) {
    return forbiddenResponse(event.httpMethod === 'GET' ? 'agreements:read' : 'agreements:write');
  }
  connectBlobStore(event);
  const store = getBlobStore(CONTRACT_STORE);

  if (event.httpMethod === 'GET') {
    const contractNumber = clean(event.queryStringParameters?.contractNumber, 100);
    if (!contractNumber) return json(400, { error: 'Missing contract number.' });
    const revisions = (await listContracts())
      .filter(contract => contract.contractNumber === contractNumber)
      .sort((a, b) => a.version - b.version);
    return json(200, { revisions });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
  catch { return json(400, { error: 'Invalid JSON request.' }); }
  const parentId = clean(body.parentId, 240);
  const reason = clean(body.reason);
  if (!parentId || !reason) return json(400, { error: 'Select a contract and record the reason for the revision.' });
  const parent = await store.get(contractKey(parentId), { type: 'json' }) as ContractRecord | null;
  if (!parent) return json(404, { error: 'Contract not found.' });
  if (['signed', 'cancelled', 'superseded'].includes(parent.status)) return json(409, { error: parent.status === 'signed' ? 'Signed contracts require an addendum, not a revision.' : 'This contract cannot be revised.' });
  if (parent.signature?.documentId || parent.status === 'sent') return json(409, { error: 'Cancel the active signature request before creating a replacement revision.' });

  const chain = (await listContracts()).filter(contract => contract.contractNumber === parent.contractNumber);
  const nextVersion = Math.max(...chain.map(contract => contract.version || 1), 0) + 1;
  const revision = createContractRevision(parent, nextVersion, reason, new Date(), actor.id);
  parent.status = 'superseded';
  parent.supersededByContractId = revision.id;
  parent.updatedAt = revision.createdAt;
  parent.updatedByUserId = actor.id;
  await Promise.all([
    store.setJSON(contractKey(parent.id), parent),
    store.setJSON(contractKey(revision.id), revision),
  ]);
  const comparison = diffContractVersions(parent, revision);
  await Promise.all([
    appendOwnerAudit('contract_revision_created', 'contract', revision.id, { contractNumber: revision.contractNumber, version: revision.version, parentContractId: parent.id, reason }, actor),
    appendOwnerTimeline('contract_revision_created', `Contract ${revision.contractNumber} revision ${revision.version} created: ${reason}`, { relatedLeadId: revision.leadId, relatedCustomerId: revision.customerId, source: 'admin-contract-revisions' }),
    appendSalesActivity(buildSalesActivityEvent({
      activityType: 'agreement_revision_created',
      summary: `Agreement ${revision.contractNumber} revision ${revision.version} created.`,
      customerId: revision.customerId,
      opportunityId: revision.opportunityId,
      enquiryId: revision.sourceEnquiryId,
      agreementId: revision.id,
      configurationId: revision.configurationReference?.configurationId || '',
      sourceReference: parent.id,
      source: 'gm_ui',
      metadata: { version: revision.version, parentAgreementId: parent.id, reason },
    }, actor)),
  ]);
  return json(201, { ok: true, revision, parent, comparison });
};
