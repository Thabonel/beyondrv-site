import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { commitFile, getFileSha } from './github-contents';

interface PendingChange {
  path: string;
  content: string;
  description: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'site:write')) return forbiddenResponse('site:write');

  const { changes } = JSON.parse(event.body ?? '{}') as { changes: PendingChange[] };

  if (!changes?.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No changes provided' }) };
  }

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const results: { path: string; ok: boolean; error?: string }[] = [];

  for (const change of changes) {
    try {
      const sha = await getFileSha(change.path);
      await commitFile(
        change.path,
        change.content,
        sha,
        `AI admin: ${change.description} [${timestamp}]`
      );
      results.push({ path: change.path, ok: true });
    } catch (err) {
      results.push({ path: change.path, ok: false, error: String(err) });
    }
  }

  const allOk = results.every(r => r.ok);
  return {
    statusCode: allOk ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  };
};
