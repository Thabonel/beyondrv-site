import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { adminFetch, adminJson, clearAdminToken } from '../lib/adminApi';
import type { AdminSessionActor } from './AdminApp';

const ContractManager = lazy(() => import('./ContractManager'));

type WorkspaceArea = 'today' | 'customers' | 'agreements' | 'builds';

interface WorkspaceAction {
  id: string;
  type: 'enquiry' | 'agreement' | 'build';
  recordId: string;
  title: string;
  customerName: string;
  phone: string;
  productName: string;
  reason: string;
  dueDate: string;
  daysStale: number;
  estimatedValueCents: number;
  agreementId: string;
  canCreateAgreement: boolean;
}

interface WorkspaceCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  productInterest: string;
  sourceEnquiryId: string;
  agreementIds: string[];
  buildIds: string[];
  lastActivityAt: string;
  stage: 'enquiry' | 'agreement' | 'build';
}

interface WorkspaceAgreement {
  id: string;
  contractNumber: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  status: string;
  acceptanceStatus: string;
  totalCents: number;
  updatedAt: string;
}

interface WorkspaceBuild {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  status: string;
  depositVerified: boolean;
  amountPaidCents: number;
  nextActionDate: string;
  expectedArrivalDate: string;
  expectedHandoverDate: string;
  updatedAt: string;
}

interface WorkspaceData {
  generatedAt: string;
  summary: { peopleWaiting: number; pipelineValueCents: number; agreementsToFinish: number; activeBuilds: number };
  actions: WorkspaceAction[];
  customers: WorkspaceCustomer[];
  agreements: WorkspaceAgreement[];
  builds: WorkspaceBuild[];
  products: Array<{ slug: string; title: string; category?: string; price: string | number }>;
  leads: Array<{ id: string; customerId?: string; productInterest?: string }>;
}

const areaLabels: Record<WorkspaceArea, string> = {
  today: 'Today',
  customers: 'Customers',
  agreements: 'Agreements',
  builds: 'Builds',
};

function money(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: 0,
  }).format(Math.max(0, cents) / 100);
}

function displayStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function dateLabel(value: string) {
  if (!value) return 'Not scheduled';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initialArea(): WorkspaceArea {
  if (typeof window === 'undefined') return 'today';
  const candidate = new URLSearchParams(window.location.search).get('area');
  return ['today', 'customers', 'agreements', 'builds'].includes(candidate || '') ? candidate as WorkspaceArea : 'today';
}

export default function GmSalesWorkspace({ actor }: { actor: AdminSessionActor }) {
  const [area, setArea] = useState<WorkspaceArea>(initialArea);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAgreementId, setSelectedAgreementId] = useState('');
  const [convertingEnquiryId, setConvertingEnquiryId] = useState('');
  const [conversionError, setConversionError] = useState('');
  const [recordingOutcomeId, setRecordingOutcomeId] = useState('');

  async function loadWorkspace() {
    setLoading(true);
    setError('');
    try {
      const response = await adminFetch('/.netlify/functions/admin-sales-workspace', { cache: 'no-store' });
      if (response.status === 401) {
        clearAdminToken();
        window.location.href = '/.netlify/functions/admin-login';
        return;
      }
      const body = await adminJson<{ workspace?: WorkspaceData }>(response, 'Could not load the sales workspace');
      if (!response.ok || !body.workspace) throw new Error(body.error || 'Could not load the sales workspace.');
      setWorkspace(body.workspace);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the sales workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadWorkspace(); }, []);

  function selectArea(nextArea: WorkspaceArea) {
    setArea(nextArea);
    setSearch('');
    const url = new URL(window.location.href);
    url.searchParams.set('area', nextArea);
    window.history.replaceState({}, '', url);
  }

  function openAction(action: WorkspaceAction) {
    if (action.type === 'agreement') {
      setSelectedAgreementId(action.recordId);
      selectArea('agreements');
      return;
    }
    if (action.type === 'build') {
      selectArea('builds');
      return;
    }
    selectArea('customers');
    setSearch(action.customerName);
  }

  function openAgreement(agreementId: string) {
    setSelectedAgreementId(agreementId);
    selectArea('agreements');
  }

  async function createOrOpenAgreement(enquiryId: string) {
    if (!enquiryId || convertingEnquiryId) return;
    setConvertingEnquiryId(enquiryId);
    setConversionError('');
    try {
      const response = await adminFetch('/.netlify/functions/admin-enquiry-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId }),
      });
      if (response.status === 401) {
        clearAdminToken();
        window.location.href = '/.netlify/functions/admin-login';
        return;
      }
      const body = await adminJson<{ contract?: { id?: string } }>(response, 'Could not create the agreement');
      if (!response.ok || !body.contract?.id) throw new Error(body.error || 'Could not create the agreement.');
      await loadWorkspace();
      openAgreement(body.contract.id);
    } catch (reason) {
      setConversionError(reason instanceof Error ? reason.message : 'Could not create the agreement.');
    } finally {
      setConvertingEnquiryId('');
    }
  }

  async function recordOutcome(action: WorkspaceAction, outcome: 'no_answer' | 'follow_up' | 'not_proceeding' | 'visit_booked' | 'agreement_in_progress') {
    if (recordingOutcomeId || action.type !== 'enquiry') return;
    let followUpAt = '';
    let lossReason = '';
    if (outcome === 'follow_up' || outcome === 'visit_booked') {
      followUpAt = window.prompt(outcome === 'visit_booked' ? 'Visit date (YYYY-MM-DD)' : 'Follow-up date (YYYY-MM-DD)')?.trim() || '';
      if (!followUpAt) return;
    }
    if (outcome === 'not_proceeding') {
      lossReason = window.prompt('Reason: price, timing, product fit, or other')?.trim() || '';
      if (!lossReason) return;
    }
    setRecordingOutcomeId(action.id);
    setConversionError('');
    try {
      const response = await adminFetch('/.netlify/functions/admin-sales-outcome', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId: action.recordId, outcome, followUpAt, lossReason, idempotencyKey: `${action.recordId}:${outcome}:${crypto.randomUUID()}` }),
      });
      const body = await adminJson<{ summary?: string }>(response, 'Could not record the sales outcome');
      if (!response.ok) throw new Error(body.error || 'Could not record the sales outcome.');
      await loadWorkspace();
    } catch (reason) {
      setConversionError(reason instanceof Error ? reason.message : 'Could not record the sales outcome.');
    } finally { setRecordingOutcomeId(''); }
  }

  async function logout() {
    await adminFetch('/.netlify/functions/admin-logout', { method: 'POST' });
    clearAdminToken();
    window.location.href = '/.netlify/functions/admin-login';
  }

  const customerResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!workspace || !query) return workspace?.customers ?? [];
    return workspace.customers.filter(customer => [customer.name, customer.email, customer.phone, customer.productInterest]
      .some(value => value.toLowerCase().includes(query)));
  }, [search, workspace]);

  const contractCustomers = (workspace?.customers ?? []).map(customer => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
  }));
  const contractLeads = (workspace?.leads ?? []).map(lead => ({
    ...lead,
    customerId: workspace?.customers.find(customer => customer.sourceEnquiryId === lead.id)?.id,
  }));

  return (
    <div className="gm-workspace" data-testid="gm-sales-workspace">
      <style>{`
        .gm-workspace { min-height: calc(100vh - 60px); background:#0a0a0a; color:#fff; padding-bottom:80px; overflow-x:hidden; }
        .gm-shell { width:min(100%,1120px); margin:0 auto; padding:18px 18px 36px; }
        .gm-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
        .gm-eyebrow { color:#fb923c; font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .gm-heading h1 { font-size:clamp(24px,4vw,36px); margin:3px 0 0; line-height:1.08; }
        .gm-user { display:flex; align-items:center; gap:10px; color:#aaa; font-size:13px; }
        .gm-button, .gm-call { min-height:48px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px; padding:10px 15px; font:inherit; font-weight:800; text-decoration:none; cursor:pointer; }
        .gm-button { color:#fff; background:#222; border:1px solid #444; }
        .gm-button--primary, .gm-call { background:#e8540a; border:1px solid #e8540a; color:#fff; }
        .gm-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:18px; }
        .gm-tab { min-height:52px; border:1px solid #333; border-radius:12px; background:#141414; color:#aaa; font:inherit; font-weight:800; cursor:pointer; }
        .gm-tab[aria-selected="true"] { background:#fff; color:#111; border-color:#fff; }
        .gm-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
        .gm-summary-card { border:1px solid #303030; border-radius:14px; padding:14px; background:#121212; min-height:96px; min-width:0; }
        .gm-summary-card strong { display:block; font-size:24px; margin-top:8px; overflow-wrap:anywhere; }
        .gm-muted { color:#929292; font-size:13px; line-height:1.45; }
        .gm-section-title { display:flex; justify-content:space-between; align-items:end; gap:12px; margin:18px 0 10px; }
        .gm-section-title h2 { margin:0; font-size:20px; }
        .gm-list { display:grid; gap:10px; }
        .gm-action { border:1px solid #343434; border-radius:16px; background:#131313; padding:16px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:center; }
        .gm-action h3 { margin:0 0 5px; font-size:17px; }
        .gm-action-meta { display:flex; gap:8px 14px; flex-wrap:wrap; color:#aaa; font-size:13px; margin-top:7px; }
        .gm-value { color:#fff; font-weight:900; font-size:18px; }
        .gm-actions { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; margin-top:10px; }
        .gm-chip { display:inline-flex; align-items:center; border:1px solid #444; border-radius:999px; padding:4px 8px; color:#bbb; font-size:11px; font-weight:800; text-transform:uppercase; }
        .gm-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .gm-card { border:1px solid #333; border-radius:14px; background:#131313; padding:15px; min-width:0; }
        .gm-card h3 { margin:0 0 5px; font-size:17px; }
        .gm-search { width:100%; min-height:50px; border:1px solid #444; border-radius:12px; background:#151515; color:#fff; padding:12px 14px; font:inherit; font-size:16px; margin-bottom:12px; }
        .gm-empty { padding:32px 18px; border:1px dashed #3a3a3a; border-radius:14px; text-align:center; color:#aaa; }
        .gm-bottom-nav { display:none; }
        @media (max-width:700px) {
          .gm-workspace { min-height:calc(100vh - 57px); }
          .gm-shell { padding:14px 12px 28px; }
          .gm-heading { align-items:flex-start; }
          .gm-user span { display:none; }
          .gm-tabs { display:none; }
          .gm-summary { grid-template-columns:1fr 1fr; }
          .gm-summary-card { min-height:88px; padding:12px; }
          .gm-summary-card strong { font-size:21px; }
          .gm-action { grid-template-columns:1fr; padding:14px; }
          .gm-actions { justify-content:stretch; }
          .gm-actions > * { flex:1; }
          .gm-card-grid { grid-template-columns:1fr; }
          .gm-bottom-nav { position:fixed; z-index:1000; left:0; right:0; bottom:0; width:100vw; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); background:rgba(14,14,14,.97); border-top:1px solid #333; padding:max(7px,env(safe-area-inset-bottom)) 6px 7px; backdrop-filter:blur(14px); }
          .gm-bottom-nav button { position:relative; z-index:1; min-width:0; min-height:52px; padding:4px 2px; background:transparent; border:0; color:#888; font:inherit; font-size:11px; font-weight:800; border-radius:10px; overflow:hidden; }
          .gm-bottom-nav button[aria-selected="true"] { color:#fff; background:#262626; }
        }
      `}</style>
      <div className="gm-shell">
        <div className="gm-heading">
          <div><div className="gm-eyebrow">Sales workspace</div><h1>{areaLabels[area]}</h1></div>
          <div className="gm-user"><span>{actor.displayName}</span><button type="button" className="gm-button gm-button--primary" onClick={() => { setSelectedAgreementId(''); selectArea('agreements'); }}>Create agreement</button><button type="button" className="gm-button" onClick={() => void logout()}>Sign out</button></div>
        </div>
        <nav className="gm-tabs" aria-label="Sales workspace">
          {(Object.keys(areaLabels) as WorkspaceArea[]).map(item => <button key={item} className="gm-tab" aria-selected={area === item} onClick={() => selectArea(item)}>{areaLabels[item]}</button>)}
        </nav>

        {loading && <div className="gm-empty">Loading the latest customers and sales work…</div>}
        {error && <div className="gm-empty"><div>{error}</div><button className="gm-button" type="button" onClick={() => void loadWorkspace()} style={{ marginTop: 12 }}>Try again</button></div>}
        {conversionError && <div role="alert" className="gm-empty" style={{ borderColor: '#9a3412', color: '#fdba74', marginBottom: 12 }}>{conversionError}</div>}

        {!loading && !error && workspace && area === 'today' && <>
          <section className="gm-summary" aria-label="Today summary">
            <div className="gm-summary-card"><span className="gm-muted">People waiting</span><strong>{workspace.summary.peopleWaiting}</strong></div>
            <div className="gm-summary-card"><span className="gm-muted">Pipeline in play</span><strong>{money(workspace.summary.pipelineValueCents)}</strong></div>
            <div className="gm-summary-card"><span className="gm-muted">Agreements to finish</span><strong>{workspace.summary.agreementsToFinish}</strong></div>
            <div className="gm-summary-card"><span className="gm-muted">Active builds</span><strong>{workspace.summary.activeBuilds}</strong></div>
          </section>
          <div className="gm-section-title"><div><h2>Best next actions</h2><div className="gm-muted">Commercially ready work first, then highest estimated value.</div></div><button type="button" className="gm-button" onClick={() => void loadWorkspace()}>Refresh</button></div>
          <div className="gm-list">
            {workspace.actions.length === 0 && <div className="gm-empty">Nothing is waiting for action right now.</div>}
            {workspace.actions.map(action => <article className="gm-action" data-testid={`gm-action-${action.id}`} key={action.id}>
              <div>
                <span className="gm-chip">{action.type}</span>
                <h3>{action.title}</h3>
                <div style={{ fontWeight: 800 }}>{action.customerName} · {action.productName}</div>
                <div className="gm-muted" style={{ marginTop: 5 }}>{action.reason}</div>
                <div className="gm-action-meta"><span>{action.daysStale} day{action.daysStale === 1 ? '' : 's'} since update</span>{action.dueDate && <span>Due {dateLabel(action.dueDate)}</span>}</div>
              </div>
              <div>
                <div className="gm-value">{action.estimatedValueCents ? money(action.estimatedValueCents) : 'Value to confirm'}</div>
                <div className="gm-actions">
                  {action.phone && <a className="gm-call" href={`tel:${action.phone}`}>Call</a>}
                  {action.type === 'enquiry' && <>
                    <button type="button" className="gm-button" disabled={Boolean(recordingOutcomeId)} onClick={() => void recordOutcome(action, 'no_answer')}>{recordingOutcomeId === action.id ? 'Saving…' : 'No answer'}</button>
                    <button type="button" className="gm-button" disabled={Boolean(recordingOutcomeId)} onClick={() => void recordOutcome(action, 'follow_up')}>Follow up</button>
                    <button type="button" className="gm-button" disabled={Boolean(recordingOutcomeId)} onClick={() => void recordOutcome(action, 'visit_booked')}>Visit booked</button>
                    <button type="button" className="gm-button" disabled={Boolean(recordingOutcomeId)} onClick={() => void recordOutcome(action, 'not_proceeding')}>Not proceeding</button>
                  </>}
                  {action.canCreateAgreement
                    ? <button type="button" className="gm-button gm-button--primary" disabled={Boolean(convertingEnquiryId)} onClick={() => void createOrOpenAgreement(action.recordId)}>{convertingEnquiryId === action.recordId ? 'Creating…' : 'Create agreement'}</button>
                    : <button type="button" className="gm-button" onClick={() => openAction(action)}>{action.type === 'agreement' ? 'Open agreement' : action.type === 'build' ? 'Open build' : 'Customer'}</button>}
                </div>
              </div>
            </article>)}
          </div>
        </>}

        {!loading && !error && workspace && area === 'customers' && <>
          <input className="gm-search" aria-label="Search customers" placeholder="Search name, phone, email, or product" value={search} onChange={event => setSearch(event.target.value)} />
          <div className="gm-card-grid">
            {customerResults.map(customer => <article className="gm-card" key={customer.id}>
              <span className="gm-chip">{customer.stage}</span><h3>{customer.name}</h3>
              <div className="gm-muted">{customer.productInterest || 'Product to confirm'}</div>
              <div className="gm-muted" style={{ marginTop: 8 }}>{customer.phone || 'No phone recorded'}{customer.email && <><br />{customer.email}</>}</div>
              <div className="gm-actions">
                {customer.phone && <a className="gm-call" href={`tel:${customer.phone}`}>Call</a>}
                {customer.agreementIds[0]
                  ? <button type="button" className="gm-button" onClick={() => openAgreement(customer.agreementIds[0])}>Open agreement</button>
                  : customer.sourceEnquiryId && <button type="button" className="gm-button gm-button--primary" disabled={Boolean(convertingEnquiryId)} onClick={() => void createOrOpenAgreement(customer.sourceEnquiryId)}>{convertingEnquiryId === customer.sourceEnquiryId ? 'Creating…' : 'Create agreement'}</button>}
                {customer.email && <a className="gm-button" href={`mailto:${customer.email}`}>Email</a>}
              </div>
            </article>)}
            {customerResults.length === 0 && <div className="gm-empty">No customers match that search.</div>}
          </div>
        </>}

        {!loading && !error && workspace && area === 'agreements' && <div style={{ border: '1px solid #303030', borderRadius: 14, overflow: 'hidden', background: '#111' }}>
          <Suspense fallback={<div className="gm-empty">Opening agreements…</div>}><ContractManager key={selectedAgreementId || 'agreements'} initialContractId={selectedAgreementId} products={workspace.products} customers={contractCustomers} leads={contractLeads} /></Suspense>
        </div>}

        {!loading && !error && workspace && area === 'builds' && <div className="gm-card-grid">
          {workspace.builds.map(build => <article className="gm-card" key={build.id} data-testid={`gm-build-${build.id}`}>
            <span className="gm-chip">{displayStatus(build.status)}</span><h3>{build.customerName}</h3>
            <div style={{ fontWeight: 800 }}>{build.productName}</div>
            <div className="gm-muted" style={{ marginTop: 8 }}>Deposit: {build.depositVerified ? 'verified' : 'not verified'}<br />Next action: {dateLabel(build.nextActionDate)}<br />Expected arrival: {dateLabel(build.expectedArrivalDate)}<br />Expected handover: {dateLabel(build.expectedHandoverDate)}</div>
            <div className="gm-actions">{build.customerPhone && <a className="gm-call" href={`tel:${build.customerPhone}`}>Call customer</a>}</div>
          </article>)}
          {workspace.builds.length === 0 && <div className="gm-empty">No active builds are recorded.</div>}
        </div>}
      </div>
      <nav className="gm-bottom-nav" aria-label="Sales workspace mobile">
        {(Object.keys(areaLabels) as WorkspaceArea[]).map(item => <button key={item} aria-selected={area === item} onClick={() => selectArea(item)}>{areaLabels[item]}</button>)}
      </nav>
    </div>
  );
}
