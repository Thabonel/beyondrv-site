/**
 * Reading and writing repository files through the GitHub contents API.
 *
 * This logic was copy-pasted into admin-deploy, admin-product-edit,
 * admin-product-archive and admin-chat. One copy is enough.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const API = 'https://api.github.com';

export function buildCommitBody(content: string, sha: string | null, message: string, branch: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  // GitHub treats a write without a sha as a create, and rejects a write whose
  // sha is stale. Both behaviours are what stop one publish clobbering another.
  if (sha) body.sha = sha;
  return body;
}

function contentsUrl(path: string) {
  return `${API}/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' };
}

export async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(contentsUrl(path), { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error reading ${path}: ${await res.text()}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

export async function getFileContent(path: string): Promise<string | null> {
  const res = await fetch(contentsUrl(path), { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error reading ${path}: ${await res.text()}`);
  const data = await res.json() as { content: string };
  return Buffer.from(data.content, 'base64').toString('utf8');
}

export async function commitFile(path: string, content: string, sha: string | null, message: string): Promise<void> {
  const res = await fetch(`${API}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCommitBody(content, sha, message, GITHUB_BRANCH)),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error for ${path}: ${err}`);
  }
}

export function githubIsConfigured(): boolean {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO);
}
