// src/components/AnalyticsDashboard.tsx
import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  range: string;
  sessions: number;
  enquiries: number;
  conversionRate: string;
  trend: { date: string; views: number }[];
  topPages: { path: string; views: number }[];
  sources: { source: string; visits: number }[];
  youtube: { campaign: string; visits: number }[];
}

const PIE_COLORS = ['#E8540A', '#f97316', '#fb923c', '#fed7aa', '#6b7280'];

const RANGE_OPTIONS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

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

export default function AnalyticsDashboard() {
  const [range, setRange] = useState('30');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/.netlify/functions/analytics-data?range=${range}`)
      .then(r => r.json())
      .then((d: AnalyticsData) => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [range]);

  const card: React.CSSProperties = {
    background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1.25rem',
  };
  const sectionTitle: React.CSSProperties = {
    color: '#fff', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem',
  };

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
                  <Pie data={data.sources} dataKey="visits" nameKey="source" cx="50%" cy="50%"
                    outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {data.sources.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
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
          No YouTube traffic in the last {range} days. Add <code style={{ color: '#E8540A' }}>?utm_source=youtube&utm_campaign=video-title</code> to links in your video descriptions.
        </div>
      )}
    </div>
  );
}
