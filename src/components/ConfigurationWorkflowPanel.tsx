import React, { useState } from 'react';
import { adminFetch, adminJson } from '../lib/adminApi';
import type { ConfigurationDrawingVersion, ConfigurationProductionStatus, ConfigurationRecord, ConfigurableModel } from '../lib/configurator/types';

const field = { width: '100%', minWidth: 0, background: '#171717', border: '1px solid #444', color: '#fff', borderRadius: 7, padding: '0.52rem', fontSize: '0.74rem' } as const;
const button = { background: '#222', border: '1px solid #444', color: '#fff', borderRadius: 7, padding: '0.48rem 0.68rem', cursor: 'pointer', fontWeight: 750, fontSize: '0.72rem' } as const;
const productionStatuses: ConfigurationProductionStatus[] = ['deposit_received', 'ordered_from_factory', 'in_china_production', 'awaiting_shipping', 'in_transit', 'arrived_mutdapilly', 'local_fitout', 'ready_for_handover', 'delivered', 'cancelled'];
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ConfigurationWorkflowPanel({ configuration, model, onConfiguration }: { configuration: ConfigurationRecord; model: ConfigurableModel | null; onConfiguration: (configuration: ConfigurationRecord) => void }) {
  const customItems = configuration.customItems.filter(item => item.kind === 'custom');
  const [customItemId, setCustomItemId] = useState(customItems[0]?.id || '');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [drawingNotes, setDrawingNotes] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [depositReference, setDepositReference] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [productionStatus, setProductionStatus] = useState<ConfigurationProductionStatus>(configuration.production.status === 'not_released' ? 'deposit_received' : configuration.production.status);
  const [productionNote, setProductionNote] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await adminFetch(path, { method: payload._method === 'PATCH' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== '_method'))) });
      const data = await adminJson<{ configuration?: ConfigurationRecord; reviewUrl?: string; error?: string }>(response, 'Workflow action failed.');
      if (!response.ok) throw new Error(data.error || 'Workflow action failed.');
      if (data.configuration) onConfiguration(data.configuration);
      if (data.reviewUrl) setReviewUrl(data.reviewUrl);
      return data;
    } finally { setBusy(false); }
  }

  async function uploadDrawing() {
    if (!customItemId) return setStatus('Choose a custom alteration.');
    if (!file && !externalUrl) return setStatus('Choose a file or enter an HTTPS link.');
    setStatus('Adding drawing version…');
    try {
      const data = file ? await fileAsBase64(file) : '';
      await request('/.netlify/functions/admin-configuration-drawings', { id: configuration.id, customItemId, filename: file?.name || 'linked-drawing', contentType: file?.type || (file?.name.endsWith('.glb') ? 'model/gltf-binary' : ''), data, externalUrl, notes: drawingNotes });
      setFile(null); setExternalUrl(''); setDrawingNotes(''); setStatus('Drawing version added.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not add drawing.'); }
  }
  async function reviewDrawing(drawing: ConfigurationDrawingVersion, drawingStatus: 'in_review' | 'changes_requested' | 'approved') {
    setStatus('Updating drawing review…');
    try { await request('/.netlify/functions/admin-configuration-drawings', { _method: 'PATCH', id: configuration.id, drawingId: drawing.id, status: drawingStatus }); setStatus(`Drawing marked ${label(drawingStatus)}.`); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not review drawing.'); }
  }
  async function createReview() {
    setStatus('Creating secure customer review link…');
    try { await request('/.netlify/functions/admin-configuration-review', { id: configuration.id, action: 'create', origin: window.location.origin }); setStatus('Secure 14-day review link created. Copy it below.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not create review link.'); }
  }
  async function revokeReview() {
    try { await request('/.netlify/functions/admin-configuration-review', { id: configuration.id, action: 'revoke' }); setReviewUrl(''); setStatus('Review link revoked.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not revoke review link.'); }
  }
  async function releaseProduction() {
    setStatus('Checking release gates…');
    try { await request('/.netlify/functions/admin-configuration-production', { id: configuration.id, action: 'release', depositReference, depositReceivedAt: depositDate, productTitle: model?.name, productSlug: model?.productSlug, productCategory: model?.productCategory }); setStatus('Production order created at Deposit Received.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not release production.'); }
  }
  async function updateProduction() {
    try { await request('/.netlify/functions/admin-configuration-production', { id: configuration.id, action: 'update_status', status: productionStatus, note: productionNote }); setProductionNote(''); setStatus('Production status updated.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not update production.'); }
  }

  return <section style={{ background: '#111', border: '1px solid #303030', borderRadius: 9, padding: '0.8rem', display: 'grid', gap: 10 }}>
    <strong style={{ color: '#fff', fontSize: '0.82rem' }}>Drawing, customer approval and production</strong>
    {!configuration.id && <div style={{ color: '#fdba74', fontSize: '0.72rem' }}>Save the draft before uploading drawings or creating review links.</div>}
    <div style={{ borderTop: '1px solid #292929', paddingTop: 10, display: 'grid', gap: 7 }}>
      <strong style={{ color: '#ddd', fontSize: '0.74rem' }}>Drawing register</strong>
      {!customItems.length ? <div style={{ color: '#777', fontSize: '0.71rem' }}>Add and save a custom alteration to start its drawing register.</div> : <>
        <select value={customItemId} onChange={event => setCustomItemId(event.target.value)} style={field}>{customItems.map(item => <option key={item.id} value={item.id}>{item.description || 'Unnamed alteration'}</option>)}</select>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1fr) minmax(170px,1fr)', gap: 7 }}><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.glb,application/pdf,image/*,model/gltf-binary" onChange={event => setFile(event.target.files?.[0] || null)} style={field}/><input value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="or HTTPS drawing link" style={field}/></div>
        <input value={drawingNotes} onChange={event => setDrawingNotes(event.target.value)} placeholder="Version notes" style={field}/>
        <button type="button" disabled={busy || !configuration.id} onClick={() => void uploadDrawing()} style={button}>Add Drawing Version</button>
      </>}
      {configuration.drawings.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map(drawing => <div key={drawing.id} style={{ background: '#171717', border: '1px solid #333', borderRadius: 7, padding: 8, display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#ddd', fontSize: '0.7rem' }}><span>V{drawing.version} · {drawing.filename}</span><span style={{ color: drawing.status === 'approved' ? '#86efac' : drawing.status === 'changes_requested' ? '#fca5a5' : '#fdba74' }}>{label(drawing.status)}</span></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><a href={`/.netlify/functions/configuration-drawing-file?id=${encodeURIComponent(configuration.id)}&drawingId=${encodeURIComponent(drawing.id)}`} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: 'none' }}>Open</a><button type="button" onClick={() => void reviewDrawing(drawing, 'in_review')} style={button}>In review</button><button type="button" onClick={() => void reviewDrawing(drawing, 'changes_requested')} style={button}>Request changes</button><button type="button" onClick={() => void reviewDrawing(drawing, 'approved')} style={{ ...button, background: '#166534', borderColor: '#15803d' }}>Approve version</button></div>
      </div>)}
    </div>
    <div style={{ borderTop: '1px solid #292929', paddingTop: 10, display: 'grid', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ color: '#ddd', fontSize: '0.74rem' }}>Secure customer review</strong><span style={{ color: configuration.customerReview.status === 'approved' ? '#86efac' : '#fdba74', fontSize: '0.68rem' }}>{label(configuration.customerReview.status)}</span></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" disabled={busy || !configuration.id || !['draft', 'ready_for_review'].includes(configuration.status)} onClick={() => void createReview()} style={button}>Create 14-day review link</button>{configuration.customerReview.tokenHint && <button type="button" onClick={() => void revokeReview()} style={button}>Revoke current link</button>}</div>
      {reviewUrl && <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}><input readOnly value={reviewUrl} style={field}/><button type="button" onClick={() => void navigator.clipboard.writeText(reviewUrl)} style={button}>Copy</button></div>}
      {configuration.customerReview.decidedAt && <div style={{ color: '#888', fontSize: '0.69rem' }}>Decision by {configuration.customerReview.decidedByName} on {new Date(configuration.customerReview.decidedAt).toLocaleString()}{configuration.customerReview.decisionNotes ? ` — ${configuration.customerReview.decisionNotes}` : ''}</div>}
    </div>
    <div style={{ borderTop: '1px solid #292929', paddingTop: 10, display: 'grid', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: '#ddd', fontSize: '0.74rem' }}>Production tracker</strong><span style={{ color: '#93c5fd', fontSize: '0.68rem' }}>{label(configuration.production.status)}</span></div>
      {!configuration.production.orderId ? <><div style={{ color: '#888', fontSize: '0.69rem' }}>Release requires customer approval, internal approval, a verified contract and deposit evidence.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 6 }}><input value={depositReference} onChange={event => setDepositReference(event.target.value)} placeholder="Deposit receipt/reference" style={field}/><input type="date" value={depositDate} onChange={event => setDepositDate(event.target.value)} style={field}/><button type="button" disabled={busy} onClick={() => void releaseProduction()} style={{ ...button, background: '#1d4ed8', borderColor: '#2563eb' }}>Release</button></div></> : <><div style={{ display: 'grid', gridTemplateColumns: '190px 1fr auto', gap: 6 }}><select value={productionStatus} onChange={event => setProductionStatus(event.target.value as ConfigurationProductionStatus)} style={field}>{productionStatuses.map(item => <option key={item} value={item}>{label(item)}</option>)}</select><input value={productionNote} onChange={event => setProductionNote(event.target.value)} placeholder="Status note" style={field}/><button type="button" disabled={busy} onClick={() => void updateProduction()} style={button}>Update</button></div>{configuration.production.events.slice().reverse().map(event => <div key={event.id} style={{ color: '#888', fontSize: '0.68rem', borderLeft: '2px solid #E8540A', paddingLeft: 8 }}><strong style={{ color: '#ddd' }}>{label(event.status)}</strong> · {new Date(event.occurredAt).toLocaleString()}{event.note ? ` — ${event.note}` : ''}</div>)}</>}
    </div>
    {status && <div style={{ color: /could|failed|choose|required|before/i.test(status) ? '#fb923c' : '#aaa', fontSize: '0.72rem' }}>{status}</div>}
  </section>;
}
