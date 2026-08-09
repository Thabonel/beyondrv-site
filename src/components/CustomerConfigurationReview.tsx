import React, { useEffect, useMemo, useState } from 'react';
import ConfiguratorGlbViewer from './ConfiguratorGlbViewer';
import type { ConfiguratorVisualAsset } from '../lib/configurator/types';

interface ReviewPayload {
  configuration: {
    configurationNumber: string; revision: number; customer: { name: string; email: string }; customerNotes: string;
    customItems: Array<{ id: string; description: string; retailPriceCents: number; visualBrief: string; drawingStatus: string }>;
    drawings: Array<{ id: string; customItemId: string; version: number; filename: string; contentType: string; notes: string; url: string }>;
    customerReview: { status: string; expiresAt: string; decidedAt: string; decisionNotes: string };
  };
  model: null | { name: string; description: string; heroImage?: string; visualAsset?: ConfiguratorVisualAsset; orderProcess: { customerSummary: string } };
  selections: Array<{ optionId: string; name: string; shortDescription: string; quantity: number; retailTotalCents: number }>;
  pricing: { basePriceCents: number; optionsTotalCents: number; customItemsTotalCents: number; configuredTotalCents: number };
  warnings: Array<{ message: string }>;
}

const money = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(cents / 100);
const field = { width: '100%', background: '#fff', border: '1px solid #bbb', borderRadius: 8, padding: '0.72rem', color: '#111', fontSize: '0.9rem' } as const;

