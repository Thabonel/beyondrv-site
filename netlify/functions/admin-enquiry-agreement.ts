import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  CONTRACT_STORE,
  contractKey,
  normaliseContractInput,
  validateContract,
  type ContractRecord,
} from './contract-core';
import { readIdempotencyRecord, writeIdempotencyRecord } from './command-idempotency-core';
import { buildAgreementInputFromEnquiry } from './enquiry-agreement-core';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import catalogue from './product-catalogue.json';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';
import type { WorkspaceEnquiry, WorkspaceProduct } from './sales-workspace-core';

const ENQUIRY_STORE = 'customer-enquiries';
const IDEMPOTENCY_SCOPE = 'enquiry:agreement';

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

function parseBody(raw: string | null) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function listJson<T>(storeName: string, prefix = '') {
  const store = getBlobStore(storeName);
  const { blobs } = await store.list({ prefix });
  const records = await Promise.all(blobs.map(async blob => {
    try {
      return await store.get(blob.key, { type: 'json' }) as T | null;
    } catch {
      return null;
    }
  }));
  return records.filter(record => record !== null) as T[];
}

function deterministicAgreementIdentity(enquiry: WorkspaceEnquiry) {
  const digest = createHash('sha256').update(enquiry.id).digest('hex');
  const submittedAt = clean(enquiry.received_at || enquiry.submittedAt, 80);
  const parsed = submittedAt && Number.isFinite(Date.parse(submittedAt)) ? new Date(submittedAt) : null;
  const date = parsed ? parsed.toISOString().slice(0, 10).replace(/-/g, '') : 'ENQUIRY';
  return {
    id: `agreement-enquiry-${digest.slice(0, 24)}`,
    contractNumber: `BRV-${date}-${digest.slice(0, 6).toUpperCase()}`,
  };
}

function isActiveAgreement(contract: ContractRecord) {
  return !['cancelled', 'superseded'].includes(contract.status);
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'sales:read')) return forbiddenResponse('sales:read');
  if (!hasAdminCapability(actor, 'agreements:write')) return forbiddenResponse('agreements:write');
  const body = parseBody(event.body);
  if (!body) return json(400, { error: 'Invalid JSON request.' });
  const enquiryId = clean(body.enquiryId);
  if (!enquiryId) return json(400, { error: 'Missing enquiry id.' });

  const blobRuntimeSource = connectBlobStore(event);
  const rawIdempotencyKey = `website-enquiry:${enquiryId}`;

  try {
    const agreementStore = getBlobStore(CONTRACT_STORE);
    const prior = await readIdempotencyRecord(IDEMPOTENCY_SCOPE, rawIdempotencyKey);
    if (prior?.targetType === 'agreement' && prior.targetId) {
      const contract = await agreementStore.get(contractKey(prior.targetId), { type: 'json' }) as ContractRecord | null;
      if (!contract) {
        return json(409, { error: 'The original agreement result could not be recovered. Please ask an administrator to resolve it before retrying.' });
      }
      return json(200, { ok: true, created: false, idempotentReplay: true, contract, validation: validateContract(contract) });
    }

    const [enquiries, contracts] = await Promise.all([
      listJson<WorkspaceEnquiry>(ENQUIRY_STORE),
      listJson<ContractRecord>(CONTRACT_STORE, 'contracts/'),
    ]);
    const enquiry = enquiries.find(record => record.id === enquiryId);
    if (!enquiry) return json(404, { error: 'Website enquiry not found.' });

    const existing = contracts.find(contract => contract.sourceEnquiryId === enquiryId && isActiveAgreement(contract));
    if (existing) {
      await writeIdempotencyRecord(IDEMPOTENCY_SCOPE, rawIdempotencyKey, {
        actorUserId: actor.id,
        targetType: 'agreement',
        targetId: existing.id,
      });
      return json(200, { ok: true, created: false, contract: existing, validation: validateContract(existing) });
    }

    const identity = deterministicAgreementIdentity(enquiry);
    const products = (catalogue as WorkspaceProduct[]).map(product => ({
      slug: product.slug,
      title: product.title,
      category: product.category,
      price: product.price ?? 0,
    }));
    const contract = normaliseContractInput({
      ...buildAgreementInputFromEnquiry(enquiry, products),
      ...identity,
    }, null, { actorUserId: actor.id });
    const validation = validateContract(contract);

    await agreementStore.setJSON(contractKey(contract.id), contract);
    await writeIdempotencyRecord(IDEMPOTENCY_SCOPE, rawIdempotencyKey, {
      actorUserId: actor.id,
      targetType: 'agreement',
      targetId: contract.id,
    });
    await Promise.all([
      appendOwnerAudit('enquiry_converted_to_agreement', 'contract', contract.id, {
        contractNumber: contract.contractNumber,
        enquiryId,
        status: contract.status,
        totalCents: validation.totalCents,
      }, actor),
      appendOwnerTimeline('enquiry_converted_to_agreement', `Website enquiry from ${contract.buyer.name || contract.buyer.email || 'customer'} converted to agreement ${contract.contractNumber}.`, {
        relatedLeadId: contract.leadId,
        relatedCustomerId: contract.customerId,
        source: 'admin-enquiry-agreement',
      }),
      appendSalesActivity(buildSalesActivityEvent({
        commandId: `${IDEMPOTENCY_SCOPE}:${rawIdempotencyKey}`,
        activityType: 'enquiry_converted_to_agreement',
        summary: `Website enquiry converted to agreement ${contract.contractNumber}.`,
        customerId: contract.customerId,
        opportunityId: contract.opportunityId,
        enquiryId,
        agreementId: contract.id,
        source: 'gm_ui',
        sourceReference: enquiryId,
        metadata: { status: contract.status, totalCents: validation.totalCents },
      }, actor)),
    ]);

    return json(201, { ok: true, created: true, contract, validation });
  } catch (error) {
    console.warn('admin-enquiry-agreement: conversion unavailable', {
      blobRuntimeSource,
      enquiryId,
      error: safeBlobStoreError(error),
    });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
