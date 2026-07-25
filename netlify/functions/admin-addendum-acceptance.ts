import { createHash } from 'crypto';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import { CONTRACT_STORE, contractKey, type ContractRecord } from './contract-core';
import {
  CONTRACT_ADDENDUM_STORE,
  addendumKey,
  renderAddendumHtml,
  validateAddendum,
  type ContractAddendumRecord,
} from './contract-change-core';
import {
  acceptanceMethodLabel,
  markPrepared,
  markSent,
  recordAcceptance,
  termsApprovedForCustomerUse,
  validateAcceptanceEvidence,
} from './agreement-acceptance-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';

const CONTRACT_FILE_STORE = 'byondrv-contract-files';

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }, body: JSON.stringify(body) };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export const handler: Handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  let body: Record<string, unknown> = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}') as Record<string, unknown>; }
    catch { return json(400, { error: 'Invalid JSON request.' }); }
  }
  const id = clean(event.httpMethod === 'GET' ? event.queryStringParameters?.id : body.id);
  if (!id) return json(400, { error: 'Missing addendum id.' });

  const addendumStore = getBlobStore(CONTRACT_ADDENDUM_STORE);
  const addendum = await addendumStore.get(addendumKey(id), { type: 'json' }) as ContractAddendumRecord | null;
  if (!addendum) return json(404, { error: 'Addendum not found.' });
  const contract = await getBlobStore(CONTRACT_STORE).get(contractKey(addendum.contractId), { type: 'json' }) as ContractRecord | null;
  if (!contract) return json(404, { error: 'Original contract not found.' });
  const termsApproved = termsApprovedForCustomerUse(contract.termsVersion);

  if (event.httpMethod === 'GET') {
    return json(200, {
      acceptance: addendum.acceptance,
      documentSnapshot: addendum.documentSnapshot,
      termsVersion: contract.termsVersion,
      termsApproved,
      composeUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contract.buyer.email)}&su=${encodeURIComponent(`Beyond RV Addendum ${addendum.addendumNumber}`)}&body=${encodeURIComponent(`Hello ${contract.buyer.name},\n\nPlease review the complete attached addendum ${addendum.addendumNumber} to Sale Agreement ${contract.contractNumber}.\n\nPlease print and sign the addendum, then reply with a clear scan or photograph. You may instead reply with: “I, ${contract.buyer.name}, accept Addendum ${addendum.addendumNumber}.”\n\nPlease contact us before accepting if any detail needs to change.\n\nRegards,\nBeyond RV Campers`)}`,
    });
  }

  const action = clean(body.action, 40);
  if (action === 'prepare') {
    if (addendum.documentSnapshot?.sha256 || ['prepared', 'sent', 'accepted'].includes(addendum.acceptance?.status || '')) {
      return json(409, { error: 'This addendum already has an immutable final copy. Create a replacement addendum if it must change.' });
    }
    const validation = validateAddendum(addendum, contract);
    if (addendum.status !== 'approved' || !validation.valid) return json(409, { error: 'Approve a valid addendum before preparing the final copy.', validation });
    const now = new Date();
    const html = renderAddendumHtml(addendum, contract);
    const snapshotKey = `addenda/${encodeURIComponent(addendum.id)}/${encodeURIComponent(addendum.addendumNumber)}.html`;
    const buffer = Buffer.from(html, 'utf8');
    await getBlobStore(CONTRACT_FILE_STORE).set(snapshotKey, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), {
      metadata: {
        addendumId: addendum.id,
        contractId: contract.id,
        addendumNumber: addendum.addendumNumber,
        termsVersion: contract.termsVersion,
        contentType: 'text/html; charset=utf-8',
        createdAt: now.toISOString(),
      },
    });
    addendum.documentSnapshot = {
      store: CONTRACT_FILE_STORE,
      key: snapshotKey,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      mimeType: 'text/html; charset=utf-8',
      createdAt: now.toISOString(),
    };
    addendum.acceptance = markPrepared(addendum.acceptance, now);
    addendum.updatedAt = now.toISOString();
    await addendumStore.setJSON(addendumKey(id), addendum);
    await appendOwnerAudit('addendum_final_copy_prepared', 'contract_addendum', id, {
      addendumNumber: addendum.addendumNumber,
      termsVersion: contract.termsVersion,
      sha256: addendum.documentSnapshot.sha256,
    });
    return json(201, { ok: true, addendum, termsApproved });
  }

  if (action === 'mark_sent') {
    if (!addendum.documentSnapshot?.sha256) return json(409, { error: 'Prepare the immutable final copy before recording it as sent.' });
    if (addendum.status !== 'approved' || addendum.acceptance?.status !== 'prepared') {
      return json(409, { error: 'Only a prepared, approved addendum can be recorded as sent.' });
    }
    if (!termsApproved) return json(409, {
      error: `Terms ${contract.termsVersion} are not approved for customer use. Approve that exact version before sending this addendum.`,
    });
    const sentToEmail = clean(body.sentToEmail, 240).toLowerCase() || contract.buyer.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sentToEmail)) return json(400, { error: 'Add a valid recipient email address.' });
    const now = new Date();
    addendum.acceptance = markSent(addendum.acceptance, sentToEmail, now);
    addendum.status = 'sent';
    addendum.updatedAt = now.toISOString();
    await addendumStore.setJSON(addendumKey(id), addendum);
    await appendOwnerAudit('addendum_sent_manually', 'contract_addendum', id, {
      addendumNumber: addendum.addendumNumber,
      sentToEmail,
      snapshotSha256: addendum.documentSnapshot.sha256,
    });
    return json(200, { ok: true, addendum });
  }

  if (action === 'record_acceptance') {
    if (!addendum.documentSnapshot?.sha256) return json(409, { error: 'Prepare the immutable final copy before recording acceptance.' });
    if (addendum.status !== 'sent' || addendum.acceptance?.status !== 'sent') {
      return json(409, { error: 'Record that the complete addendum was sent before recording customer acceptance.' });
    }
    if (!termsApproved) return json(409, {
      error: `Terms ${contract.termsVersion} are not approved for customer use. Acceptance cannot be recorded against an unapproved terms version.`,
    });
    const validation = validateAcceptanceEvidence(body, {
      expectedEmail: contract.buyer.email,
      allowDeposit: false,
    });
    if (!validation.valid) return json(400, { error: 'Complete the acceptance evidence.', validation });
    const now = new Date();
    addendum.acceptance = recordAcceptance(addendum.acceptance, validation.evidence, now);
    addendum.status = 'signed';
    addendum.updatedAt = now.toISOString();
    await addendumStore.setJSON(addendumKey(id), addendum);
    await Promise.all([
      appendOwnerAudit('addendum_acceptance_recorded', 'contract_addendum', id, {
        addendumNumber: addendum.addendumNumber,
        method: addendum.acceptance.method,
        acceptedAt: addendum.acceptance.acceptedAt,
        acceptedByEmail: addendum.acceptance.acceptedByEmail,
        evidenceReference: addendum.acceptance.evidenceReference,
        snapshotSha256: addendum.documentSnapshot.sha256,
      }),
      appendOwnerTimeline('contract_addendum_accepted', `${addendum.addendumNumber} accepted by ${addendum.acceptance.acceptedByName} via ${acceptanceMethodLabel(addendum.acceptance.method)}.`, {
        relatedLeadId: contract.leadId,
        relatedCustomerId: contract.customerId,
        source: 'admin-addendum-acceptance',
      }),
    ]);
    return json(200, { ok: true, addendum, validation });
  }

  return json(400, { error: 'Use action=prepare, mark_sent, or record_acceptance.' });
};
