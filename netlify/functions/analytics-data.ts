// netlify/functions/analytics-data.ts
import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';

const API_KEY = process.env.POSTHOG_API_KEY!;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID!;
const BASE = `https://app.posthog.com/api/projects/${PROJECT_ID}/query/`;

async function hogql(query: string) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) throw new Error(`PostHog error ${res.status}: ${await res.text()}`);
  return (await res.json()) as { results: unknown[][]; columns: string[] };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();

  const range = (event.queryStringParameters?.range ?? '30') as string;
  const days = ['7', '30', '90'].includes(range) ? range : '30';

  try {
    const [trendRes, sessionsRes, enquiriesRes, pagesRes, sourcesRes, youtubeRes] =
      await Promise.all([
        // Daily pageview trend
        hogql(`
          SELECT toDate(timestamp) as date, count() as views
          FROM events
          WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY
          GROUP BY date ORDER BY date ASC
        `),
        // Total unique sessions
        hogql(`
          SELECT count(DISTINCT properties.$session_id) as sessions
          FROM events
          WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY
        `),
        // Enquiry count
        hogql(`
          SELECT count() as total
          FROM events
          WHERE event = 'enquiry_submitted' AND timestamp > now() - INTERVAL ${days} DAY
        `),
        // Top 5 pages
        hogql(`
          SELECT properties.$pathname as path, count() as views
          FROM events
          WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY
            AND properties.$pathname IS NOT NULL
          GROUP BY path ORDER BY views DESC LIMIT 5
        `),
        // Traffic sources
        hogql(`
          SELECT
            multiIf(
              properties.$referring_domain LIKE '%google%', 'Google',
              properties.$referring_domain LIKE '%youtube%', 'YouTube',
              properties.$referring_domain LIKE '%facebook%', 'Facebook',
              properties.$referring_domain LIKE '%instagram%', 'Instagram',
              properties.$referring_domain IS NULL OR properties.$referring_domain = '', 'Direct',
              'Other'
            ) as source,
            count() as visits
          FROM events
          WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY
          GROUP BY source ORDER BY visits DESC
        `),
        // YouTube UTM attribution
        hogql(`
          SELECT
            coalesce(properties.utm_campaign, 'Unknown campaign') as campaign,
            count() as visits
          FROM events
          WHERE event = '$pageview'
            AND timestamp > now() - INTERVAL ${days} DAY
            AND (properties.utm_source LIKE '%youtube%'
              OR properties.$referring_domain LIKE '%youtube%')
          GROUP BY campaign ORDER BY visits DESC LIMIT 5
        `),
      ]);

    const sessions = (sessionsRes.results[0]?.[0] as number) ?? 0;
    const enquiries = (enquiriesRes.results[0]?.[0] as number) ?? 0;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify({
        range: days,
        sessions,
        enquiries,
        conversionRate: sessions > 0 ? ((enquiries / sessions) * 100).toFixed(1) : '0.0',
        trend: trendRes.results.map(([date, views]) => ({ date, views })),
        topPages: pagesRes.results.map(([path, views]) => ({ path, views })),
        sources: sourcesRes.results.map(([source, visits]) => ({ source, visits })),
        youtube: youtubeRes.results.map(([campaign, visits]) => ({ campaign, visits })),
      }),
    };
  } catch (err) {
    console.error('analytics-data error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
