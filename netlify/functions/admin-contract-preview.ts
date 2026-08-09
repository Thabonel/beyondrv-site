import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import { CONTRACT_STORE, contractKey, renderContractHtml, type ContractRecord } from './contract-core';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'agreements:read')) return forbiddenResponse('agreements:read');
  connectBlobStore(event);
  const id = typeof event.queryStringParameters?.id === 'string' ? event.queryStringParameters.id.trim().slice(0, 240) : '';
  if (!id) return { statusCode: 400, body: 'Missing contract id.' };
  const contract = await getBlobStore(CONTRACT_STORE).get(contractKey(id), { type: 'json' }) as ContractRecord | null;
  if (!contract) return { statusCode: 404, body: 'Contract not found.' };
  const download = event.queryStringParameters?.download === '1';
  let html = '';
  if (contract.documentSnapshot?.store && contract.documentSnapshot.key) {
    try {
      html = await getBlobStore(contract.documentSnapshot.store).get(contract.documentSnapshot.key, { type: 'text' }) as string || '';
    } catch {
      html = '';
    }
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(download ? { 'Content-Disposition': `attachment; filename="${contract.contractNumber}-v${contract.version}.html"` } : {}),
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      'Cache-Control': 'no-store, max-age=0',
    },
    body: html || renderContractHtml(contract),
  };
};
