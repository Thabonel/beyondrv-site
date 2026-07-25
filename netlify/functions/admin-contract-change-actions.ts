import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import { CONTRACT_STORE, contractKey, createContractRevision, type ContractRecord } from './contract-core';
import {
  CONTRACT_ADDENDUM_STORE,
  addendumKey,
  calculateEffectiveDeal,
  normaliseAddendumInput,
  type ContractAddendumRecord,
} from './contract-change-core';
import { validateContractChangeExtraction } from './contract-ai-core';
import { OWNER_COPILOT_AI_ACTION_STORE, aiActionKey } from './owner-copilot-core';
import { appendOwnerAudit, appendOwnerTimeline, listJsonStore } from './owner-copilot-store-utils';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);
  let body: Record<string, unknown>;
  try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
  catch { return json(400, { error: 'Invalid JSON request.' }); }
  const id = clean(body.id, 240);
  if (!id || body.ownerApprovedInterpretation !== true) return json(400, { error: 'Owner confirmation of the extracted interpretation is required.' });

  const actionStore = getBlobStore(OWNER_COPILOT_AI_ACTION_STORE);
  const aiAction = await actionStore.get(aiActionKey(id), { type: 'json' }) as Record<string, unknown> | null;
  if (!aiAction || aiAction.actionType !== 'contract_change_intake') return json(404, { error: 'Contract-change draft action not found.' });
  if (aiAction.convertedTargetId) return json(409, { error: 'This draft action has already been converted.', targetId: aiAction.convertedTargetId });
  const extraction = validateContractChangeExtraction(body.extraction || aiAction.extraction);
  if (!extraction) return json(400, { error: 'Review and complete the structured extraction first.' });
  if (!['pre_signature_change', 'post_signature_addendum', 'cancellation_or_removal'].includes(extraction.classification)) {
    return json(409, { error: 'This classification is informational or ambiguous and cannot create a contract document.' });
  }
  if (!extraction.requestedChanges.length) return json(409, { error: 'Add at least one requested change before conversion.' });

  const contractId = clean(aiAction.relatedContractId, 240);
  const contractStore = getBlobStore(CONTRACT_STORE);
  const contract = await contractStore.get(contractKey(contractId), { type: 'json' }) as ContractRecord | null;
  if (!contract) return json(404, { error: 'Matched contract not found. Resolve the contract match first.' });
  const now = new Date().toISOString();
  let target: ContractRecord | ContractAddendumRecord;
  let targetType: 'contract_revision' | 'contract_addendum';

  if (contract.status === 'signed') {
    const addenda = await listJsonStore(CONTRACT_ADDENDUM_STORE).catch(() => []) as unknown as ContractAddendumRecord[];
    const contractAddenda = addenda.filter(addendum => addendum.contractId === contract.id);
    const sequence = Math.max(0, ...contractAddenda.map(addendum => addendum.sequence || 0)) + 1;
    const effectiveDeal = calculateEffectiveDeal(contract, contractAddenda);
    const addendum = normaliseAddendumInput({
      sourceType: 'gmail',
      sourceReference: `gmail:${clean(aiAction.sourceMessageId, 240)}`,
      requestedAt: clean(aiAction.sourceReceivedAt, 100) || now,
      requestNote: extraction.ownerSummary || clean(aiAction.output, 2000),
      changes: extraction.requestedChanges.map((change, index) => ({
        id: `change_${index + 1}`,
        action: change.action,
        category: '',
        item: change.item,
        previousValue: change.previousValue,
        revisedValue: change.requestedValue,
        priceDeltaCents: 0,
        deliveryImpact: '',
        sourceExcerpt: change.sourceExcerpt,
        ownerConfirmed: false,
      })),
      paymentImpact: '',
      deliveryImpact: '',
      status: 'draft',
    }, contract, effectiveDeal.effectiveTotalCents, sequence);
    await getBlobStore(CONTRACT_ADDENDUM_STORE).setJSON(addendumKey(addendum.id), addendum);
    target = addendum;
    targetType = 'contract_addendum';
  } else {
    if (['sent', 'cancelled', 'superseded'].includes(contract.status) || contract.signature?.documentId) {
      return json(409, { error: 'Cancel the active signature request or select the current editable contract version first.' });
    }
    const chain = (await listJsonStore(CONTRACT_STORE).catch(() => [])) as unknown as ContractRecord[];
    const nextVersion = Math.max(0, ...chain.filter(item => item.contractNumber === contract.contractNumber).map(item => item.version || 1)) + 1;
    const revision = createContractRevision(contract, nextVersion, extraction.ownerSummary || 'Customer requested changes by email');
    revision.sourceAiActionId = id;
    revision.proposedChanges = extraction.requestedChanges.map(change => ({ ...change }));
    contract.status = 'superseded';
    contract.supersededByContractId = revision.id;
    contract.updatedAt = now;
    await Promise.all([
      contractStore.setJSON(contractKey(contract.id), contract),
      contractStore.setJSON(contractKey(revision.id), revision),
    ]);
    target = revision;
    targetType = 'contract_revision';
  }

  const updatedAction = {
    ...aiAction,
    extraction,
    approvalState: 'approved',
    processingStatus: 'converted',
    reviewedBy: 'owner',
    reviewedAt: now,
    convertedTargetType: targetType,
    convertedTargetId: target.id,
    updatedAt: now,
  };
  await actionStore.setJSON(aiActionKey(id), updatedAction);
  await Promise.all([
    appendOwnerAudit('gmail_contract_action_converted', targetType, target.id, { aiActionId: id, contractId: contract.id, sourceMessageId: aiAction.sourceMessageId }),
    appendOwnerTimeline('gmail_contract_action_converted', `Owner approved Gmail interpretation and prepared ${targetType === 'contract_addendum' ? 'an addendum' : 'a contract revision'} for review.`, {
      relatedLeadId: clean(aiAction.relatedLeadId, 240),
      relatedCustomerId: clean(aiAction.relatedCustomerId, 240),
      source: 'admin-contract-change-actions',
    }),
  ]);
  return json(201, { ok: true, action: updatedAction, targetType, target });
};
