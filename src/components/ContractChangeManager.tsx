import React, { useEffect, useState } from 'react';
import { adminFetch, adminJson } from '../lib/adminApi';

type ContractSummary = {
  id: string;
  contractNumber: string;
  version: number;
  status: string;
  buyer?: { name?: string; email?: string };
  signature?: { documentId?: string };
  acceptance?: { status?: string };
  documentSnapshot?: { sha256?: string };
};

type ChangeRow = {
  id: string;
  action: 'add' | 'remove' | 'replace' | 'clarify';
  category: string;
  item: string;
  previousValue: string;
  revisedValue: string;
  priceDeltaCents: number;
  deliveryImpact: string;
  sourceExcerpt: string;
  ownerConfirmed: boolean;
};

type Addendum = {
  id: string;
  addendumNumber: string;
  status: string;
  sequence: number;
  sourceType: string;
  requestedAt: string;
  requestNote: string;
  changes: ChangeRow[];
  previousTotalCents: number;
  addedCostCents: number;
  removedCostCents: number;
  netChangeCents: number;
  revisedTotalCents: number;
  paymentImpact: string;
  deliveryImpact: string;
  signature?: { documentId?: string; status?: string; editUrl?: string; completedPdfUrl?: string };
  acceptance?: {
    status?: string; method?: string; preparedAt?: string; sentAt?: string; acceptedAt?: string;
    acceptedByName?: string; acceptedByEmail?: string; evidenceReference?: string; evidenceNotes?: string;
  };
  documentSnapshot?: { sha256?: string };
};

type Validation = { valid: boolean; errors: string[]; warnings: string[] };

