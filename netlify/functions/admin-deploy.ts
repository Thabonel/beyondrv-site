import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

interface PendingChange {
  path: string;
  content: string;
  description: string;
}

async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (res.status === 404) return null;
  const data = await res.json() as { sha: string };
  return data.sha;
}

async function commitFile(path: string, content: string, sha: string | null, message: string) {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${API}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error for ${path}: ${err}`);
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

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
