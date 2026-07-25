import type { Handler, HandlerResponse } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  appendGoogleAudit,
  getGoogleAccessToken,
  getGoogleConnection,
  getGoogleOwnerSettings,
  googleOAuthConfig,
  publicGoogleConnectionState,
} from './google-oauth-core';
import {
  gmailThreadKey,
  OWNER_COPILOT_CUSTOMER_STORE,
  OWNER_COPILOT_GMAIL_THREAD_STORE,
  OWNER_COPILOT_LEAD_STORE,
} from './owner-copilot-core';
import { scoreGmailThreadMatches } from './owner-copilot-matching-core';
import { listJsonStore } from './owner-copilot-store-utils';
import { CONTRACT_STORE, type ContractRecord } from './contract-core';
import { deterministicContractEmailTriage, matchEmailToContracts } from './contract-ai-core';
import { extractGmailMessageText, isExcludedGmailMessage } from './gmail-message-core';

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find(header => header.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function firstEmail(value = '') {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

function productHint(subject = '', snippet = '') {
  const text = `${subject} ${snippet}`.toLowerCase();
  const hints = [
    'advent 2150',
    'advent 2300',
    'advent 2450',
    'sunpatch 12',
    'sunpatch 15',
    'sunpatch 19',
    'sunpatch 21',
    'slide-on',
    'caravan',
    'truck camper',
  ];
  return hints.find(hint => text.includes(hint)) || '';
}

async function googleJson<T>(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Google request failed with ${res.status}`);
  return data as T;
}

export async function runGoogleGmailSync(event: Parameters<Handler>[0]): Promise<HandlerResponse> {
  connectBlobStore(event);

  const config = googleOAuthConfig(event);
  try {
    const connection = await getGoogleConnection();
    const state = publicGoogleConnectionState(connection, config.missing);
    if (state !== 'connected') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          ready: false,
          state,
          message: 'Connect Google before Gmail ingestion can run.',
          requiredOwnerInputs: [
            'Which Gmail labels or search queries are approved for lead ingestion.',
            'How far back the first import should look.',
            'Which sender domains or message types should be ignored.',
          ],
        }),
      };
    }

    const settings = await getGoogleOwnerSettings();
    const accessToken = await getGoogleAccessToken(config);
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('maxResults', String(settings.gmailMaxResults));
    listUrl.searchParams.set('q', settings.gmailQuery || 'newer_than:30d');
    const listData = await googleJson<{ messages?: { id: string; threadId: string }[] }>(listUrl.toString(), accessToken);
    const messages = listData.messages || [];
    const store = getBlobStore(OWNER_COPILOT_GMAIL_THREAD_STORE);
    const [customers, leads, contracts] = await Promise.all([
      listJsonStore(OWNER_COPILOT_CUSTOMER_STORE).catch(() => []),
      listJsonStore(OWNER_COPILOT_LEAD_STORE).catch(() => []),
      listJsonStore(CONTRACT_STORE).catch(() => []) as Promise<ContractRecord[]>,
    ]);

    let saved = 0;
    let skipped = 0;
    const ignored = new Set(settings.ignoredSenders.map(item => item.toLowerCase()));
    for (const message of messages) {
      const detailUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}`);
      detailUrl.searchParams.set('format', 'full');
      const detail = await googleJson<{
        id: string;
        threadId: string;
        labelIds?: string[];
        snippet?: string;
        internalDate?: string;
        payload?: {
          mimeType?: string;
          body?: { data?: string };
          parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
          headers?: { name?: string; value?: string }[];
        };
      }>(detailUrl.toString(), accessToken);
      const headers = detail.payload?.headers || [];
      const fromEmail = firstEmail(headerValue(headers, 'From'));
      const subject = headerValue(headers, 'Subject');
      const connectedEmail = typeof connection?.connectedEmail === 'string' ? connection.connectedEmail : '';
      if ((fromEmail && ignored.has(fromEmail)) || isExcludedGmailMessage({ labelIds: detail.labelIds, fromEmail, connectedEmail, subject })) {
        skipped += 1;
        continue;
      }
      const bodyText = extractGmailMessageText(detail.payload as Parameters<typeof extractGmailMessageText>[0]);
      const receivedAt = detail.internalDate
        ? new Date(Number(detail.internalDate)).toISOString()
        : headerValue(headers, 'Date');
      const contractMatch = matchEmailToContracts(fromEmail, subject, bodyText || detail.snippet || '', contracts);
      const triage = deterministicContractEmailTriage(subject, bodyText || detail.snippet || '', contractMatch.contract);
      const record = {
        id: detail.threadId || message.threadId || detail.id,
        threadId: detail.threadId || message.threadId,
        messageId: detail.id,
        fromEmail,
        toEmail: firstEmail(headerValue(headers, 'To')),
        replyToEmail: firstEmail(headerValue(headers, 'Reply-To')),
        subject,
        snippet: detail.snippet || '',
        bodyText,
        productInterest: productHint(subject, detail.snippet || ''),
        receivedAt,
        contractMatch: {
          contractId: contractMatch.contract?.id || '',
          contractNumber: contractMatch.contract?.contractNumber || '',
          confidence: contractMatch.confidence,
          method: contractMatch.method,
          ambiguous: contractMatch.ambiguous,
        },
        contractTriage: triage,
        source: 'gmail_readonly_sync',
        updatedAt: new Date().toISOString(),
      };
      const existing = await store.get(gmailThreadKey(record.id), { type: 'json' }) as Record<string, unknown> | null;
      const existingMessages = Array.isArray(existing?.messages) ? existing.messages.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : [];
      const messageRecord = {
        messageId: detail.id,
        threadId: detail.threadId || message.threadId,
        fromEmail,
        toEmail: firstEmail(headerValue(headers, 'To')),
        subject,
        bodyText,
        snippet: detail.snippet || '',
        receivedAt,
        contractMatch: record.contractMatch,
        contractTriage: triage,
      };
      const messagesForThread = [...existingMessages.filter(item => item.messageId !== detail.id), messageRecord]
        .sort((a, b) => String(a.receivedAt || '').localeCompare(String(b.receivedAt || '')))
        .slice(-50);
      const suggestions = scoreGmailThreadMatches(record, customers as never, leads as never);
      await store.setJSON(gmailThreadKey(record.id), {
        ...existing,
        ...record,
        createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : record.updatedAt,
        matchDecision: existing?.matchDecision || '',
        linkedTargetType: existing?.linkedTargetType || '',
        linkedTargetId: existing?.linkedTargetId || '',
        processingStatus: existing?.processingStatus || '',
        processedMessageIds: Array.isArray(existing?.processedMessageIds) ? existing.processedMessageIds : [],
        messages: messagesForThread,
        suggestions,
      });
      saved += 1;
    }

    await appendGoogleAudit('gmail_readonly_sync_completed', { query: settings.gmailQuery, saved, skipped });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ready: true,
        state,
        synced: saved,
        skipped,
        message: `Gmail sync saved ${saved} read-only thread record${saved === 1 ? '' : 's'}.`,
        requiredOwnerInputs: [],
      }),
    };
  } catch (error) {
    console.warn('google-gmail-sync: unavailable', { error: safeBlobStoreError(error) });
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: blobStoreUserMessage(error) }),
    };
  }
}

export const handler: Handler = async event => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  return runGoogleGmailSync(event);
};