export default function CustomerConfigurationReview() {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);

  useEffect(() => {
    if (!token) { setError('This review link is incomplete. Ask Beyond RV for a new link.'); return; }
    fetch(`/.netlify/functions/configuration-review?token=${encodeURIComponent(token)}`, { cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(async response => {
        const data = await response.json() as ReviewPayload & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Review could not be loaded.');
        setPayload(data); setName(data.configuration.customer.name || ''); setEmail(data.configuration.customer.email || '');
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Review could not be loaded.'));
  }, [token]);

  async function decide(action: 'approve' | 'request_changes') {
    setBusy(true); setError('');
    try {
      const response = await fetch('/.netlify/functions/configuration-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, referrerPolicy: 'no-referrer', body: JSON.stringify({ token, action, name, email, notes }) });
      const data = await response.json() as { error?: string; customerReview?: ReviewPayload['configuration']['customerReview'] };
      if (!response.ok || !data.customerReview) throw new Error(data.error || 'Decision could not be recorded.');
      setPayload(current => current ? { ...current, configuration: { ...current.configuration, customerReview: data.customerReview! } } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Decision could not be recorded.'); }
    finally { setBusy(false); }
  }

  if (error && !payload) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f1eb' }}><div style={{ maxWidth: 560, background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 12px 40px #0002' }}><h1 style={{ margin: 0, fontSize: '1.5rem' }}>Configuration review unavailable</h1><p style={{ lineHeight: 1.6 }}>{error}</p><p>Call Beyond RV on 0430 863 819 or reply to the email that contained this link.</p></div></main>;
  if (!payload) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#fff' }}>Loading your Beyond RV configuration…</main>;
  const approvedGlb = payload.configuration.drawings.find(drawing => drawing.contentType === 'model/gltf-binary' || drawing.filename.endsWith('.glb'));
  const visual = payload.model?.visualAsset;
  const glbUrl = approvedGlb?.url || (visual?.status === 'ready' ? visual.glbUrl : '');
  const decided = ['approved', 'changes_requested'].includes(payload.configuration.customerReview.status);

  return <main style={{ minHeight: '100vh', background: '#f4f1eb', color: '#171717', padding: 'clamp(16px,4vw,48px)' }}>
    <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', borderBottom: '3px solid #E8540A', paddingBottom: 18 }}><div><div style={{ color: '#E8540A', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: '0.75rem' }}>Beyond RV Campers</div><h1 style={{ margin: '0.4rem 0', fontSize: 'clamp(1.7rem,4vw,2.8rem)' }}>Your camper configuration</h1><div style={{ color: '#666' }}>{payload.configuration.configurationNumber} · Revision {payload.configuration.revision}</div></div><div style={{ textAlign: 'right' }}><strong>{payload.configuration.customer.name}</strong><div style={{ color: '#666', marginTop: 6 }}>Review expires {new Date(payload.configuration.customerReview.expiresAt).toLocaleDateString('en-AU')}</div></div></header>
      {glbUrl ? <section style={{ minHeight: 430, borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 35px #0002' }}><ConfiguratorGlbViewer src={glbUrl} poster={visual?.posterUrl || payload.model?.heroImage} alt={`${payload.model?.name || 'Camper'} interactive 3D review`} selectedOptionIds={payload.selections.map(item => item.optionId)} bindings={visual?.bindings || []} hotspots={visual?.hotspots || []}/></section> : payload.model?.heroImage ? <img src={payload.model.heroImage} alt={payload.model.name} style={{ width: '100%', maxHeight: 520, objectFit: 'cover', borderRadius: 14 }}/> : null}
      <section style={{ background: '#fff', borderRadius: 14, padding: 'clamp(18px,3vw,30px)', boxShadow: '0 8px 28px #0001' }}><h2 style={{ marginTop: 0 }}>{payload.model?.name}</h2><p style={{ color: '#555', lineHeight: 1.6 }}>{payload.configuration.customerNotes || payload.model?.description}</p><div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 9, padding: 14, lineHeight: 1.55 }}>{payload.model?.orderProcess.customerSummary}</div>
        <h3>Configured selections</h3>{payload.selections.length ? payload.selections.map(item => <div key={item.optionId} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '0.7rem 0', borderBottom: '1px solid #eee' }}><div><strong>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</strong><div style={{ color: '#777', fontSize: '0.85rem', marginTop: 3 }}>{item.shortDescription}</div></div><span>{money(item.retailTotalCents)}</span></div>) : <p>No paid options selected.</p>}
        {payload.configuration.customItems.length > 0 && <><h3>Custom alterations</h3>{payload.configuration.customItems.map(item => <div key={item.id} style={{ padding: '0.7rem 0', borderBottom: '1px solid #eee' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{item.description}</strong><span>{money(item.retailPriceCents)}</span></div><p style={{ color: '#666', margin: '0.35rem 0' }}>{item.visualBrief}</p>{payload.configuration.drawings.filter(drawing => drawing.customItemId === item.id).map(drawing => <a key={drawing.id} href={drawing.url} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" style={{ color: '#b54108', fontWeight: 750 }}>Open approved drawing V{drawing.version} →</a>)}</div>)}</>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 18, borderTop: '2px solid #222', fontWeight: 900, fontSize: '1.3rem' }}><span>Configured total</span><span>{money(payload.pricing.configuredTotalCents)}</span></div>
      </section>
      <section style={{ background: '#fff', borderRadius: 14, padding: 'clamp(18px,3vw,30px)', boxShadow: '0 8px 28px #0001' }}><h2 style={{ marginTop: 0 }}>Your decision</h2>{decided ? <div style={{ padding: 16, borderRadius: 9, background: payload.configuration.customerReview.status === 'approved' ? '#dcfce7' : '#fee2e2', color: '#222' }}><strong>{payload.configuration.customerReview.status === 'approved' ? 'Configuration approved' : 'Changes requested'}</strong><p style={{ marginBottom: 0 }}>Your decision has been recorded. Beyond RV will contact you about the next step.</p></div> : <div style={{ display: 'grid', gap: 10 }}><p style={{ color: '#555', lineHeight: 1.55 }}>Check the model, selections, pricing and every custom alteration drawing. Approval records your acceptance of this configuration; it is not itself the final sale contract.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}><input value={name} onChange={event => setName(event.target.value)} placeholder="Your full name" style={field}/><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Your email" style={field}/></div><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} placeholder="Approval note, or describe required changes" style={{ ...field, resize: 'vertical' }}/>{error && <div style={{ color: '#b91c1c' }}>{error}</div>}<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" disabled={busy} onClick={() => void decide('approve')} style={{ border: 0, borderRadius: 8, background: '#166534', color: '#fff', padding: '0.8rem 1.1rem', fontWeight: 850, cursor: 'pointer' }}>Approve configuration</button><button type="button" disabled={busy} onClick={() => void decide('request_changes')} style={{ border: '1px solid #b91c1c', borderRadius: 8, background: '#fff', color: '#991b1b', padding: '0.8rem 1.1rem', fontWeight: 850, cursor: 'pointer' }}>Request changes</button></div></div>}</section>
      <footer style={{ color: '#666', fontSize: '0.78rem', lineHeight: 1.5 }}>Beyond RV Campers · 77 Coleyville Rd, Mutdapilly QLD 4307 · 0430 863 819<br/>This private link contains customer-specific commercial information. Please do not forward it.</footer>
    </div>
  </main>;
}
