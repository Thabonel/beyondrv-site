import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminFetch, clearAdminToken } from '../lib/adminApi';

interface AnalyticsData {
  range: string;
  sessions: number;
  enquiries: number;
  conversionRate: string;
  trend: { date: string; views: number }[];
  topPages: { path: string; views: number }[];
  sources: { source: string; visits: number }[];
  youtube: { campaign: string; visits: number }[];
  warning?: string;
}

interface SeoData {
  range: string;
  generatedAt: string;
  technical: {
    checks: { label: string; status: 'ready' | 'warning' | 'critical'; detail: string }[];
    robots: {
      allowsGooglebot: boolean;
      allowsBingbot: boolean;
      allowsOpenAI: boolean;
      allowsClaude: boolean;
      allowsPerplexity: boolean;
    };
    sitemap: {
      url: string;
      urls: string[];
      urlCount: number;
      hasLastmod: boolean;
    };
    samplePages: {
      url: string;
      status: number;
      title: string;
      description: string;
      canonical: string;
      structuredDataBlocks: number;
      noindex: boolean;
    }[];
  };
  searchConsole: {
    status: 'ready' | 'warning' | 'critical';
    message: string;
    totals: null | {
      clicks: number;
      impressions: number;
      ctr: string;
      averagePosition: string;
    };
    topQueries: { query: string; clicks: number; impressions: number; ctr: string; position: string }[];
    topPages: { page: string; clicks: number; impressions: number; ctr: string; position: string }[];
  };
  bing: { status: 'ready' | 'warning' | 'critical'; message: string };
  aiSearch: { status: string; message: string };
}

const PIE_COLORS = ['#E8540A', '#f97316', '#fb923c', '#fed7aa', '#6b7280'];

const RANGE_OPTIONS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

const SOURCE_OPTIONS = [
  { label: 'YouTube', value: 'youtube', example: 'unimog-video' },
  { label: 'Instagram', value: 'instagram', example: 'advent-2150-reel' },
  { label: 'Facebook', value: 'facebook', example: 'sunpatch-post' },
];

function campaignSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTrackedUrl(pageUrl: string, source: string, campaign: string) {
  const base = pageUrl.trim() || 'https://beyondrv.com.au/';
  const separator = base.includes('?') ? '&' : '?';
  const safeCampaign = campaignSlug(campaign) || SOURCE_OPTIONS.find(option => option.value === source)?.example || 'campaign';
  return `${base}${separator}utm_source=${encodeURIComponent(source)}&utm_campaign=${encodeURIComponent(safeCampaign)}`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
      padding: '1.25rem', flex: 1, minWidth: '140px',
    }}>
      <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: 'ready' | 'warning' | 'critical' | string }) {
  const color = status === 'ready' ? '#4ade80' : status === 'critical' ? '#f87171' : '#fb923c';
  return (
    <span style={{
      color,
      border: `1px solid ${color}55`,
      background: `${color}16`,
      borderRadius: '999px',
      padding: '0.16rem 0.48rem',
      fontSize: '0.68rem',
      fontWeight: 700,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

export default function AnalyticsDashboard() {
  const [range, setRange] = useState('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seoLoading, setSeoLoading] = useState(true);
  const [error, setError] = useState('');
  const [seoError, setSeoError] = useState('');
  const [campaignSource, setCampaignSource] = useState('youtube');
  const [campaignName, setCampaignName] = useState('unimog-video');
  const [campaignPage, setCampaignPage] = useState('https://beyondrv.com.au/our-slide-on-campers/');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    adminFetch(`/.netlify/functions/analytics-data?range=${range}`, { signal: controller.signal })
      .then(async r => {
        if (r.status === 401) {
          clearAdminToken();
          window.location.href = '/.netlify/functions/admin-login';
          return null;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Could not load analytics');
        return body as AnalyticsData;
      })
      .then((d) => { if (d) setData(d); setLoading(false); })
      .catch(e => { if (e.name !== 'AbortError') { setError(String(e)); setLoading(false); } });
    return () => controller.abort();
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    setSeoLoading(true);
    setSeoError('');
    adminFetch(`/.netlify/functions/seo-data?range=${range}`, { signal: controller.signal })
      .then(async r => {
        if (r.status === 401) {
          clearAdminToken();
          window.location.href = '/.netlify/functions/admin-login';
          return null;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Could not load SEO data');
        return body as SeoData;
      })
      .then((d) => { if (d) setSeoData(d); setSeoLoading(false); })
      .catch(e => { if (e.name !== 'AbortError') { setSeoError(String(e)); setSeoLoading(false); } });
    return () => controller.abort();
  }, [range]);

  const card: React.CSSProperties = {
    background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1.25rem',
  };
  const sectionTitle: React.CSSProperties = {
    color: '#fff', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    padding: '0.6rem',
    fontSize: '0.82rem',
  };
  const trackedUrl = buildTrackedUrl(campaignPage, campaignSource, campaignName);
  const seoReadyChecks = seoData?.technical.checks.filter(check => check.status === 'ready').length ?? 0;
  const seoWarningChecks = seoData?.technical.checks.filter(check => check.status === 'warning').length ?? 0;
  const seoCriticalChecks = seoData?.technical.checks.filter(check => check.status === 'critical').length ?? 0;

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#f87' }}>
        <p>Could not load analytics: {error}</p>
        <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Check that POSTHOG_API_KEY and POSTHOG_PROJECT_ID are set in Netlify environment variables.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'inherit' }}>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>Show:</span>
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            style={{
              background: range === opt.value ? '#E8540A' : '#1a1a1a',
              color: range === opt.value ? '#fff' : '#888',
              border: '1px solid ' + (range === opt.value ? '#E8540A' : '#333'),
              borderRadius: '4px', padding: '0.3rem 0.75rem',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            }}
          >{opt.label}</button>
        ))}
        {loading && <span style={{ color: '#555', fontSize: '0.8rem', marginLeft: '0.5rem' }}>Loading…</span>}
        {seoLoading && <span style={{ color: '#555', fontSize: '0.8rem', marginLeft: '0.5rem' }}>Checking SEO…</span>}
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#555', fontSize: '0.9rem' }}>
          Loading analytics…
        </div>
      )}

      {data?.warning && (
        <div style={{ ...card, color: '#fb923c', fontSize: '0.85rem' }}>
          {data.warning} Set `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` in Netlify to enable live traffic reporting.
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', marginBottom: '1rem' }}>
          <div>
            <div style={sectionTitle}>SEO Performance and Search Health</div>
            <p style={{ color: '#888', fontSize: '0.82rem', lineHeight: 1.55, margin: 0 }}>
              Tracks crawl health, sitemap freshness, AI crawler access, page metadata, and Google Search Console data once credentials are configured.
            </p>
          </div>
          {seoData && <span style={{ color: '#555', fontSize: '0.72rem' }}>Updated {new Date(seoData.generatedAt).toLocaleString()}</span>}
        </div>

        {seoError && (
          <div style={{ border: '1px solid #7f1d1d', background: '#2a0d0d', color: '#fca5a5', borderRadius: '6px', padding: '0.75rem', fontSize: '0.82rem' }}>
            Could not load SEO data: {seoError}
          </div>
        )}

        {seoLoading && !seoData && (
          <div style={{ color: '#555', fontSize: '0.85rem' }}>Loading SEO checks…</div>
        )}

        {seoData && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <StatCard label="Sitemap URLs" value={seoData.technical.sitemap.urlCount.toLocaleString()} sub={seoData.technical.sitemap.hasLastmod ? 'lastmod present' : 'lastmod missing'} />
              <StatCard label="Ready Checks" value={seoReadyChecks} sub={`${seoWarningChecks} warnings · ${seoCriticalChecks} critical`} />
              <StatCard label="Google Clicks" value={seoData.searchConsole.totals?.clicks.toLocaleString() ?? '—'} sub={seoData.searchConsole.status === 'ready' ? `last ${range} days` : 'Search Console not connected'} />
              <StatCard label="Google CTR" value={seoData.searchConsole.totals?.ctr ?? '—'} sub={seoData.searchConsole.totals ? `avg pos ${seoData.searchConsole.totals.averagePosition}` : 'Search Console not connected'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: '#0b0b0b', border: '1px solid #252525', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ ...sectionTitle, marginBottom: '0.75rem' }}>Technical Checks</div>
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  {seoData.technical.checks.map(check => (
                    <div key={check.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', alignItems: 'start', borderTop: '1px solid #1d1d1d', paddingTop: '0.65rem' }}>
                      <div style={{ display: 'grid', gap: '0.25rem' }}>
                        <span style={{ color: '#ddd', fontSize: '0.78rem', fontWeight: 700 }}>{check.label}</span>
                        <StatusPill status={check.status} />
                      </div>
                      <span style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.45 }}>{check.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#0b0b0b', border: '1px solid #252525', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ ...sectionTitle, marginBottom: '0.75rem' }}>Crawler Access</div>
                <div style={{ display: 'grid', gap: '0.55rem', color: '#aaa', fontSize: '0.8rem' }}>
                  {[
                    ['Googlebot', seoData.technical.robots.allowsGooglebot],
                    ['Bingbot', seoData.technical.robots.allowsBingbot],
                    ['OpenAI search', seoData.technical.robots.allowsOpenAI],
                    ['Claude search', seoData.technical.robots.allowsClaude],
                    ['Perplexity', seoData.technical.robots.allowsPerplexity],
                  ].map(([label, ok]) => (
                    <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid #1d1d1d', paddingTop: '0.55rem' }}>
                      <span>{label}</span>
                      <StatusPill status={ok ? 'ready' : 'warning'} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid #1d1d1d', paddingTop: '0.75rem' }}>
                  <div style={{ color: '#ddd', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem' }}>Google Search Console</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <StatusPill status={seoData.searchConsole.status} />
                    <span style={{ color: '#888', fontSize: '0.76rem', lineHeight: 1.45 }}>{seoData.searchConsole.message}</span>
                  </div>
                  <div style={{ color: '#ddd', fontSize: '0.78rem', fontWeight: 700, margin: '0.8rem 0 0.3rem' }}>Bing Webmaster</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <StatusPill status={seoData.bing.status} />
                    <span style={{ color: '#888', fontSize: '0.76rem', lineHeight: 1.45 }}>{seoData.bing.message}</span>
                  </div>
                </div>
              </div>
            </div>

            {seoData.searchConsole.topQueries.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#0b0b0b', border: '1px solid #252525', borderRadius: '8px', padding: '1rem' }}>
                  <div style={sectionTitle}>Top Google Queries</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        {['Query', 'Clicks', 'Impr.', 'Pos.'].map(label => (
                          <th key={label} style={{ textAlign: label === 'Query' ? 'left' : 'right', color: '#666', fontWeight: 600, paddingBottom: '0.45rem' }}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {seoData.searchConsole.topQueries.map(row => (
                        <tr key={row.query} style={{ borderTop: '1px solid #1d1d1d' }}>
                          <td style={{ color: '#ccc', padding: '0.42rem 0', maxWidth: '260px' }}>{row.query}</td>
                          <td style={{ color: '#E8540A', textAlign: 'right', fontWeight: 700 }}>{row.clicks}</td>
                          <td style={{ color: '#aaa', textAlign: 'right' }}>{row.impressions}</td>
                          <td style={{ color: '#aaa', textAlign: 'right' }}>{row.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ background: '#0b0b0b', border: '1px solid #252525', borderRadius: '8px', padding: '1rem' }}>
                  <div style={sectionTitle}>Top Google Landing Pages</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        {['Page', 'Clicks', 'Impr.', 'Pos.'].map(label => (
                          <th key={label} style={{ textAlign: label === 'Page' ? 'left' : 'right', color: '#666', fontWeight: 600, paddingBottom: '0.45rem' }}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {seoData.searchConsole.topPages.map(row => (
                        <tr key={row.page} style={{ borderTop: '1px solid #1d1d1d' }}>
                          <td style={{ color: '#ccc', padding: '0.42rem 0', maxWidth: '260px', wordBreak: 'break-word' }}>{new URL(row.page).pathname}</td>
                          <td style={{ color: '#E8540A', textAlign: 'right', fontWeight: 700 }}>{row.clicks}</td>
                          <td style={{ color: '#aaa', textAlign: 'right' }}>{row.impressions}</td>
                          <td style={{ color: '#aaa', textAlign: 'right' }}>{row.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ background: '#0b0b0b', border: '1px solid #252525', borderRadius: '8px', padding: '1rem' }}>
              <div style={sectionTitle}>Sample Page Metadata</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {['Page', 'Status', 'Title', 'Schema', 'Index'].map(label => (
                      <th key={label} style={{ textAlign: label === 'Page' || label === 'Title' ? 'left' : 'right', color: '#666', fontWeight: 600, paddingBottom: '0.45rem' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seoData.technical.samplePages.map(page => (
                    <tr key={page.url} style={{ borderTop: '1px solid #1d1d1d' }}>
                      <td style={{ color: '#ccc', padding: '0.45rem 0' }}>{new URL(page.url).pathname || '/'}</td>
                      <td style={{ color: page.status === 200 ? '#4ade80' : '#f87171', textAlign: 'right', fontWeight: 700 }}>{page.status}</td>
                      <td style={{ color: '#aaa', paddingLeft: '0.8rem' }}>{page.title || 'Missing title'}</td>
                      <td style={{ color: '#aaa', textAlign: 'right' }}>{page.structuredDataBlocks}</td>
                      <td style={{ color: page.noindex ? '#fb923c' : '#4ade80', textAlign: 'right' }}>{page.noindex ? 'noindex' : 'indexable'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      {data && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <StatCard label="Sessions" value={data.sessions.toLocaleString()} sub={`last ${range} days`} />
          <StatCard label="Enquiries" value={data.enquiries.toLocaleString()} sub={`last ${range} days`} />
          <StatCard label="Conversion Rate" value={`${data.conversionRate}%`} sub="enquiries / sessions" />
          <StatCard
            label="Top Page"
            value={data.topPages[0]?.path ?? '—'}
            sub={data.topPages[0] ? `${data.topPages[0].views} views` : ''}
          />
        </div>
      )}

      <div style={card}>
        <div style={sectionTitle}>Campaign Link Builder</div>
        <p style={{ color: '#aaa', fontSize: '0.84rem', lineHeight: 1.55, margin: '0 0 1rem' }}>
          Use these tracked links anywhere Beyond RV posts content. They tell the dashboard which platform and post sent the visitor, so Facebook, Instagram, and YouTube traffic can be measured properly.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1.4fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#888', fontSize: '0.74rem' }}>
            Platform
            <select value={campaignSource} onChange={event => setCampaignSource(event.target.value)} style={inputStyle}>
              {SOURCE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#888', fontSize: '0.74rem' }}>
            Campaign / post name
            <input
              value={campaignName}
              onChange={event => setCampaignName(event.target.value)}
              placeholder="Example: unimog-video"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem', color: '#888', fontSize: '0.74rem' }}>
            Website page to link to
            <input
              value={campaignPage}
              onChange={event => setCampaignPage(event.target.value)}
              placeholder="https://beyondrv.com.au/our-slide-on-campers/"
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: '0.85rem', background: '#080808', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.55rem' }}>
          <div style={{ color: '#777', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Tracked URL</div>
          <code style={{ color: '#E8540A', fontSize: '0.82rem', lineHeight: 1.5, wordBreak: 'break-all' }}>{trackedUrl}</code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(trackedUrl);
              setCopyStatus('Copied. Paste this link into the post, video description, bio, story, or ad.');
            }}
            style={{ justifySelf: 'start', background: '#E8540A', border: 0, color: '#fff', borderRadius: '5px', padding: '0.45rem 0.75rem', cursor: 'pointer', fontWeight: 700 }}
          >
            Copy Link
          </button>
          {copyStatus && <p style={{ color: '#4ade80', margin: 0, fontSize: '0.76rem' }}>{copyStatus}</p>}
        </div>
        <ul style={{ margin: '0.85rem 0 0', paddingLeft: '1.1rem', color: '#888', fontSize: '0.78rem', lineHeight: 1.6 }}>
          <li>Use one campaign name per post, reel, video, story, or ad.</li>
          <li>Keep names short, for example <code style={{ color: '#E8540A' }}>unimog-video</code> or <code style={{ color: '#E8540A' }}>advent-2150-reel</code>.</li>
          <li>If a page already has a question mark in the URL, the builder automatically uses <code style={{ color: '#E8540A' }}>&amp;</code> instead.</li>
        </ul>
      </div>

      {/* Trend chart */}
      {data && data.trend.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>Pageview Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.trend}>
              <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
              <Line type="monotone" dataKey="views" stroke="#E8540A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top pages + Traffic sources */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div style={card}>
            <div style={sectionTitle}>Top Pages</div>
            {data.topPages.length === 0 ? (
              <p style={{ color: '#555', fontSize: '0.85rem' }}>No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topPages} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="path" tick={{ fill: '#aaa', fontSize: 11 }} tickLine={false}
                    axisLine={false} width={120} tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                  <Bar dataKey="views" fill="#E8540A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={card}>
            <div style={sectionTitle}>Traffic Sources</div>
            {data.sources.length === 0 ? (
              <p style={{ color: '#555', fontSize: '0.85rem' }}>No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.sources.map((s, i) => ({ ...s, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
                    dataKey="visits"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* YouTube attribution */}
      {data && data.youtube.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>YouTube Attribution (last {range} days)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#666', fontWeight: 500, paddingBottom: '0.5rem' }}>Campaign / Video</th>
                <th style={{ textAlign: 'right', color: '#666', fontWeight: 500, paddingBottom: '0.5rem' }}>Visits</th>
              </tr>
            </thead>
            <tbody>
              {data.youtube.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid #222' }}>
                  <td style={{ color: '#ccc', padding: '0.4rem 0' }}>{row.campaign}</td>
                  <td style={{ color: '#E8540A', textAlign: 'right', fontWeight: 600 }}>{row.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.youtube.length === 0 && (
        <div style={{ ...card, color: '#555', fontSize: '0.85rem' }}>
          No tracked social campaign traffic in the last {range} days. Use the Campaign Link Builder above for YouTube, Instagram, and Facebook links so visits can be attributed to the right post, video, reel, or ad.
        </div>
      )}
    </div>
  );
}
