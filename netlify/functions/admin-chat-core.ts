export type AdminChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type JudgeDecision = 'allow' | 'block' | 'revise' | 'escalate';

export type JudgeVerdict = {
  decision: JudgeDecision;
  rationale: string;
  risk_flags: string[];
  revision_instructions?: string;
  block_reason?: string;
  escalation_reason?: string;
};

export type ProductCatalogueEntry = {
  slug: string;
  title?: string;
  name?: string;
  category?: string;
  tagline?: string;
  heroImage?: string;
  gallery?: string[];
};

export type ResolvedProduct = {
  slug: string;
  title: string;
  category: string;
  tagline: string;
  heroImage: string;
  gallery: string[];
  sourcePath: string;
  pagePath: string;
};

const DECISIONS = new Set<JudgeDecision>(['allow', 'block', 'revise', 'escalate']);

function compact(value: unknown, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const marker = '\n... evidence truncated ...\n';
  const sideLength = Math.max(1, Math.floor((maxLength - marker.length) / 2));
  return `${value.slice(0, sideLength)}${marker}${value.slice(-sideLength)}`;
}

export function buildOwnerIntent(messages: AdminChatMessage[], maxLength = 8000) {
  const ownerMessages = messages
    .filter(message => message.role === 'user' && message.content.trim())
    .map((message, index) => `Owner message ${index + 1}: ${compact(message.content)}`);

  return truncateMiddle(ownerMessages.join('\n'), maxLength) || 'No owner instruction was provided.';
}

export function buildChangeEvidence(currentContent: string | null, newContent: string, maxLength = 12000) {
  if (currentContent === null) {
    return truncateMiddle(`NEW FILE CONTENT:\n${newContent}`, maxLength);
  }

  const before = currentContent.split('\n');
  const after = newContent.split('\n');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  if (prefix === before.length && prefix === after.length) return 'NO CONTENT CHANGE';

  const contextStart = Math.max(0, prefix - 2);
  const beforeEnd = Math.min(before.length, before.length - suffix + 2);
  const afterEnd = Math.min(after.length, after.length - suffix + 2);
  const evidence = [
    `UNCHANGED PREFIX LINES: ${prefix}`,
    'BEFORE:',
    before.slice(contextStart, beforeEnd).join('\n') || '(empty)',
    'AFTER:',
    after.slice(contextStart, afterEnd).join('\n') || '(empty)',
    `UNCHANGED SUFFIX LINES: ${suffix}`,
  ].join('\n');

  return truncateMiddle(evidence, maxLength);
}

function fallbackJudgeVerdict(reason: string, flag: string): JudgeVerdict {
  return {
    decision: 'block',
    rationale: reason,
    risk_flags: [flag],
    block_reason: 'The proposed change could not be verified safely. No change was queued.',
  };
}

export function parseJudgeVerdict(value: unknown): JudgeVerdict {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return fallbackJudgeVerdict('Safety judge returned invalid JSON.', 'judge_parse_error');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return fallbackJudgeVerdict('Safety judge returned an invalid verdict.', 'judge_schema_error');
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.decision !== 'string' || !DECISIONS.has(candidate.decision as JudgeDecision)) {
    return fallbackJudgeVerdict('Safety judge returned an unknown decision.', 'judge_schema_error');
  }

  const decision = candidate.decision as JudgeDecision;
  const rationale = compact(candidate.rationale, 1000) || 'The safety judge did not provide a rationale.';
  const riskFlags = Array.isArray(candidate.risk_flags)
    ? candidate.risk_flags.map(flag => compact(flag, 100)).filter(Boolean).slice(0, 20)
    : [];
  const revisionInstructions = compact(candidate.revision_instructions, 2000);
  const blockReason = compact(candidate.block_reason, 2000);
  const escalationReason = compact(candidate.escalation_reason, 2000);

  return {
    decision,
    rationale,
    risk_flags: riskFlags.length ? riskFlags : ['judge_no_risk_flags'],
    revision_instructions: decision === 'revise'
      ? revisionInstructions || 'Explain the exact fields that need revision before retrying.'
      : undefined,
    block_reason: decision === 'block'
      ? blockReason || rationale || 'The proposed change could not be verified safely.'
      : undefined,
    escalation_reason: decision === 'escalate'
      ? escalationReason || rationale || 'The change requires careful manual review.'
      : undefined,
  };
}

