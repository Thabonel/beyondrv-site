import { parse, stringify } from 'yaml';

export function isSafeProductSlug(slug: string) {
  return /^[a-z0-9][a-z0-9/-]*[a-z0-9]$/.test(slug) && !slug.includes('..') && !slug.includes('//');
}

export function productPathCandidates(slug: string) {
  const paths = [`src/content/products/${slug}.md`];
  if (!slug.includes('/')) paths.push(`src/content/products/accessories/${slug}.md`);
  return paths;
}

export function archiveProductMarkdown(content: string, archivedAt: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Product file is missing YAML frontmatter.');

  const data = parse(match[1]) as Record<string, unknown>;
  const title = typeof data.title === 'string'
    ? data.title
    : typeof data.name === 'string'
      ? data.name
      : 'Product';

  if (data.archived === true) {
    return { content, title, alreadyArchived: true };
  }

  data.archived = true;
  data.archivedAt = archivedAt;

  return {
    content: `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n\n${(match[2] ?? '').trimStart()}`,
    title,
    alreadyArchived: false,
  };
}
