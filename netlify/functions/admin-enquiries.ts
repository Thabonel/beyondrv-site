import { getStore } from '@netlify/blobs';
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const STORE_NAME = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  let blobs: Awaited<ReturnType<ReturnType<typeof getStore>['list']>>['blobs'];
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  try {
    ({ blobs } = await store.list());
  } catch (error) {
    console.warn('admin-enquiries: enquiry store unavailable', error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enquiries: [] }),
    };
  }
  const recent = blobs
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 50);

  const statusStore = getStore({ name: LEAD_STATUS_STORE, consistency: 'strong' });
  const enquiries = await Promise.all(
    recent.map(async (blob) => {
      const data = await store.get(blob.key, { type: 'json', consistency: 'strong' }) as { id?: string; callback_date?: string; submittedAt?: string } | null;
      if (!data?.id) return data;
      let leadStatus = null;
      try {
        leadStatus = await statusStore.get(leadKey(data.id), { type: 'json', consistency: 'strong' });
      } catch {
        leadStatus = null;
      }
      return {
        ...data,
        leadStatus: leadStatus ?? {
          enquiryId: data.id,
          status: 'new',
          notes: '',
          nextFollowUpDate: data.callback_date ?? '',
          updatedAt: data.submittedAt ?? '',
        },
      };
    })
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enquiries }),
  };
};
