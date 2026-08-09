import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { CONTRACT_STORE, type ContractRecord } from './contract-core';
import { buildSalesWorkspaceProjection, type WorkspaceEnquiry, type WorkspaceOrder, type WorkspaceProduct } from './sales-workspace-core';
import catalogue from './product-catalogue.json';

const ENQUIRY_STORE = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';
const ORDER_STORE = 'customer-orders';

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
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
  return (records as Array<T | null>).filter((record): record is T => record !== null);
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'sales:read')) return forbiddenResponse('sales:read');
  const blobRuntimeSource = connectBlobStore(event);

  try {
    const enquiries = await listJson<WorkspaceEnquiry>(ENQUIRY_STORE);
    const leadStatusStore = getBlobStore(LEAD_STATUS_STORE);
    const enquiriesWithStatus = await Promise.all(enquiries.map(async enquiry => {
      if (!enquiry.id) return enquiry;
      try {
        return {
          ...enquiry,
          leadStatus: await leadStatusStore.get(leadKey(enquiry.id), { type: 'json' }),
        } as WorkspaceEnquiry;
      } catch {
        return enquiry;
      }
    }));
    const [agreements, orders] = await Promise.all([
      listJson<ContractRecord>(CONTRACT_STORE, 'contracts/'),
      listJson<WorkspaceOrder>(ORDER_STORE, 'orders/'),
    ]);
    const products = (catalogue as WorkspaceProduct[]).map(product => ({
      slug: product.slug,
      title: product.title,
      category: product.category,
      price: product.price ?? 0,
    }));
    const workspace = buildSalesWorkspaceProjection({ enquiries: enquiriesWithStatus, agreements, orders, products });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ workspace }),
    };
  } catch (error) {
    console.warn('admin-sales-workspace: source data unavailable', {
      blobRuntimeSource,
      error: safeBlobStoreError(error),
    });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
};
