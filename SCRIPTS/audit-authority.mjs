import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
const root = path.resolve('dist');
const siteOrigin = 'https://beyondrv.com.au';

const decode = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }));
  return nested.flat();
}

function routeFor(file) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}

function localTargetExists(href, htmlRoutes, files) {
  const url = new URL(href, siteOrigin);
  if (url.origin !== siteOrigin) return true;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.startsWith('/api/') || pathname.startsWith('/.netlify/')) return true;
  if (htmlRoutes.has(pathname)) return true;
  const candidate = pathname.replace(/^\//, '');
  return files.has(candidate) || files.has(`${candidate}/index.html`);
}

function collectJsonLd(html, parseErrors) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.flatMap((match) => {
    try {
      const value = JSON.parse(match[1]);
      return Array.isArray(value) ? value : [value];
    } catch (error) {
      parseErrors.push(String(error));
      return [];
    }
  });
}

function visitJson(value, visitor) {
  if (!value || typeof value !== 'object') return;
  visitor(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => visitJson(item, visitor));
    else visitJson(child, visitor);
  }
}

const allFiles = await walk(root);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html') && !/^google[^/]*\.html$/i.test(path.basename(file)));
const fileSet = new Set(allFiles.map((file) => path.relative(root, file).replaceAll(path.sep, '/')));
const htmlRoutes = new Set(htmlFiles.map(routeFor));
const pages = [];
const brokenLinks = [];

for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  const route = routeFor(file);
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  const description = decode(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] ?? '';
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decode(match[1]));
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) => match[1]);
  const missingAlt = [...html.matchAll(/<img\b([^>]*)>/gi)].filter((match) => !/\balt=["'][^"']*["']/i.test(match[1])).length;
  const parseErrors = [];
  const schemas = collectJsonLd(html, parseErrors);
  const schemaTypes = new Set();
  const schemaIds = [];
  const invalidAvailability = [];
  visitJson(schemas, (item) => {
    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
    types.filter(Boolean).forEach((type) => schemaTypes.add(type));
    // An object containing only @id is a reference to the canonical entity,
    // not a second entity definition.
    if (item['@id'] && (item['@type'] || Object.keys(item).some((key) => !['@id', '@context'].includes(key)))) {
      schemaIds.push(item['@id']);
    }
    if (item.availability && !String(item.availability).startsWith('https://schema.org/')) {
      invalidAvailability.push(item.availability);
    }
  });
  const duplicateSchemaIds = [...new Set(schemaIds.filter((id, index) => schemaIds.indexOf(id) !== index))];
  const legacyBrandMentions = (html.match(/\bByond ?RV\b/g) ?? []).length;
  const unverifiedOriginClaims = (
    html.match(
      /\b(?:(?:custom[- ]built|built|manufactured|made|finished)(?:\s+to\s+order)?\s+in\s+Queensland|Queensland[-\s]+(?:built|made|manufactured|finished)|100%\s+Queensland\s+finished|(?:we|Beyond RV)\s+(?:build|manufacture)s?\s+(?:every\s+)?(?:caravans?|campers?|slide-ons?|shells?)|one\s+of\s+the\s+few\s+manufacturers)\b/gi,
    ) ?? []
  ).map(decode);

  for (const href of links) {
    if (/^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    if (!localTargetExists(href, htmlRoutes, fileSet)) brokenLinks.push({ from: route, href });
  }

  pages.push({
    route,
    title,
    description,
    canonical,
    h1s,
    missingAlt,
    schemaTypes: [...schemaTypes].sort(),
    duplicateSchemaIds,
    invalidAvailability,
    legacyBrandMentions,
    unverifiedOriginClaims,
    jsonLdParseErrors: parseErrors,
  });
}

const failures = {
  missingTitle: pages.filter((page) => !page.title).map((page) => page.route),
  missingDescription: pages.filter((page) => !page.description).map((page) => page.route),
  missingCanonical: pages.filter((page) => !page.canonical).map((page) => page.route),
  invalidH1Count: pages.filter((page) => page.h1s.length !== 1).map((page) => ({ route: page.route, count: page.h1s.length })),
  missingImageAlt: pages.filter((page) => page.missingAlt > 0).map((page) => ({ route: page.route, count: page.missingAlt })),
  duplicateSchemaIds: pages.filter((page) => page.duplicateSchemaIds.length > 0).map((page) => ({ route: page.route, ids: page.duplicateSchemaIds })),
  invalidAvailability: pages.filter((page) => page.invalidAvailability.length > 0).map((page) => ({ route: page.route, values: page.invalidAvailability })),
  legacyBrandMentions: pages.filter((page) => page.legacyBrandMentions > 0).map((page) => ({ route: page.route, count: page.legacyBrandMentions })),
  unverifiedOriginClaims: pages
    .filter((page) => page.unverifiedOriginClaims.length > 0)
    .map((page) => ({ route: page.route, claims: page.unverifiedOriginClaims })),
  jsonLdParseErrors: pages.filter((page) => page.jsonLdParseErrors.length > 0).map((page) => ({ route: page.route, errors: page.jsonLdParseErrors })),
  brokenInternalLinks: brokenLinks,
};
const failureCount = Object.values(failures).reduce((total, entries) => total + entries.length, 0);
const report = {
  generatedAt: new Date().toISOString(),
  source: root,
  pageCount: pages.length,
  failureCount,
  failures,
  pages,
};

if (outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absoluteOutput), { recursive: true });
  await fs.writeFile(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Authority audit written to ${absoluteOutput}`);
}
console.log(JSON.stringify({ pageCount: report.pageCount, failureCount, failures }, null, 2));
if (failureCount > 0) process.exitCode = 1;
