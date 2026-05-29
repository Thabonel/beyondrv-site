import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';

const STORE_NAME = 'customer-enquiries';
const LEAD_STATUS_STORE = 'customer-lead-status';

function leadKey(enquiryId: string) {
  return `lead-status/${encodeURIComponent(enquiryId)}.json`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  const blobRuntimeSource = connectBlobStore(event);

  try {
    const store = getBlobStore(STORE_NAME);
    const { blobs } = await store.list();
    const statusStore = getBlobStore(LEAD_STATUS_STORE);
    const records = (await Promise.all(
      blobs.map(async (blob) => store.get(blob.key, { type: 'json' }) as Promise<{ id?: string; callback_date?: string; submittedAt?: string; received_at?: string } | null>)
    ))
      .filter((record): record is { id: string; callback_date?: string; submittedAt?: string; received_at?: string } => Boolean(record?.id))
      .sort((a, b) => (b.received_at ?? b.submittedAt ?? '').localeCompare(a.received_at ?? a.submittedAt ?? ''))
      .slice(0, 50);

    const enquiries = await Promise.all(
      records.map(async (data) => {
        if (!data?.id) return data;
        let leadStatus = null;
        try {
          leadStatus = await statusStore.get(leadKey(data.id), { type: 'json' });
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
            priority: 'warm',
            outcomeReason: '',
            firstResponseAt: '',
            lastContactedAt: '',
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
    const safeError = safeBlobStoreError(error);
    console.warn('admin-enquiries: enquiry store unavailable', {
      store: STORE_NAME,
      blobRuntimeSource,
      error: safeError,
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enquiries: [],
        storageReady: false,
        warning: `Enquiry email is working, but the admin backup store is unavailable: ${blobStoreUserMessage(error)}`,
      }),
    };
  }
};