export function resolveGitHubBranch(env: Record<string, string | undefined>) {
  if (env.CONTEXT === 'deploy-preview' && env.HEAD) return env.HEAD;
  if (env.CONTEXT === 'branch-deploy' && env.BRANCH) return env.BRANCH;
  return env.GITHUB_BRANCH || env.BRANCH || 'main';
}

function normaliseSearch(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findProductMatches(products: ProductCatalogueEntry[], query: string, limit = 5) {
  const search = normaliseSearch(query);
  if (!search) return [];
  const tokens = search.split(' ').filter(token => token.length > 1);

  return products
    .map(product => {
      const title = normaliseSearch(product.title || product.name || '');
      const slug = normaliseSearch(product.slug);
      const haystack = `${title} ${slug} ${normaliseSearch(product.category)} ${normaliseSearch(product.tagline)}`;
      let score = 0;
      if (title === search || slug === search) score += 1000;
      if (title.includes(search) || slug.includes(search)) score += 500;
      const matchedTokens = tokens.filter(token => haystack.includes(token)).length;
      score += matchedTokens * 30;
      if (tokens.length > 0 && matchedTokens === tokens.length) score += 200;
      return { product, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || (a.product.title || '').localeCompare(b.product.title || ''))
    .slice(0, Math.max(1, Math.min(10, limit)))
    .map(result => result.product);
}

function frontmatter(content: string) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return match?.[1] ?? '';
}

function unquoteYaml(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function scalarField(source: string, field: string) {
  const match = source.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? unquoteYaml(match[1]) : '';
}

function listField(source: string, field: string) {
  const lines = source.split('\n');
  const start = lines.findIndex(line => line.trim() === `${field}:`);
  if (start < 0) return [];
  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^\s+-\s+(.+)$/);
    if (match) {
      values.push(unquoteYaml(match[1]));
      continue;
    }
    if (line.trim() && !/^\s/.test(line)) break;
  }
  return values;
}

export function resolveProductMetadata(product: ProductCatalogueEntry, currentContent: string | null): ResolvedProduct {
  const source = currentContent ? frontmatter(currentContent) : '';
  const slug = product.slug.replace(/^\/+|\/+$/g, '');
  const gallery = listField(source, 'gallery');
  return {
    slug,
    title: scalarField(source, 'title') || product.title || product.name || slug,
    category: scalarField(source, 'category') || product.category || '',
    tagline: scalarField(source, 'tagline') || product.tagline || '',
    heroImage: scalarField(source, 'heroImage') || product.heroImage || '',
    gallery: gallery.length ? gallery : product.gallery || [],
    sourcePath: `src/content/products/${slug}.md`,
    pagePath: `/${slug}/`,
  };
}

type RecentBuildRecord = {
  id?: unknown;
  title?: unknown;
  image?: unknown;
  link?: unknown;
};

export function validateRecentBuildProductReferences(content: string, products: ResolvedProduct[]) {
  let entries: RecentBuildRecord[];
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return ['Recent Builds content must be a JSON array.'];
    entries = parsed as RecentBuildRecord[];
  } catch {
    return ['Recent Builds content is not valid JSON.'];
  }

  const issues: string[] = [];
  for (const product of products) {
    const productTitle = normaliseSearch(product.title);
    const matches = entries.filter(entry => {
      const title = normaliseSearch(typeof entry.title === 'string' ? entry.title : '');
      const id = typeof entry.id === 'string' ? entry.id : '';
      const link = typeof entry.link === 'string' ? entry.link : '';
      return title === productTitle || id === product.slug || link === product.pagePath;
    });

    for (const entry of matches) {
      const link = typeof entry.link === 'string' ? entry.link : '';
      const image = typeof entry.image === 'string' ? entry.image : '';
      if (link !== product.pagePath) {
        issues.push(`${product.title} must use the existing page path ${product.pagePath}, not ${link || '(blank)'}.`);
      }
      const allowedImages = new Set([product.heroImage, ...product.gallery].filter(Boolean));
      if (!allowedImages.has(image)) {
        issues.push(`${product.title} must use an existing product image. Current hero: ${product.heroImage}.`);
      }
    }
  }

  return issues;
}
