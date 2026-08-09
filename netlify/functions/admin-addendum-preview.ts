import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { connectBlobStore, getBlobStore } from './blob-store';
import { CONTRACT_STORE, contractKey, type ContractRecord } from './contract-core';
import {
  CONTRACT_ADDENDUM_STORE,
  addendumKey,
  renderAddendumHtml,
  type ContractAddendumRecord,
} from './contract-change-core';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'agreements:read')) return forbiddenResponse('agreements:read');
  connectBlobStore(event);
  const id = typeof event.queryStringParameters?.id === 'string' ? event.queryStringParameters.id.trim().slice(0, 240) : '';
  if (!id) return { statusCode: 400, body: 'Missing addendum id.' };
  const addendum = await getBlobStore(CONTRACT_ADDENDUM_STORE).get(addendumKey(id), { type: 'json' }) as ContractAddendumRecord | null;
  if (!addendum) return { statusCode: 404, body: 'Addendum not found.' };
  const contract = await getBlobStore(CONTRACT_STORE).get(contractKey(addendum.contractId), { type: 'json' }) as ContractRecord | null;
  if (!contract) return { statusCode: 404, body: 'Original contract not found.' };

  let html = '';
  if (addendum.documentSnapshot?.store && addendum.documentSnapshot.key) {
    try {
      html = await getBlobStore(addendum.documentSnapshot.store).get(addendum.documentSnapshot.key, { type: 'text' }) as string || '';
    } catch {
      html = '';
    }
  }
  const download = event.queryStringParameters?.download === '1';
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(download ? { 'Content-Disposition': `attachment; filename="${addendum.addendumNumber}.html"` } : {}),
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      'Cache-Control': 'no-store, max-age=0',
    },
    body: html || renderAddendumHtml(addendum, contract),
  };
};
