import type { Handler } from '@netlify/functions';
import { randomUUID } from 'crypto';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { archiveProductMarkdown, isSafeProductSlug, productPathCandidates } from './product-archive-core';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

async function githubFetch(path: string): Promise<string | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  const res = await fetch(
    `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) return null;
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'site:write')) return forbiddenResponse('site:write');

  let slug = '';
  try {
    const payload = JSON.parse(event.body ?? '{}') as { slug?: unknown };
    slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!slug || !isSafeProductSlug(slug)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid product slug' }) };
  }

  let path = '';
  let current: string | null = null;
  for (const candidate of productPathCandidates(slug)) {
    current = await githubFetch(candidate);
    if (current) {
      path = candidate;
      break;
    }
  }

  if (!current || !path) {
    return { statusCode: 404, body: JSON.stringify({ error: `Could not read product file for ${slug}` }) };
  }

  try {
    const archived = archiveProductMarkdown(current, new Date().toISOString());
    if (archived.alreadyArchived) {
      return { statusCode: 409, body: JSON.stringify({ error: `${archived.title} is already archived.` }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
      body: JSON.stringify({
        pendingChange: {
          path,
          content: archived.content,
          description: `Archive ${archived.title} and remove it from the public site`,
          proposal_id: `admin-archive-${Date.now()}-${randomUUID()}`,
          judgeDecision: 'allow',
          risk_flags: ['owner_confirmed_archive'],
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Could not archive product' }),
    };
  }
};
