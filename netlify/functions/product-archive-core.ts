import { parse, stringify, Scalar } from 'yaml';

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
  // Quote the timestamp explicitly. This package follows YAML 1.2, which has no
  // implicit timestamp type, so it would emit a bare ISO string. Astro reads
  // frontmatter with gray-matter (js-yaml, YAML 1.1), where a bare ISO string
  // parses as a Date and fails the z.string() content schema, breaking the build.
  const archivedAtScalar = new Scalar(archivedAt);
  archivedAtScalar.type = Scalar.QUOTE_DOUBLE;
  data.archivedAt = archivedAtScalar;

  return {
    content: `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n\n${(match[2] ?? '').trimStart()}`,
    title,
    alreadyArchived: false,
  };
}

export function restoreProductMarkdown(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('Product file is missing YAML frontmatter.');

  const data = parse(match[1]) as Record<string, unknown>;
  const title = typeof data.title === 'string'
    ? data.title
    : typeof data.name === 'string'
      ? data.name
      : 'Product';

  if (data.archived !== true) {
    return { content, title, alreadyActive: true };
  }

  delete data.archived;
  delete data.archivedAt;

  return {
    content: `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n\n${(match[2] ?? '').trimStart()}`,
    title,
    alreadyActive: false,
  };
}
