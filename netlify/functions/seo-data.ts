import type { Handler } from '@netlify/functions';
import { createSign } from 'node:crypto';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const SITE_URL = 'https://beyondrv.com.au';
const SITEMAP_URL = `${SITE_URL}/sitemap-0.xml`;
const SITEMAP_INDEX_URL = `${SITE_URL}/sitemap-index.xml`;
const ROBOTS_URL = `${SITE_URL}/robots.txt`;
const LLMS_URL = `${SITE_URL}/llms.txt`;
const GSC_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GSC_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GSC_SITE_URL = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ?? 'sc-domain:beyondrv.com.au';

type HealthStatus = 'ready' | 'warning' | 'critical';

interface Check {
  label: string;
  status: HealthStatus;
  detail: string;
}

interface SearchConsoleRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=300',
    },
    body: JSON.stringify(body),
  };
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function getGoogleAccessToken() {
  if (!GSC_EMAIL || !GSC_PRIVATE_KEY) throw new Error('Google Search Console credentials are not configured.');
  const assertion = signJwt(GSC_EMAIL, GSC_PRIVATE_KEY);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google auth failed ${response.status}: ${await response.text()}`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Google auth response did not include an access token.');
  return data.access_token;
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function querySearchConsole(days: number, dimensions: string[]) {
  const token = await getGoogleAccessToken();
  const endDate = isoDateDaysAgo(2);
  const startDate = isoDateDaysAgo(days + 2);
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions,
      rowLimit: 10,
      searchType: 'web',
    }),
  });
  if (!response.ok) throw new Error(`Search Console query failed ${response.status}: ${await response.text()}`);
  return await response.json() as { rows?: SearchConsoleRow[] };
}

async function loadSearchConsole(days: number) {
  if (!GSC_EMAIL || !GSC_PRIVATE_KEY) {
    return {
      status: 'warning' as const,
      message: 'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Netlify to show Google Search Console data.',
      totals: null,
      topQueries: [],
      topPages: [],
    };
  }

  const [queryData, pageData] = await Promise.all([
    querySearchConsole(days, ['query']),
    querySearchConsole(days, ['page']),
  ]);
  const rows = queryData.rows ?? [];
  const totals = rows.reduce<{ clicks: number; impressions: number; positionNumerator: number }>((acc, row) => {
    acc.clicks += row.clicks ?? 0;
    acc.impressions += row.impressions ?? 0;
    acc.positionNumerator += (row.position ?? 0) * (row.impressions ?? 0);
    return acc;
  }, { clicks: 0, impressions: 0, positionNumerator: 0 });

  return {
    status: 'ready' as const,
    message: `Google Search Console connected for ${GSC_SITE_URL}.`,
    totals: {
      clicks: Math.round(totals.clicks),
      impressions: Math.round(totals.impressions),
      ctr: totals.impressions > 0 ? `${((totals.clicks / totals.impressions) * 100).toFixed(1)}%` : '0.0%',
      averagePosition: totals.impressions > 0 ? (totals.positionNumerator / totals.impressions).toFixed(1) : '0.0',
    },
    topQueries: rows.map(row => ({
      query: row.keys?.[0] ?? 'Unknown query',
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: `${((row.ctr ?? 0) * 100).toFixed(1)}%`,
      position: (row.position ?? 0).toFixed(1),
    })),
    topPages: (pageData.rows ?? []).map(row => ({
      page: row.keys?.[0] ?? 'Unknown page',
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: `${((row.ctr ?? 0) * 100).toFixed(1)}%`,
      position: (row.position ?? 0).toFixed(1),
    })),
  };
}

function extractUrls(xml: string) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]?.trim()).filter(Boolean) as string[];
}

function countMatches(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

async function fetchText(url: string) {
  const response = await fetch(url);
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

async function loadTechnicalAudit() {
  const [robots, sitemapIndex, sitemap, llms] = await Promise.all([
    fetchText(ROBOTS_URL),
    fetchText(SITEMAP_INDEX_URL),
    fetchText(SITEMAP_URL),
    fetchText(LLMS_URL),
  ]);

  const urls = sitemap.ok ? extractUrls(sitemap.text) : [];
  const sitemapHasLastmod = /<lastmod>/.test(sitemap.text);
  const checks: Check[] = [
    {
      label: 'robots.txt',
      status: robots.ok ? 'ready' : 'critical',
      detail: robots.ok ? `Available at ${ROBOTS_URL}` : `Could not load robots.txt (${robots.status}).`,
    },
    {
      label: 'Sitemap index',
      status: sitemapIndex.ok ? 'ready' : 'critical',
      detail: sitemapIndex.ok ? `Available at ${SITEMAP_INDEX_URL}` : `Could not load sitemap index (${sitemapIndex.status}).`,
    },
    {
      label: 'Sitemap URLs',
      status: urls.length > 0 ? 'ready' : 'critical',
      detail: `${urls.length} URLs found in ${SITEMAP_URL}.`,
    },
    {
      label: 'Sitemap freshness',
      status: sitemapHasLastmod ? 'ready' : 'warning',
      detail: sitemapHasLastmod ? 'Sitemap includes lastmod values.' : 'Sitemap does not include lastmod values yet.',
    },
    {
      label: 'llms.txt',
      status: llms.ok ? 'ready' : 'warning',
      detail: llms.ok ? `Available at ${LLMS_URL}` : `Could not load llms.txt (${llms.status}).`,
    },
    {
      label: 'OpenAI search crawlers',
      status: /OAI-SearchBot/i.test(robots.text) && /ChatGPT-User/i.test(robots.text) ? 'ready' : 'warning',
      detail: /OAI-SearchBot/i.test(robots.text) && /ChatGPT-User/i.test(robots.text)
        ? 'OAI-SearchBot and ChatGPT-User are explicitly allowed.'
        : 'Add explicit allow rules for OAI-SearchBot and ChatGPT-User.',
    },
    {
      label: 'Claude and Perplexity crawlers',
      status: /Claude-SearchBot/i.test(robots.text) && /PerplexityBot/i.test(robots.text) ? 'ready' : 'warning',
      detail: /Claude-SearchBot/i.test(robots.text) && /PerplexityBot/i.test(robots.text)
        ? 'Claude and Perplexity crawler rules are present.'
        : 'Add Claude-SearchBot, Claude-User, and PerplexityBot if maximum AI-search visibility is desired.',
    },
  ];

  const sampleUrls = [
    SITE_URL,
    `${SITE_URL}/our-slide-on-campers/`,
    `${SITE_URL}/our-caravans/`,
    `${SITE_URL}/expedition/`,
    `${SITE_URL}/vehicle-suitability-checker/`,
  ];
  const samplePages = await Promise.all(sampleUrls.map(async (url) => {
    const page = await fetchText(url);
    const title = page.text.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
    const description = page.text.match(/<meta name="description" content="(.*?)"/i)?.[1] ?? '';
    return {
      url,
      status: page.status,
      title,
      description,
      canonical: page.text.match(/<link rel="canonical" href="(.*?)"/i)?.[1] ?? '',
      structuredDataBlocks: countMatches(page.text, /type="application\/ld\+json"/g),
      noindex: /<meta name="robots" content="[^"]*noindex/i.test(page.text),
    };
  }));

  return {
    checks,
    robots: {
      allowsGooglebot: /Googlebot/i.test(robots.text),
      allowsBingbot: /Bingbot/i.test(robots.text),
      allowsOpenAI: /OAI-SearchBot/i.test(robots.text) && /ChatGPT-User/i.test(robots.text),
      allowsClaude: /Claude-SearchBot/i.test(robots.text),
      allowsPerplexity: /PerplexityBot/i.test(robots.text),
    },
    sitemap: {
      url: SITEMAP_URL,
      urls,
      urlCount: urls.length,
      hasLastmod: sitemapHasLastmod,
    },
    samplePages,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const range = event.queryStringParameters?.range ?? '30';
  const days = ['7', '30', '90'].includes(range) ? Number(range) : 30;

  try {
    const [technical, searchConsole] = await Promise.all([
      loadTechnicalAudit(),
      loadSearchConsole(days).catch(error => ({
        status: 'warning' as const,
        message: String(error),
        totals: null,
        topQueries: [],
        topPages: [],
      })),
    ]);

    return json(200, {
      range: String(days),
      generatedAt: new Date().toISOString(),
      technical,
      searchConsole,
      bing: {
        status: process.env.BING_WEBMASTER_API_KEY ? 'warning' : 'warning',
        message: process.env.BING_WEBMASTER_API_KEY
          ? 'Bing API key is configured. Bing performance wiring is the next integration step.'
          : 'Set BING_WEBMASTER_API_KEY when ready to add Bing Webmaster performance data.',
      },
      aiSearch: {
        status: 'manual',
        message: 'Use the monthly AI prompt test table in docs/reports/seo-ai-search-daily-progress.md until AI citation APIs are available.',
      },
    });
  } catch (error) {
    console.error('[seo-data] audit failed:', error);
    return json(500, { error: String(error) });
  }
};
