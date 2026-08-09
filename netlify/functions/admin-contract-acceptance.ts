import { createHash } from 'crypto';
import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import {
  CONTRACT_STORE,
  calculatePaymentStages,
  contractKey,
  renderContractHtml,
  validateContract,
  type ContractRecord,
} from './contract-core';
import {
  acceptanceMethodLabel,
  markPrepared,
  markSent,
  recordAcceptance,
  termsApprovedForCustomerUse,
  validateAcceptanceEvidence,
} from './agreement-acceptance-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';

const CONTRACT_FILE_STORE = 'byondrv-contract-files';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }, body: JSON.stringify(body) };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const handler: Handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'agreements:read')) return forbiddenResponse('agreements:read');
  connectBlobStore(event);

  let body: Record<string, unknown> = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
    catch { return json(400, { error: 'Invalid JSON request.' }); }
  }
  const id = clean(event.httpMethod === 'GET' ? event.queryStringParameters?.id : body.id);
  if (!id) return json(400, { error: 'Missing contract id.' });

  const store = getBlobStore(CONTRACT_STORE);
  const contract = await store.get(contractKey(id), { type: 'json' }) as ContractRecord | null;
  if (!contract) return json(404, { error: 'Contract not found.' });
  const termsApproved = termsApprovedForCustomerUse(contract.termsVersion);

  if (event.httpMethod === 'GET') {
    return json(200, {
      acceptance: contract.acceptance,
      documentSnapshot: contract.documentSnapshot,
      termsVersion: contract.termsVersion,
      termsApproved,
      acceptanceMethodLabel: acceptanceMethodLabel(contract.acceptance?.method || ''),
      composeUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contract.buyer.email)}&su=${encodeURIComponent(`Beyond RV Sale Agreement ${contract.contractNumber}`)}&body=${encodeURIComponent(`Hello ${contract.buyer.name},\n\nPlease review the complete attached Beyond RV Sale Agreement ${contract.contractNumber}, version ${contract.version}, including Terms ${contract.termsVersion}.\n\nYou can accept it by printing and signing the agreement, then replying with a clear scan or photograph. Where permitted by law, paying the stated deposit after receiving the complete agreement also indicates acceptance.\n\nPlease contact us before signing or paying if any detail needs to change.\n\nRegards,\nBeyond RV Campers`)}`,
    });
  }

  const action = clean(body.action, 40);
  if (action === 'prepare') {
    if (!hasAdminCapability(actor, 'agreements:approve')) return forbiddenResponse('agreements:approve');
    if (contract.documentSnapshot?.sha256 || ['prepared', 'sent', 'accepted'].includes(contract.acceptance?.status || '')) {
      return json(409, { error: 'This contract version already has an immutable final copy. Create a replacement revision if it must change.' });
    }
    const validation = validateContract(contract);
    if (contract.status !== 'approved' || !validation.valid) return json(409, { error: 'Approve a valid contract before preparing the final copy.', validation });
    const now = new Date();
    const snapshotHtml = renderContractHtml(contract);
    const snapshotKey = `documents/${encodeURIComponent(contract.id)}/v${contract.version}/${encodeURIComponent(contract.contractNumber)}.html`;
    const snapshotBuffer = Buffer.from(snapshotHtml, 'utf8');
    await getBlobStore(CONTRACT_FILE_STORE).set(snapshotKey, snapshotBuffer.buffer.slice(snapshotBuffer.byteOffset, snapshotBuffer.byteOffset + snapshotBuffer.byteLength), {
      metadata: {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        version: String(contract.version),
        termsVersion: contract.termsVersion,
        contentType: 'text/html; charset=utf-8',
        createdAt: now.toISOString(),
      },
    });
    contract.documentSnapshot = {
      store: CONTRACT_FILE_STORE,
      key: snapshotKey,
      sha256: createHash('sha256').update(snapshotBuffer).digest('hex'),
      mimeType: 'text/html; charset=utf-8',
      createdAt: now.toISOString(),
    };
    contract.acceptance = markPrepared(contract.acceptance, now, actor.id);
    contract.updatedByUserId = actor.id;
    contract.updatedAt = now.toISOString();
    await store.setJSON(contractKey(id), contract);
    await Promise.all([
      appendOwnerAudit('contract_final_copy_prepared', 'contract', id, {
        contractNumber: contract.contractNumber,
        version: contract.version,
        termsVersion: contract.termsVersion,
        sha256: contract.documentSnapshot.sha256,
      }, actor),
      appendSalesActivity(buildSalesActivityEvent({
        activityType: 'agreement_prepared',
        summary: `Agreement ${contract.contractNumber} final copy prepared.`,
        customerId: contract.customerId,
        opportunityId: contract.opportunityId,
        enquiryId: contract.sourceEnquiryId,
        agreementId: contract.id,
        configurationId: contract.configurationReference?.configurationId || '',
        source: 'gm_ui',
        metadata: { version: contract.version, termsVersion: contract.termsVersion, sha256: contract.documentSnapshot.sha256 },
      }, actor)),
    ]);
    return json(201, { ok: true, contract, termsApproved });
  }

  if (action === 'mark_sent') {
    if (!hasAdminCapability(actor, 'agreements:send')) return forbiddenResponse('agreements:send');
    if (!contract.documentSnapshot?.sha256) return json(409, { error: 'Prepare the immutable final copy before recording it as sent.' });
    if (contract.status !== 'approved' || contract.acceptance?.status !== 'prepared') {
      return json(409, { error: 'Only a prepared, approved contract can be recorded as sent.' });
    }
    if (!termsApproved) return json(409, {
      error: `Terms ${contract.termsVersion} are not enabled for customer use. Set CONTRACT_TERMS_APPROVED_VERSION to this exact business-approved version.`,
    });
    const sentToEmail = clean(body.sentToEmail, 240).toLowerCase() || contract.buyer.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sentToEmail)) return json(400, { error: 'Add a valid recipient email address.' });
    const now = new Date();
    contract.acceptance = markSent(contract.acceptance, sentToEmail, now, actor.id);
    contract.status = 'sent';
    contract.updatedAt = now.toISOString();
    contract.updatedByUserId = actor.id;
    await store.setJSON(contractKey(id), contract);
    await Promise.all([
      appendOwnerAudit('contract_sent_manually', 'contract', id, {
        contractNumber: contract.contractNumber,
        sentToEmail,
        snapshotSha256: contract.documentSnapshot.sha256,
      }, actor),
      appendOwnerTimeline('contract_sent', `Contract ${contract.contractNumber} recorded as sent to ${sentToEmail}.`, {
        relatedLeadId: contract.leadId,
        relatedCustomerId: contract.customerId,
        source: 'admin-contract-acceptance',
      }),
      appendSalesActivity(buildSalesActivityEvent({
        activityType: 'agreement_sent',
        summary: `Agreement ${contract.contractNumber} recorded as sent to ${sentToEmail}.`,
        customerId: contract.customerId,
        opportunityId: contract.opportunityId,
        enquiryId: contract.sourceEnquiryId,
        agreementId: contract.id,
        configurationId: contract.configurationReference?.configurationId || '',
        source: 'gm_ui',
        metadata: { sentToEmail, snapshotSha256: contract.documentSnapshot.sha256 },
      }, actor)),
    ]);
    return json(200, { ok: true, contract });
  }

  if (action === 'record_acceptance') {
    if (!hasAdminCapability(actor, 'agreements:record_acceptance')) return forbiddenResponse('agreements:record_acceptance');
    if (!contract.documentSnapshot?.sha256) return json(409, { error: 'Prepare the immutable final copy before recording acceptance.' });
    if (contract.status !== 'sent' || contract.acceptance?.status !== 'sent') {
      return json(409, { error: 'Record that the complete agreement was sent before recording customer acceptance.' });
    }
    if (!termsApproved) return json(409, {
      error: `Terms ${contract.termsVersion} are not approved for customer use. Acceptance cannot be recorded against an unapproved terms version.`,
    });
    const depositDueCents = calculatePaymentStages(validateContract(contract).totalCents)[0]?.amountCents || 0;
    const validation = validateAcceptanceEvidence(body, {
      expectedEmail: contract.buyer.email,
      depositDueCents,
      allowDeposit: true,
    });
    if (!validation.valid) return json(400, { error: 'Complete the acceptance evidence.', validation });
    const now = new Date();
    contract.acceptance = recordAcceptance(contract.acceptance, validation.evidence, now, actor.id);
    contract.status = 'signed';
    contract.updatedAt = now.toISOString();
    contract.updatedByUserId = actor.id;
    await store.setJSON(contractKey(id), contract);
    await Promise.all([
      appendOwnerAudit('contract_acceptance_recorded', 'contract', id, {
        contractNumber: contract.contractNumber,
        method: contract.acceptance.method,
        methodLabel: acceptanceMethodLabel(contract.acceptance.method),
        acceptedAt: contract.acceptance.acceptedAt,
        acceptedByEmail: contract.acceptance.acceptedByEmail,
        evidenceReference: contract.acceptance.evidenceReference,
        depositAmountCents: contract.acceptance.depositAmountCents,
        depositReference: contract.acceptance.depositReference,
        snapshotSha256: contract.documentSnapshot.sha256,
      }, actor),
      appendOwnerTimeline('contract_accepted', `Contract ${contract.contractNumber} accepted by ${contract.acceptance.acceptedByName} via ${acceptanceMethodLabel(contract.acceptance.method)}.`, {
        relatedLeadId: contract.leadId,
        relatedCustomerId: contract.customerId,
        source: 'admin-contract-acceptance',
      }),
      appendSalesActivity(buildSalesActivityEvent({
        activityType: 'agreement_accepted',
        summary: `Agreement ${contract.contractNumber} acceptance recorded for ${contract.acceptance.acceptedByName}.`,
        customerId: contract.customerId,
        opportunityId: contract.opportunityId,
        enquiryId: contract.sourceEnquiryId,
        agreementId: contract.id,
        configurationId: contract.configurationReference?.configurationId || '',
        source: 'gm_ui',
        metadata: { method: contract.acceptance.method, acceptedAt: contract.acceptance.acceptedAt },
      }, actor)),
    ]);
    return json(200, { ok: true, contract, validation });
  }

  return json(400, { error: 'Use action=prepare, mark_sent, or record_acceptance.' });
};
