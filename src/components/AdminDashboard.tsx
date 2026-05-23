import { useEffect, useState } from 'react';

type HealthStatus = 'ready' | 'warning' | 'blocker' | 'unavailable' | 'error';

interface LeadStatus {
  enquiryId: string;
  status: 'new' | 'contacted' | 'quoted' | 'won' | 'lost' | 'spam';
  notes?: string;
  nextFollowUpDate?: string;
  updatedAt?: string;
}

interface LeadRecord {
  id: string;
  submittedAt: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  product_interest?: string;
  callback_date?: string;
  callback_time?: string;
  leadStatus: LeadStatus;
}

interface ProductPerformanceRecord {
  slug: string;
  title: string;
  category: string;
  status: string;
  onSale: boolean;
  price: string;
  enquiries30Days: number;
  totalEnquiries: number;
  pageViews: number;
  conversionRate: string;
  flags: string[];
}

interface DashboardData {
  generatedAt: string;
  range: string;
  decisions: string[];
  inventory: {
    totalProducts: number;
    available: number;
    onSale: number;
    comingSoon: number;
    featured: number;
    estimatedListedValue: number;
    byCategory: { category: string; count: number; value: number }[];
    byStatus: { status: string; count: number }[];
    weakListings: { slug: string; title: string; issue: string }[];
  };
  leads: {
    last7Days: number;
    last30Days: number;
    open: number;
    dueToday: number;
    overdue: number;
    byStatus: { status: string; count: number }[];
    followUpQueue: LeadRecord[];
    recent: LeadRecord[];
  };
  productPerformance: ProductPerformanceRecord[];
  productInterest: {
    unknownProductEnquiries: number;
    topProducts: ProductPerformanceRecord[];
    staleProducts: ProductPerformanceRecord[];
  };
  traffic: { source: string; sessions: number; enquiries: number; conversionRate: string }[];
  funnel: { label: string; count: number; dropOff?: string }[];
  analytics: { status: HealthStatus; message: string };
  contact: { ready: boolean; toEmail: string; fromEmail: string };
  readiness: { label: string; status: HealthStatus; detail: string }[];
}

const RANGE_OPTIONS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

const STATUS_COLOUR: Record<string, string> = {
  ready: '#4ade80',
  warning: '#fb923c',
  blocker: '#f87171',
  unavailable: '#888',
  error: '#f87171',
  new: '#f87171',
  contacted: '#fb923c',
  quoted: '#60a5fa',
  won: '#4ade80',
  lost: '#888',
  spam: '#777',
};

