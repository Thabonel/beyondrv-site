import { useEffect, useState } from 'react';
import { adminFetch, adminJson, clearAdminToken } from '../lib/adminApi';

type HealthStatus = 'ready' | 'warning' | 'blocker' | 'unavailable' | 'error';

interface LeadStatus {
  enquiryId: string;
  status: 'new' | 'contacted' | 'replied' | 'called' | 'qualified' | 'quoted' | 'follow-up-scheduled' | 'won' | 'lost' | 'spam';
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
  intelligence?: {
    score: number;
    urgency: 'hot' | 'warm' | 'cold' | 'waiting_on_customer' | 'waiting_on_byondrv' | 'dormant' | 'won' | 'lost';
    reasons: string[];
    nextAction: string;
    followUpDueDate: string;
    waitingOn: 'byondrv' | 'customer' | 'none';
  };
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

interface ProductRecommendationResult {
  status: 'ready' | 'fallback';
  message: string;
  diagnosis: string;
  ownerInputs: string[];
  recommendations: {
    title: string;
    action: string;
    evidence: string;
    priority: 'high' | 'medium' | 'low';
    category: 'quick-fix' | 'owner-action' | 'marketing' | 'technical';
  }[];
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
    priorityQueue: LeadRecord[];
    followUpQueue: LeadRecord[];
    recent: LeadRecord[];
  };
  tasks: {
    open: number;
    dueToday: number;
    overdue: number;
    recent: {
      id: string;
      title: string;
      dueDate?: string;
      priority?: string;
      status?: string;
      relatedLeadId?: string;
    }[];
  };
  productPerformance: ProductPerformanceRecord[];
  productInterest: {
    unknownProductEnquiries: number;
    topProducts: ProductPerformanceRecord[];
    staleProducts: ProductPerformanceRecord[];
  };
  traffic: { source: string; sessions: number; enquiries: number; conversionRate: string }[];
  funnel: { label: string; count: number; dropOff?: string }[];
  marketingInsights: {
    status: 'ready' | 'fallback' | 'unavailable';
    message: string;
    items: {
      title: string;
      recommendation: string;
      evidence: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  };
  chat: {
    topTopics: { topic: string; count: number }[];
    recent: {
      timestamp: string;
      question: string;
      answer: string;
      topic: string;
      page: string;
      productSlug: string;
    }[];
  };
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
  replied: '#fb923c',
  called: '#fb923c',
  qualified: '#60a5fa',
  quoted: '#60a5fa',
  'follow-up-scheduled': '#60a5fa',
  won: '#4ade80',
  lost: '#888',
  spam: '#777',
  hot: '#f87171',
  warm: '#fb923c',
  cold: '#888',
  waiting_on_customer: '#60a5fa',
  waiting_on_byondrv: '#f87171',
  dormant: '#777',
  high: '#f87171',
  medium: '#fb923c',
  low: '#4ade80',
};

function money(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function labelise(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
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
  const [recommendations, setRecommendations] = useState<Record<string, ProductRecommendationResult>>({});
  const [recommendationLoading, setRecommendationLoading] = useState<string | null>(null);
  const [recommendationErrors, setRecommendationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    adminFetch(`/.netlify/functions/admin-dashboard?range=${range}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401) {
          clearAdminToken();
          window.location.href = '/.netlify/functions/admin-login';
          return null;
        }
        const body = await adminJson<DashboardData>(res, 'Could not load dashboard');
        if (!res.ok) throw new Error(body.error ?? 'Could not load dashboard');
        return body as DashboardData;
      })
      .then((body) => {
        if (body) setData(body);
      })
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

  const chat = data?.chat ?? { recent: [], topTopics: [] };
  const attentionProducts = data ? Array.from(new Map(
    [...data.productInterest.staleProducts, ...data.inventory.weakListings].map((item) => {
      const performance = data.productPerformance.find(product => product.slug === item.slug);
      const flags = [
        ...(performance?.flags ?? []),
        ...('issue' in item ? [item.issue] : []),
      ].filter((flag, index, all) => flag && all.indexOf(flag) === index);
      return [item.slug, {
        slug: item.slug,
        title: item.title,
        flags,
        pageViews: performance?.pageViews ?? 0,
        enquiries30Days: performance?.enquiries30Days ?? 0,
        totalEnquiries: performance?.totalEnquiries ?? 0,
      }];
    })
  ).values()).slice(0, 8) : [];

  async function analyseProduct(product: typeof attentionProducts[number]) {
    setRecommendationLoading(product.slug);
    setRecommendationErrors(prev => ({ ...prev, [product.slug]: '' }));
    try {
      const res = await adminFetch('/.netlify/functions/admin-product-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      if (res.status === 401) {
        clearAdminToken();
        window.location.href = '/.netlify/functions/admin-login';
        return;
      }
      const body = await adminJson<ProductRecommendationResult>(res, 'Could not analyse product');
      if (!res.ok) throw new Error(body.error ?? 'Could not analyse product');
      setRecommendations(prev => ({ ...prev, [product.slug]: body }));
    } catch (err) {
      setRecommendationErrors(prev => ({ ...prev, [product.slug]: err instanceof Error ? err.message : 'Could not analyse product.' }));
    } finally {
      setRecommendationLoading(null);
    }
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
            <StatCard label="Open Tasks" value={data.tasks.open} sub={`${data.tasks.overdue} overdue · ${pendingCount} pending changes`} tone={data.tasks.overdue ? 'blocker' : data.tasks.dueToday ? 'warning' : pendingCount ? 'warning' : 'ready'} />
          </div>

          <Panel title="Today's Owner Priorities">
            {data.leads.priorityQueue.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No high-priority lead actions detected.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {data.leads.priorityQueue.map((lead) => (
                  <div key={lead.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '0.7rem', display: 'grid', gap: '0.42rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.7rem', alignItems: 'start' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ color: '#fff', fontSize: '0.84rem' }}>{lead.name || 'Unnamed lead'}</strong>
                        <div style={{ color: '#aaa', fontSize: '0.72rem', marginTop: '0.15rem' }}>{lead.product_interest || 'General enquiry'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <StatusPill status={lead.intelligence?.urgency ?? lead.leadStatus.status} />
                        {lead.intelligence && (
                          <span style={{ color: '#fff', background: '#262626', border: '1px solid #3a3a3a', borderRadius: '999px', padding: '0.12rem 0.45rem', fontSize: '0.66rem', fontWeight: 800 }}>
                            {lead.intelligence.score}
                          </span>
                        )}
                      </div>
                    </div>
                    {lead.intelligence && (
                      <>
                        <div style={{ color: '#ddd', fontSize: '0.75rem', lineHeight: 1.4 }}>{lead.intelligence.nextAction}</div>
                        <div style={{ color: '#888', fontSize: '0.68rem', lineHeight: 1.35 }}>{lead.intelligence.reasons.slice(0, 2).join(' ')}</div>
                        {lead.intelligence.followUpDueDate && (
                          <div style={{ color: '#fb923c', fontSize: '0.7rem' }}>Follow-up target: {lead.intelligence.followUpDueDate}</div>
                        )}
                      </>
                    )}
                    <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.74rem' }}>
                      {lead.phone && <a href={`tel:${lead.phone}`} style={{ color: '#E8540A' }}>Call</a>}
                      {lead.email && <a href={`mailto:${lead.email}`} style={{ color: '#E8540A' }}>Email</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Owner Copilot Tasks">
            {data.tasks.recent.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No open Copilot tasks yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {data.tasks.recent.map((task) => (
                  <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', borderBottom: '1px solid #252525', paddingBottom: '0.45rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{task.title}</div>
                      <div style={{ color: '#888', fontSize: '0.68rem', marginTop: '0.12rem' }}>{task.dueDate || 'No due date'}</div>
                    </div>
                    <StatusPill status={task.priority || 'medium'} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

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
            {attentionProducts.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No obvious stock issues in this range.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {attentionProducts.map((product) => (
                  <div key={product.slug} data-testid={`attention-product-${product.slug}`} style={{ borderBottom: '1px solid #252525', paddingBottom: '0.65rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.6rem', alignItems: 'start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{product.title}</div>
                        <div style={{ color: '#fb923c', fontSize: '0.7rem', marginTop: '0.15rem', lineHeight: 1.4 }}>{product.flags.join(', ')}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => analyseProduct(product)}
                        disabled={recommendationLoading === product.slug}
                        style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.38rem 0.5rem', cursor: recommendationLoading === product.slug ? 'wait' : 'pointer', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {recommendationLoading === product.slug ? 'Analysing...' : recommendations[product.slug] ? 'Analyse Again' : 'Analyse with AI'}
                      </button>
                    </div>
                    {recommendationErrors[product.slug] && <div style={{ color: '#f87171', fontSize: '0.7rem' }}>{recommendationErrors[product.slug]}</div>}
                    {recommendations[product.slug] && (
                      <div data-testid={`product-recommendations-${product.slug}`} style={{ background: '#161616', border: '1px solid #333', borderRadius: '6px', padding: '0.65rem', display: 'grid', gap: '0.55rem' }}>
                        {recommendations[product.slug].message && <div style={{ color: '#888', fontSize: '0.68rem' }}>{recommendations[product.slug].message}</div>}
                        <div style={{ color: '#ddd', fontSize: '0.74rem', lineHeight: 1.45 }}>{recommendations[product.slug].diagnosis}</div>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {recommendations[product.slug].recommendations.map((item) => (
                            <div key={`${item.category}-${item.title}`} style={{ borderTop: '1px solid #292929', paddingTop: '0.5rem', display: 'grid', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                                <div style={{ color: '#fff', fontSize: '0.74rem', fontWeight: 800 }}>{item.title}</div>
                                <StatusPill status={item.priority === 'high' ? 'blocker' : item.priority === 'medium' ? 'warning' : 'ready'} />
                              </div>
                              <div style={{ color: '#ddd', fontSize: '0.72rem', lineHeight: 1.4 }}>{item.action}</div>
                              <div style={{ color: '#777', fontSize: '0.66rem', lineHeight: 1.35 }}>{labelise(item.category)} · {item.evidence}</div>
                            </div>
                          ))}
                        </div>
                        {recommendations[product.slug].ownerInputs.length > 0 && (
                          <div style={{ borderTop: '1px solid #292929', paddingTop: '0.5rem' }}>
                            <div style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>Owner confirmation needed</div>
                            <ul style={{ color: '#aaa', fontSize: '0.68rem', lineHeight: 1.4, margin: '0.3rem 0 0 1rem', padding: 0 }}>
                              {recommendations[product.slug].ownerInputs.map(item => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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

          <Panel title="Marketing Insights">
            {data.marketingInsights.items.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No marketing insights available yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                {data.marketingInsights.message && (
                  <p style={{ margin: 0, color: '#888', fontSize: '0.72rem', lineHeight: 1.4 }}>{data.marketingInsights.message}</p>
                )}
                {data.marketingInsights.items.map((insight) => (
                  <div key={`${insight.title}-${insight.evidence}`} style={{ borderBottom: '1px solid #252525', paddingBottom: '0.55rem', display: 'grid', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>{insight.title}</div>
                      <StatusPill status={insight.priority === 'high' ? 'blocker' : insight.priority === 'medium' ? 'warning' : 'ready'} />
                    </div>
                    <div style={{ color: '#ddd', fontSize: '0.74rem', lineHeight: 1.4 }}>{insight.recommendation}</div>
                    <div style={{ color: '#888', fontSize: '0.68rem', lineHeight: 1.35 }}>{insight.evidence}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Chatbot Questions">
            {data.analytics.status !== 'ready' ? (
              <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>{data.analytics.message}</p>
            ) : chat.recent.length === 0 ? (
              <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>No chatbot questions recorded in this range yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {chat.topTopics.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {chat.topTopics.map((topic) => (
                      <span key={topic.topic} style={{ border: '1px solid #333', borderRadius: '999px', color: '#ccc', fontSize: '0.68rem', padding: '0.18rem 0.45rem' }}>
                        {labelise(topic.topic)} · {topic.count}
                      </span>
                    ))}
                  </div>
                )}
                {chat.recent.map((item) => (
                  <div key={`${item.timestamp}-${item.question}`} style={{ borderBottom: '1px solid #252525', paddingBottom: '0.55rem', display: 'grid', gap: '0.28rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', color: '#777', fontSize: '0.66rem' }}>
                      <span>{labelise(item.topic)}{item.productSlug ? ` · ${item.productSlug}` : ''}</span>
                      <span>{item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-AU') : ''}</span>
                    </div>
                    <div style={{ color: '#fff', fontSize: '0.78rem', lineHeight: 1.35 }}>{item.question}</div>
                    <div style={{ color: '#999', fontSize: '0.72rem', lineHeight: 1.35 }}>{item.answer}</div>
                  </div>
                ))}
              </div>
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
