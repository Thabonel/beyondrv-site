import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { getBlobStore } from './blob-store';

const STORE_NAME = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const store = getBlobStore(STORE_NAME);
  try {
    const { blobs } = await store.list();
    const recent = blobs
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 50);

    const statusStore = getBlobStore(LEAD_STATUS_STORE);
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
      body: JSON.stringify({ enquiries, storageReady: true }),
    };
  } catch (error) {
    console.warn('admin-enquiries: enquiry store unavailable', error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enquiries: [],
        storageReady: false,
        warning: 'Enquiry email is working, but the admin backup store is not configured yet.',
      }),
    };
  }
};