const inputStyle = { minWidth: 0, width: '100%', background: '#171717', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem' } as const;
const buttonStyle = { background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' } as const;

function money(cents: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function newChange(): ChangeRow {
  return { id: `change_${Date.now()}`, action: 'add', category: '', item: '', previousValue: '', revisedValue: '', priceDeltaCents: 0, deliveryImpact: '', sourceExcerpt: '', ownerConfirmed: false };
}

function emptyAddendum(): Partial<Addendum> & { changes: ChangeRow[] } {
  return {
    sourceType: 'phone', requestedAt: new Date().toISOString().slice(0, 16), requestNote: '', changes: [newChange()],
    paymentImpact: '', deliveryImpact: '', status: 'draft',
  };
}

export default function ContractChangeManager({ contract, onRevisionCreated }: { contract: ContractSummary; onRevisionCreated: (contract: ContractSummary) => void }) {
  const [revisionReason, setRevisionReason] = useState('');
  const [addenda, setAddenda] = useState<Addendum[]>([]);
  const [draft, setDraft] = useState<Partial<Addendum> & { changes: ChangeRow[] }>(() => emptyAddendum());
  const [validation, setValidation] = useState<Validation | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [termsApproved, setTermsApproved] = useState(false);
  const [composeUrl, setComposeUrl] = useState('');
  const [acceptanceForm, setAcceptanceForm] = useState({
    method: 'hand_signed_copy',
    acceptedAt: new Date().toISOString().slice(0,16),
    acceptedByName: '',
    acceptedByEmail: '',
    evidenceReference: '',
    evidenceNotes: '',
  });

  async function loadAddenda() {
    if (contract.status !== 'signed') { setAddenda([]); return; }
    try {
      const res = await adminFetch(`/.netlify/functions/admin-contract-addenda?contractId=${encodeURIComponent(contract.id)}`, { cache: 'no-store' });
      const data = await adminJson<{ addenda?: Addendum[] }>(res, 'Could not load addenda.');
      if (!res.ok) throw new Error(data.error || 'Could not load addenda.');
      setAddenda(data.addenda || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load addenda.'); }
  }

  async function loadAcceptanceInfo(addendum: Partial<Addendum>) {
    if (!addendum.id) { setTermsApproved(false); setComposeUrl(''); return; }
    try {
      const res = await adminFetch(`/.netlify/functions/admin-addendum-acceptance?id=${encodeURIComponent(addendum.id)}`, { cache: 'no-store' });
      const data = await adminJson<{ termsApproved?: boolean; composeUrl?: string }>(res, 'Could not load addendum acceptance status.');
      if (res.ok) {
        setTermsApproved(Boolean(data.termsApproved));
        setComposeUrl(data.composeUrl || '');
      }
    } catch {
      setTermsApproved(false);
      setComposeUrl('');
    }
  }

  useEffect(() => {
    setDraft(emptyAddendum());
    setValidation(null);
    setPreviewHtml('');
    setTermsApproved(false);
    setComposeUrl('');
    setAcceptanceForm(current => ({
      ...current,
      acceptedAt: new Date().toISOString().slice(0,16),
      acceptedByName: contract.buyer?.name || '',
      acceptedByEmail: contract.buyer?.email || '',
      evidenceReference: '',
      evidenceNotes: '',
    }));
    void loadAddenda();
  }, [contract.id, contract.status, contract.buyer?.name, contract.buyer?.email]);

  async function createRevision() {
    if (!revisionReason.trim()) { setMessage('Record why this revision is needed.'); return; }
    setBusy(true); setMessage('Creating immutable revision...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-contract-revisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId: contract.id, reason: revisionReason }) });
      const data = await adminJson<{ revision?: ContractSummary }>(res, 'Could not create revision.');
      if (!res.ok || !data.revision) throw new Error(data.error || 'Could not create revision.');
      setRevisionReason(''); setMessage(`Revision ${data.revision.version} created. The earlier version is preserved as superseded.`); onRevisionCreated(data.revision);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create revision.'); }
    finally { setBusy(false); }
  }

  function updateChange(index: number, change: Partial<ChangeRow>) {
    setDraft(current => ({ ...current, changes: current.changes.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row) }));
    setValidation(null); setPreviewHtml('');
  }

  async function addendumAction(action: 'preview' | 'save' | 'ready_for_review' | 'approve') {
    setBusy(true); setMessage(action === 'preview' ? 'Generating addendum preview...' : 'Saving addendum...');
    try {
      const persisted = Boolean(draft.id);
      const res = await adminFetch('/.netlify/functions/admin-contract-addenda', {
        method: persisted && action !== 'preview' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, contractId: contract.id, action }),
      });
      const data = await adminJson<{ addendum?: Addendum; validation?: Validation; html?: string }>(res, 'Could not process addendum.');
      setValidation(data.validation || null);
      if (!res.ok || !data.addendum) throw new Error(data.error || 'Could not process addendum.');
      setDraft(data.addendum); setPreviewHtml(data.html || '');
      if (action !== 'preview') await loadAddenda();
      if (action !== 'preview') await loadAcceptanceInfo(data.addendum);
      setMessage(action === 'approve' ? 'Addendum approved and ready to prepare for customer acceptance.' : action === 'preview' ? 'Preview generated. Check the wording, amounts, payment impact, and delivery impact.' : 'Addendum saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not process addendum.'); }
    finally { setBusy(false); }
  }

  async function acceptanceAction(action: 'prepare' | 'mark_sent' | 'record_acceptance') {
    if (!draft.id) { setMessage('Save and approve the addendum first.'); return; }
    setBusy(true); setMessage(action === 'prepare' ? 'Preparing immutable addendum copy...' : action === 'mark_sent' ? 'Recording addendum delivery...' : 'Recording addendum acceptance...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-addendum-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'record_acceptance' ? { id: draft.id, action, ...acceptanceForm } : { id: draft.id, action }),
      });
      const data = await adminJson<{ addendum?: Addendum; termsApproved?: boolean }>(res, 'Acceptance action failed.');
      if (!res.ok || !data.addendum) throw new Error(data.error || 'Acceptance action failed.');
      setDraft(data.addendum); await loadAddenda();
      if (typeof data.termsApproved === 'boolean') setTermsApproved(data.termsApproved);
      await loadAcceptanceInfo(data.addendum);
      setAcceptanceForm(current => ({
        ...current,
        acceptedByName: current.acceptedByName || data.addendum?.acceptance?.acceptedByName || contract.buyer?.name || '',
        acceptedByEmail: current.acceptedByEmail || data.addendum?.acceptance?.acceptedByEmail || contract.buyer?.email || '',
      }));
      setMessage(action === 'prepare' ? 'Final addendum copy prepared and locked.' : action === 'mark_sent' ? 'Addendum recorded as sent.' : 'Addendum acceptance recorded.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Acceptance action failed.'); }
    finally { setBusy(false); }
  }

  const revisionAllowed = !['signed', 'cancelled', 'superseded', 'sent'].includes(contract.status) && !contract.signature?.documentId && !contract.documentSnapshot?.sha256;
  const addendumLocked = Boolean(draft.documentSnapshot?.sha256) || ['sent', 'signed'].includes(String(draft.status));

  return <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.7rem' }}>
    <strong style={{ color: '#fff' }}>Changes, revisions and addenda</strong>
    {revisionAllowed && <div style={{ display: 'grid', gap: '0.45rem' }}>
      <div style={{ color: '#aaa', fontSize: '0.74rem' }}>Before signing, create a new version instead of overwriting the current agreement.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) auto', gap: '0.45rem' }}><input value={revisionReason} onChange={event => setRevisionReason(event.target.value)} placeholder="Reason for revision" style={inputStyle}/><button type="button" onClick={() => void createRevision()} disabled={busy} style={buttonStyle}>Create Revision</button></div>
    </div>}
    {contract.status === 'sent' || contract.signature?.documentId ? <div style={{ color: '#fb923c', fontSize: '0.74rem' }}>This final version has been sent and is locked. Record acceptance or create a replacement revision through the contract workflow.</div> : null}
    {contract.status !== 'signed' ? <div style={{ color: '#777', fontSize: '0.74rem' }}>Addenda become available after the original contract is accepted. Until then, use a revision.</div> : <>
      <div style={{ display: 'grid', gap: '0.4rem' }}><div style={{ color: '#aaa', fontSize: '0.74rem' }}>Record a customer change from a phone call or manual conversation. Prices are recalculated on the server.</div>
        {addenda.map(addendum => <button key={addendum.id} type="button" onClick={() => {
          setDraft(addendum); setValidation(null); setPreviewHtml('');
          setAcceptanceForm(current => ({
            ...current,
            method: addendum.acceptance?.method || 'hand_signed_copy',
            acceptedAt: addendum.acceptance?.acceptedAt?.slice(0,16) || new Date().toISOString().slice(0,16),
            acceptedByName: addendum.acceptance?.acceptedByName || contract.buyer?.name || '',
            acceptedByEmail: addendum.acceptance?.acceptedByEmail || contract.buyer?.email || '',
            evidenceReference: addendum.acceptance?.evidenceReference || '',
            evidenceNotes: addendum.acceptance?.evidenceNotes || '',
          }));
          void loadAcceptanceInfo(addendum);
        }} style={{ ...buttonStyle, textAlign: 'left' }}><strong>{addendum.addendumNumber}</strong> · {addendum.status === 'signed' ? 'accepted' : addendum.status.replace(/_/g, ' ')} · {money(addendum.netChangeCents)} change · revised total {money(addendum.revisedTotalCents)}</button>)}
        <button type="button" onClick={() => { setDraft(emptyAddendum()); setValidation(null); setPreviewHtml(''); setTermsApproved(false); setComposeUrl(''); }} style={buttonStyle}>New Addendum</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.45rem' }}>
        <select value={draft.sourceType || 'phone'} onChange={event => setDraft(current => ({ ...current, sourceType: event.target.value }))} style={inputStyle}><option value="phone">Phone call</option><option value="in_person">In person</option><option value="owner_manual">Owner entry</option><option value="gmail">Customer email</option></select>
        <input type="datetime-local" value={(draft.requestedAt || '').slice(0,16)} onChange={event => setDraft(current => ({ ...current, requestedAt: event.target.value }))} style={inputStyle}/>
        <textarea value={draft.requestNote || ''} onChange={event => setDraft(current => ({ ...current, requestNote: event.target.value }))} placeholder="What did the customer request?" rows={3} style={{ ...inputStyle, resize: 'vertical', gridColumn: '1 / -1' }}/>
      </div>
      {draft.changes.map((change, index) => <div key={change.id} style={{ border: '1px solid #333', borderRadius: '7px', padding: '0.65rem', display: 'grid', gap: '0.45rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: '0.45rem' }}><select value={change.action} onChange={event => updateChange(index, { action: event.target.value as ChangeRow['action'] })} style={inputStyle}><option value="add">Add</option><option value="remove">Remove</option><option value="replace">Replace</option><option value="clarify">Clarify</option></select><input value={change.category} onChange={event => updateChange(index, { category: event.target.value })} placeholder="Category" style={inputStyle}/><input value={change.item} onChange={event => updateChange(index, { item: event.target.value })} placeholder="Affected item *" style={inputStyle}/></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 150px', gap: '0.45rem' }}><input value={change.previousValue} onChange={event => updateChange(index, { previousValue: event.target.value })} placeholder="Previous value" style={inputStyle}/><input value={change.revisedValue} onChange={event => updateChange(index, { revisedValue: event.target.value })} placeholder="Revised value *" style={inputStyle}/><input value={(Math.abs(change.priceDeltaCents) / 100).toFixed(2)} onChange={event => updateChange(index, { priceDeltaCents: Math.round((Number(event.target.value) || 0) * 100) })} placeholder="Price change $" aria-label="Price change in dollars" style={inputStyle}/></div>
        <label style={{ color: '#ddd', fontSize: '0.74rem' }}><input type="checkbox" checked={change.ownerConfirmed} onChange={event => updateChange(index, { ownerConfirmed: event.target.checked })}/> I confirm the scope and price impact are correct</label>
        <button type="button" onClick={() => setDraft(current => ({ ...current, changes: current.changes.filter((_, rowIndex) => rowIndex !== index) }))} disabled={draft.changes.length === 1} style={{ ...buttonStyle, justifySelf: 'start' }}>Remove change</button>
      </div>)}
      <button type="button" onClick={() => setDraft(current => ({ ...current, changes: [...current.changes, newChange()] }))} style={buttonStyle}>Add Another Change</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}><textarea value={draft.paymentImpact || ''} onChange={event => setDraft(current => ({ ...current, paymentImpact: event.target.value }))} placeholder="Payment impact, or ‘No change’ *" rows={2} style={{ ...inputStyle, resize: 'vertical' }}/><textarea value={draft.deliveryImpact || ''} onChange={event => setDraft(current => ({ ...current, deliveryImpact: event.target.value }))} placeholder="Delivery impact, or ‘No change’ *" rows={2} style={{ ...inputStyle, resize: 'vertical' }}/></div>
      {validation && <div style={{ color: validation.valid ? '#86efac' : '#fca5a5', fontSize: '0.74rem' }}>{validation.valid ? 'Validation passed.' : validation.errors.map(error => <div key={error}>• {error}</div>)}</div>}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}><button type="button" onClick={() => void addendumAction('preview')} disabled={busy || addendumLocked} style={buttonStyle}>Validate & Preview</button><button type="button" onClick={() => void addendumAction('save')} disabled={busy || addendumLocked} style={buttonStyle}>Save Draft</button><button type="button" onClick={() => void addendumAction('ready_for_review')} disabled={busy || addendumLocked} style={buttonStyle}>Ready for Review</button><button type="button" onClick={() => void addendumAction('approve')} disabled={busy || addendumLocked || validation?.valid !== true} style={{ ...buttonStyle, background: validation?.valid ? '#E8540A' : '#333', borderColor: validation?.valid ? '#E8540A' : '#444' }}>Approve Addendum</button></div>
      {draft.status === 'approved' || draft.documentSnapshot?.sha256 || ['sent','signed'].includes(String(draft.status)) ? <div style={{ borderTop: '1px solid #333', paddingTop: '0.65rem', display: 'grid', gap: '0.55rem' }}>
        <div style={{ color: termsApproved ? '#86efac' : '#fb923c', fontSize: '0.74rem' }}>{termsApproved ? 'The original contract Terms version is approved for customer use.' : 'Legal approval for the original contract Terms version is required before sending.'}</div>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {!draft.documentSnapshot?.sha256 && draft.status === 'approved' && <button type="button" onClick={() => void acceptanceAction('prepare')} disabled={busy} style={buttonStyle}>Prepare Final Addendum</button>}
          {draft.documentSnapshot?.sha256 && <a href={`/.netlify/functions/admin-addendum-preview?id=${encodeURIComponent(String(draft.id))}`} target="_blank" rel="noreferrer" style={{...buttonStyle,textDecoration:'none'}}>View Final Addendum</a>}
          {draft.documentSnapshot?.sha256 && <a href={`/.netlify/functions/admin-addendum-preview?id=${encodeURIComponent(String(draft.id))}&download=1`} style={{...buttonStyle,textDecoration:'none'}}>Download for Email</a>}
          {draft.documentSnapshot?.sha256 && composeUrl && termsApproved && <a href={composeUrl} target="_blank" rel="noreferrer" style={{...buttonStyle,textDecoration:'none'}}>Open Gmail Draft</a>}
          {draft.documentSnapshot?.sha256 && draft.status === 'approved' && <button type="button" onClick={() => void acceptanceAction('mark_sent')} disabled={busy || !termsApproved} style={{...buttonStyle,background:termsApproved?'#E8540A':'#333',borderColor:termsApproved?'#E8540A':'#444'}}>Mark Addendum Sent</button>}
        </div>
        {draft.status === 'sent' && <div style={{display:'grid',gap:'0.45rem'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'0.45rem'}}>
            <select value={acceptanceForm.method} onChange={event=>setAcceptanceForm(current=>({...current,method:event.target.value}))} style={inputStyle}><option value="hand_signed_copy">Signed copy/photo returned</option><option value="email_confirmation">Explicit email acceptance</option></select>
            <input type="datetime-local" value={acceptanceForm.acceptedAt} onChange={event=>setAcceptanceForm(current=>({...current,acceptedAt:event.target.value}))} style={inputStyle}/>
            <input value={acceptanceForm.acceptedByName} onChange={event=>setAcceptanceForm(current=>({...current,acceptedByName:event.target.value}))} placeholder="Accepting customer name *" style={inputStyle}/>
            <input value={acceptanceForm.acceptedByEmail} onChange={event=>setAcceptanceForm(current=>({...current,acceptedByEmail:event.target.value}))} placeholder="Customer email *" style={inputStyle}/>
            <input value={acceptanceForm.evidenceReference} onChange={event=>setAcceptanceForm(current=>({...current,evidenceReference:event.target.value}))} placeholder="Gmail message link or signed-copy reference *" style={{...inputStyle,gridColumn:'1 / -1'}}/>
            <textarea value={acceptanceForm.evidenceNotes} onChange={event=>setAcceptanceForm(current=>({...current,evidenceNotes:event.target.value}))} placeholder="Evidence notes" rows={2} style={{...inputStyle,resize:'vertical',gridColumn:'1 / -1'}}/>
          </div>
          <button type="button" onClick={()=>void acceptanceAction('record_acceptance')} disabled={busy||!termsApproved} style={{...buttonStyle,background:'#E8540A',borderColor:'#E8540A',justifySelf:'start'}}>Record Addendum Acceptance</button>
        </div>}
        {draft.status === 'signed' && <div style={{color:'#86efac',fontSize:'0.74rem'}}>Accepted by {draft.acceptance?.acceptedByName || 'customer'} on {draft.acceptance?.acceptedAt ? new Date(draft.acceptance.acceptedAt).toLocaleString() : 'recorded date'}. Evidence: {draft.acceptance?.evidenceReference || 'audit record'}.</div>}
      </div> : null}
      {previewHtml && <iframe title="Addendum preview" srcDoc={previewHtml} sandbox="" style={{ width: '100%', height: '650px', border: '1px solid #444', borderRadius: '8px', background: '#fff' }}/>}
    </>}
    {message && <div style={{ color: /could|cancel|fix/i.test(message) ? '#fb923c' : '#aaa', fontSize: '0.74rem' }}>{message}</div>}
  </section>;
}