function money(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({ label, value, sub, tone = 'ready' }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div style={{ background: '#161616', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem' }}>
      <div style={{ color: '#888', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '1.45rem', fontWeight: 800, marginTop: '0.25rem' }}>{value}</div>
      {sub && <div style={{ color: STATUS_COLOUR[tone] ?? '#777', fontSize: '0.72rem', marginTop: '0.2rem', lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.9rem', display: 'grid', gap: '0.75rem' }}>
      <h3 style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontWeight: 800 }}>{title}</h3>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span style={{
      color: STATUS_COLOUR[status] ?? '#aaa',
      border: `1px solid ${STATUS_COLOUR[status] ?? '#444'}`,
      borderRadius: '999px',
      padding: '0.12rem 0.45rem',
      fontSize: '0.66rem',
      fontWeight: 800,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

export default function AdminDashboard({ pendingCount = 0 }: { pendingCount?: number }) {
  const [range, setRange] = useState('30');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/.netlify/functions/admin-dashboard?range=${range}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not load dashboard');
        return body as DashboardData;
      })
      .then((body) => setData(body))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Could not load dashboard');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [range]);

  if (error) {
    return (
      <div style={{ padding: '1rem', color: '#f87171', fontSize: '0.85rem', lineHeight: 1.45 }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800 }}>Business Dashboard</div>
          <div style={{ color: '#888', fontSize: '0.74rem', marginTop: '0.18rem' }}>
            Stock, leads, readiness, and performance
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setRange(option.value)}
              style={{
                background: range === option.value ? '#E8540A' : '#1a1a1a',
                color: range === option.value ? '#fff' : '#aaa',
                border: `1px solid ${range === option.value ? '#E8540A' : '#333'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.35rem 0.45rem',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div style={{ color: '#777', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>Loading dashboard...</div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
            <StatCard label="Products" value={data.inventory.totalProducts} sub={`${data.inventory.available} available`} />
            <StatCard label="Listed Value" value={money(data.inventory.estimatedListedValue)} sub="Estimate only" tone="warning" />
            <StatCard label="30 Day Leads" value={data.leads.last30Days} sub={`${data.leads.open} open`} tone={data.leads.open ? 'warning' : 'ready'} />
            <StatCard label="Due Follow-Ups" value={data.leads.dueToday + data.leads.overdue} sub={`${data.leads.overdue} overdue`} tone={data.leads.overdue ? 'blocker' : data.leads.dueToday ? 'warning' : 'ready'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
            <StatCard label="Email Delivery" value={data.contact.ready ? 'Ready' : 'Check'} sub={data.contact.ready ? data.contact.toEmail : 'Missing Resend/from email'} tone={data.contact.ready ? 'ready' : 'blocker'} />
            <StatCard label="Pending Changes" value={pendingCount} sub={pendingCount ? 'Review before deploy' : 'None queued'} tone={pendingCount ? 'warning' : 'ready'} />
          </div>

          <Panel title="Lead Follow-Up Queue">
            {data.leads.followUpQueue.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No due or overdue follow-ups.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.leads.followUpQueue.map((lead) => (
                  <div key={lead.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '0.65rem', display: 'grid', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                      <strong style={{ color: '#fff', fontSize: '0.82rem' }}>{lead.name}</strong>
                      <StatusPill status={lead.leadStatus.status} />
                    </div>
                    <div style={{ color: '#aaa', fontSize: '0.72rem' }}>{lead.product_interest || 'General enquiry'}</div>
                    <div style={{ color: '#fb923c', fontSize: '0.72rem' }}>Follow up: {lead.leadStatus.nextFollowUpDate}</div>
                    <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.74rem' }}>
                      <a href={`tel:${lead.phone}`} style={{ color: '#E8540A' }}>Call</a>
                      <a href={`mailto:${lead.email}`} style={{ color: '#E8540A' }}>Email</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Lead Status">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
              {data.leads.byStatus.map((row) => (
                <div key={row.status} style={{ border: '1px solid #303030', borderRadius: '6px', padding: '0.55rem', background: '#161616' }}>
                  <div style={{ color: STATUS_COLOUR[row.status] ?? '#aaa', fontWeight: 800, fontSize: '1rem' }}>{row.count}</div>
                  <div style={{ color: '#aaa', textTransform: 'capitalize', fontSize: '0.7rem' }}>{row.status}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Inventory">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
              <StatCard label="Available" value={data.inventory.available} />
              <StatCard label="On Sale" value={data.inventory.onSale} tone="warning" />
              <StatCard label="Coming Soon" value={data.inventory.comingSoon} />
            </div>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {data.inventory.byCategory.map((row) => (
                <div key={row.category} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', color: '#ccc', fontSize: '0.76rem' }}>
                  <span style={{ textTransform: 'capitalize' }}>{row.category}</span>
                  <span>{row.count} · {money(row.value)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Products Needing Attention">
            {data.productInterest.staleProducts.length === 0 && data.inventory.weakListings.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No obvious stock issues in this range.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {[...data.productInterest.staleProducts.slice(0, 5), ...data.inventory.weakListings.slice(0, 5)].slice(0, 8).map((product, index) => (
                  <div key={`${product.slug}-${index}`} style={{ borderBottom: '1px solid #252525', paddingBottom: '0.4rem' }}>
                    <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{product.title}</div>
                    <div style={{ color: '#fb923c', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                      {'flags' in product ? product.flags.join(', ') || 'No enquiries in 30 days' : product.issue}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Product Interest">
            {data.productInterest.topProducts.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No product-specific enquiries yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {data.productInterest.topProducts.map((product) => (
                  <div key={product.slug} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.7rem', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                      <div style={{ color: '#777', fontSize: '0.68rem' }}>{product.pageViews} views · {product.conversionRate}% page-to-lead</div>
                    </div>
                    <div style={{ color: '#E8540A', fontWeight: 800 }}>{product.totalEnquiries}</div>
                  </div>
                ))}
              </div>
            )}
            {data.productInterest.unknownProductEnquiries > 0 && (
              <p style={{ margin: 0, color: '#888', fontSize: '0.72rem' }}>{data.productInterest.unknownProductEnquiries} enquiries could not be matched to a specific product.</p>
            )}
          </Panel>

          <Panel title="Funnel">
            {data.analytics.status !== 'ready' ? (
              <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>{data.analytics.message}</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {data.funnel.map((step) => (
                  <div key={step.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', color: '#ccc', fontSize: '0.76rem' }}>
                    <span>{step.label}</span>
                    <span>{step.count.toLocaleString()}{step.dropOff ? ` · ${step.dropOff} drop` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Traffic Quality">
            {data.traffic.length === 0 ? (
              <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>Traffic quality appears here once PostHog server analytics are configured.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {data.traffic.slice(0, 6).map((source) => (
                  <div key={source.source} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.7rem', color: '#ccc', fontSize: '0.76rem' }}>
                    <span>{source.source}</span>
                    <span>{source.sessions} visits · {source.enquiries} leads · {source.conversionRate}%</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Launch Readiness">
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {data.readiness.map((item) => (
                <div key={item.label} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.55rem', alignItems: 'start' }}>
                  <StatusPill status={item.status} />
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 700 }}>{item.label}</div>
                    <div style={{ color: '#888', fontSize: '0.7rem', marginTop: '0.1rem', lineHeight: 1.35 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Build Decisions">
            <ul style={{ margin: 0, paddingLeft: '1rem', color: '#aaa', fontSize: '0.72rem', lineHeight: 1.45 }}>
              {data.decisions.map((decision) => <li key={decision}>{decision}</li>)}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
