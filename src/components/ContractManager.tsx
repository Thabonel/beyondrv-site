import React, { useEffect, useMemo, useState } from 'react';
import { adminFetch, adminJson, clearAdminToken } from '../lib/adminApi';
import ContractChangeManager from './ContractChangeManager';

type ContractStatus = 'draft' | 'ready_for_review' | 'approved' | 'sent' | 'signed' | 'cancelled' | 'superseded';
type LineKind = 'base' | 'extra' | 'custom' | 'discount';

interface ProductOption {
  slug: string;
  title: string;
  name?: string;
  category?: string;
  price: string | number;
}

interface CustomerOption { id: string; name?: string; email?: string; phone?: string }
interface LeadOption { id: string; customerId?: string; productInterest?: string }

interface ContractLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  kind: LineKind;
  reason?: string;
}

interface ContractRecord {
  id: string;
  contractNumber: string;
  version: number;
  templateVersion: string;
  termsVersion: string;
  status: ContractStatus;
  customerId: string;
  leadId: string;
  buyer: { name: string; organisation: string; address: string; phone: string; email: string };
  product: { slug: string; name: string; category: string; buildIdentifier: string; dimensions: string; weights: string };
  lineItems: ContractLineItem[];
  specificationSections: Array<{ heading: string; items: string[] }>;
  exclusions: string[];
  deliveryNotes: string;
  validityDate: string;
  ownerApproval?: { approvedAt?: string; approvedBy?: string };
  parentContractId?: string;
  supersededByContractId?: string;
  revisionReason?: string;
  sourceAiActionId?: string;
  proposedChanges?: Array<{ action: string; item: string; previousValue: string; requestedValue: string; sourceExcerpt: string }>;
  acceptance?: {
    status?: string; method?: string; preparedAt?: string; sentAt?: string; sentToEmail?: string; acceptedAt?: string;
    acceptedByName?: string; acceptedByEmail?: string; evidenceReference?: string; evidenceNotes?: string;
    depositAmountCents?: number; depositReference?: string; recordedAt?: string;
  };
  documentSnapshot?: { sha256?: string; key?: string; createdAt?: string };
  signature?: { provider?: string; documentId?: string; status?: string; testMode?: boolean; editUrl?: string; completedPdfUrl?: string; createdAt?: string; sentAt?: string; completedAt?: string; lastCheckedAt?: string };
  createdAt?: string;
  updatedAt?: string;
}

interface ContractValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalCents: number;
  paymentStages: Array<{ percentage: number; trigger: string; amountCents: number }>;
}

const EMPTY_CONTRACT: ContractRecord = {
  id: '', contractNumber: '', version: 1, templateVersion: '12c-master-v2-manual-acceptance', termsVersion: '2026-07-23-v0.1-legal-review-draft', status: 'draft', customerId: '', leadId: '',
  buyer: { name: '', organisation: '', address: '', phone: '', email: '' },
  product: { slug: '', name: '', category: '', buildIdentifier: '', dimensions: '', weights: '' },
  lineItems: [{ id: 'base', description: 'Camper', quantity: 1, unitPriceCents: 0, kind: 'base' }],
  specificationSections: [{ heading: 'Specifications & Inclusions', items: [] }],
  exclusions: [], deliveryNotes: '', validityDate: '',
};

const TWELVE_C_SECTIONS = [
  { heading: 'Internal Features', items: ['Fold out queen size bed with foam mattress','Quality cabinetry throughout','Cabinet doors with locking latches and spring loaded hinges','360 degree swivel dinette table with leatherette upholstery','Dometic reverse cycle air conditioner with 3600W compressor cooling capacity','Two way fan in ensuite with LED lights','Skylight with LED lights','Smoke alarm and fire extinguisher','Ensuite bathroom with hot and cold shower','Bunk bed with foam mattress','Thetford cassette toilet'] },
  { heading: 'External Features', items: ['Electric roll out awning','Slide out step','Picnic table','Stainless steel kitchen with 4 burner stove','Stainless steel sink and drying rack with hot and cold water','Pantry, cutlery drawer and storage drawer','External 240V power, 12V power and TV point','External shower with hot and cold water','Storage with slide out for BBQ or generator','Double jerrycan holder','Spare mud terrain tyre with alloy rim mounted on rear','Grab handle at entrance door'] },
  { heading: 'Electrical', items: ['Battery management system','2000 watt inverter','2 x 180W solar panels','1 x 100Ah lithium-ion smart battery with Bluetooth connectivity','LED lighting throughout','240V, 12V, USB ports and cigarette sockets throughout','External lighting including lightbar on front of vehicle','Bluetooth stereo','24 inch high definition TV','Australian compliant wiring and fittings','Australian electrical certification'] },
  { heading: 'Plumbing', items: ['190L fresh water tank','95L grey water tank','12V water pump','Truma Ultrarapid gas/electric hot water system','External shower','Town water pressure inlets','Australian gas certification'] },
  { heading: 'Build & Construction Features', items: ['Heavy duty hot dipped chassis and drawbar','DO35 off-road hitch','Independent coil suspension with dual shock absorbers','Fibreglass insulated construction with a welded aluminium frame','Double glazed windows with integrated blind and screen','Full length door with integrated security screen','Stone protector on drawbar','Internal storage for gas bottles','Checker plate protection on body','Heavy duty jockey wheel','Alloy wheels and mud terrain tyres'] },
];

const inputStyle = { minWidth: 0, width: '100%', background: '#171717', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem' } as const;
const secondaryButton = { background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem' } as const;

function money(cents: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function priceToCents(value: string | number) {
  const number = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function cloneEmpty(): ContractRecord {
  return JSON.parse(JSON.stringify(EMPTY_CONTRACT)) as ContractRecord;
}

function displayStatus(status: string) {
  return status === 'signed' ? 'accepted' : status.replace(/_/g, ' ');
}

export default function ContractManager({ products, customers, leads }: { products: ProductOption[]; customers: CustomerOption[]; leads: LeadOption[] }) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [draft, setDraft] = useState<ContractRecord>(() => cloneEmpty());
  const [validation, setValidation] = useState<ContractValidation | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [termsApproved, setTermsApproved] = useState(false);
  const [composeUrl, setComposeUrl] = useState('');
  const [acceptanceForm, setAcceptanceForm] = useState({
    method: 'hand_signed_copy',
    acceptedAt: new Date().toISOString().slice(0, 16),
    acceptedByName: '',
    acceptedByEmail: '',
    evidenceReference: '',
    evidenceNotes: '',
    depositAmount: '',
    depositReference: '',
  });

  const totalCents = useMemo(() => draft.lineItems.reduce((sum, item) => {
    const amount = Math.max(1, Number(item.quantity) || 1) * Math.abs(Number(item.unitPriceCents) || 0);
    return sum + (item.kind === 'discount' ? -amount : amount);
  }, 0), [draft.lineItems]);

  async function loadContracts() {
    setLoading(true);
    setStatus('Loading contracts...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-contracts', { cache: 'no-store' });
      if (res.status === 401) { clearAdminToken(); window.location.href = '/.netlify/functions/admin-login'; return; }
      const data = await adminJson<{ contracts?: ContractRecord[] }>(res, 'Could not load contracts.');
      if (!res.ok) throw new Error(data.error || 'Could not load contracts.');
      setContracts(data.contracts || []);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load contracts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, []);

  function updateBuyer(change: Partial<ContractRecord['buyer']>) {
    setDraft(current => ({ ...current, buyer: { ...current.buyer, ...change }, status: current.status === 'approved' ? 'draft' : current.status }));
    setPreviewHtml(''); setValidation(null);
  }

  function updateProduct(change: Partial<ContractRecord['product']>) {
    setDraft(current => ({ ...current, product: { ...current.product, ...change }, status: current.status === 'approved' ? 'draft' : current.status }));
    setPreviewHtml(''); setValidation(null);
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find(item => item.id === customerId);
    setDraft(current => ({ ...current, customerId, buyer: { ...current.buyer, name: customer?.name || current.buyer.name, email: customer?.email || current.buyer.email, phone: customer?.phone || current.buyer.phone } }));
  }

  function selectProduct(slug: string) {
    const product = products.find(item => item.slug === slug);
    if (!product) return;
    const basePrice = priceToCents(product.price);
    const is12C = /12c|12-c|12ft/i.test(`${product.slug} ${product.title}`);
    setDraft(current => ({
      ...current,
      product: { ...current.product, slug, name: product.title || product.name || '', category: product.category || '' },
      lineItems: [{ id: current.lineItems[0]?.id || 'base', description: product.title || product.name || 'Camper', quantity: 1, unitPriceCents: basePrice, kind: 'base' }, ...current.lineItems.slice(1)],
      specificationSections: is12C ? TWELVE_C_SECTIONS.map(section => ({ ...section, items: [...section.items] })) : current.specificationSections,
    }));
    setPreviewHtml(''); setValidation(null);
  }

  function updateLine(index: number, change: Partial<ContractLineItem>) {
    setDraft(current => ({ ...current, status: current.status === 'approved' ? 'draft' : current.status, lineItems: current.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item) }));
    setPreviewHtml(''); setValidation(null);
  }

  function addLine() {
    setDraft(current => ({ ...current, lineItems: [...current.lineItems, { id: `item_${Date.now()}`, description: '', quantity: 1, unitPriceCents: 0, kind: 'extra' }] }));
  }

  function updateSection(index: number, change: Partial<{ heading: string; items: string[] }>) {
    setDraft(current => ({ ...current, status: current.status === 'approved' ? 'draft' : current.status, specificationSections: current.specificationSections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...change } : section) }));
    setPreviewHtml(''); setValidation(null);
  }

  async function preview() {
    setLoading(true); setStatus('Generating preview...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', contract: draft }) });
      const data = await adminJson<{ contract?: ContractRecord; validation?: ContractValidation; html?: string }>(res, 'Could not generate preview.');
      if (!res.ok || !data.contract) throw new Error(data.error || 'Could not generate preview.');
      setDraft(data.contract); setValidation(data.validation || null); setPreviewHtml(data.html || '');
      setStatus(data.validation?.valid ? 'Preview generated. Check every detail before approval.' : 'Preview generated with validation issues.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not generate preview.'); }
    finally { setLoading(false); }
  }

  async function save(nextStatus: ContractStatus = draft.status) {
    setLoading(true); setStatus(nextStatus === 'approved' ? 'Validating and approving...' : 'Saving contract...');
    const method = persisted ? 'PATCH' : 'POST';
    try {
      const res = await adminFetch('/.netlify/functions/admin-contracts', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, status: nextStatus, action: nextStatus === 'approved' ? 'approve' : 'save' }) });
      const data = await adminJson<{ contract?: ContractRecord; validation?: ContractValidation }>(res, 'Could not save contract.');
      setValidation(data.validation || null);
      if (!res.ok || !data.contract) throw new Error(data.error || 'Could not save contract.');
      setDraft(data.contract); setPersisted(true);
      await loadContracts();
      setStatus(nextStatus === 'approved' ? 'Contract approved. Prepare the immutable final copy when the terms version has legal approval.' : 'Contract saved.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save contract.'); }
    finally { setLoading(false); }
  }

  async function loadAcceptanceInfo(contractId: string) {
    if (!contractId) return;
    try {
      const res = await adminFetch(`/.netlify/functions/admin-contract-acceptance?id=${encodeURIComponent(contractId)}`, { cache: 'no-store' });
      const data = await adminJson<{ termsApproved?: boolean; composeUrl?: string }>(res, 'Could not load acceptance status.');
      if (res.ok) {
        setTermsApproved(Boolean(data.termsApproved));
        setComposeUrl(data.composeUrl || '');
      }
    } catch {
      setTermsApproved(false);
      setComposeUrl('');
    }
  }

  async function acceptanceAction(action: 'prepare' | 'mark_sent' | 'record_acceptance') {
    if (!draft.id || !persisted) { setStatus('Save the contract before preparing its final copy.'); return; }
    setLoading(true);
    setStatus(action === 'prepare' ? 'Preparing immutable final copy...' : action === 'mark_sent' ? 'Recording contract delivery...' : 'Recording customer acceptance evidence...');
    try {
      const body = action === 'record_acceptance'
        ? {
          id: draft.id,
          action,
          ...acceptanceForm,
          depositAmountCents: priceToCents(acceptanceForm.depositAmount),
        }
        : { id: draft.id, action, sentToEmail: draft.buyer.email };
      const res = await adminFetch('/.netlify/functions/admin-contract-acceptance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await adminJson<{ contract?: ContractRecord; termsApproved?: boolean; validation?: ContractValidation }>(res, 'Acceptance action failed.');
      if (!res.ok || !data.contract) throw new Error(data.error || 'Acceptance action failed.');
      setDraft(data.contract);
      setAcceptanceForm(current => ({
        ...current,
        acceptedByName: current.acceptedByName || data.contract?.buyer.name || '',
        acceptedByEmail: current.acceptedByEmail || data.contract?.buyer.email || '',
      }));
      if (typeof data.termsApproved === 'boolean') setTermsApproved(data.termsApproved);
      await loadContracts();
      await loadAcceptanceInfo(data.contract.id);
      setStatus(action === 'prepare'
        ? 'Final copy prepared and locked. Download it, attach the approved Terms, and send it from Gmail.'
        : action === 'mark_sent'
          ? 'Contract recorded as sent. Keep the Gmail message as delivery evidence.'
          : 'Customer acceptance recorded. The contract is now immutable and addenda are enabled.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Acceptance action failed.'); }
    finally { setLoading(false); }
  }

  function printFinalCopy() {
    if (!draft.id || !draft.documentSnapshot?.sha256) {
      setStatus('Prepare the final copy before printing or saving it as a PDF.');
      return;
    }
    const printWindow = window.open(`/.netlify/functions/admin-contract-preview?id=${encodeURIComponent(draft.id)}`, '_blank');
    if (!printWindow) {
      setStatus('The browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    printWindow.opener = null;
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
    }, { once: true });
    setStatus('Print dialog opened. Choose a printer or Save as PDF for email.');
  }

  function openContract(contract: ContractRecord) {
    setDraft(JSON.parse(JSON.stringify(contract)) as ContractRecord); setPersisted(true); setValidation(null); setPreviewHtml(''); setShowEditor(true); setStatus('');
    setAcceptanceForm({
      method: contract.acceptance?.method || 'hand_signed_copy',
      acceptedAt: contract.acceptance?.acceptedAt?.slice(0, 16) || new Date().toISOString().slice(0, 16),
      acceptedByName: contract.acceptance?.acceptedByName || contract.buyer.name || '',
      acceptedByEmail: contract.acceptance?.acceptedByEmail || contract.buyer.email || '',
      evidenceReference: contract.acceptance?.evidenceReference || '',
      evidenceNotes: contract.acceptance?.evidenceNotes || '',
      depositAmount: contract.acceptance?.depositAmountCents ? (contract.acceptance.depositAmountCents / 100).toFixed(2) : '',
      depositReference: contract.acceptance?.depositReference || '',
    });
    void loadAcceptanceInfo(contract.id);
  }

  function newContract() {
    setDraft(cloneEmpty()); setPersisted(false); setValidation(null); setPreviewHtml(''); setShowEditor(true); setStatus('');
    setTermsApproved(false); setComposeUrl('');
  }

  const counts = contracts.reduce<Record<string, number>>((acc, contract) => { acc[contract.status] = (acc[contract.status] || 0) + 1; return acc; }, {});

  if (!showEditor) return (
    <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div><div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>Contracts</div><div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>Create, validate, preview, and approve sale agreements.</div></div>
        <div style={{ display: 'flex', gap: '0.45rem' }}><button type="button" onClick={() => void loadContracts()} disabled={loading} style={secondaryButton}>Refresh</button><button type="button" onClick={newContract} style={{ ...secondaryButton, background: '#E8540A', borderColor: '#E8540A' }}>New Contract</button></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.55rem' }}>{['draft','ready_for_review','approved','sent','signed','superseded'].map(key => <div key={key} style={{ background: '#151515', border: '1px solid #333', borderRadius: '8px', padding: '0.7rem' }}><div style={{ color: '#888', fontSize: '0.68rem', textTransform: 'uppercase' }}>{displayStatus(key)}</div><div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginTop: '0.2rem' }}>{counts[key] || 0}</div></div>)}</div>
      {status && <div style={{ color: /could|error|unavailable/i.test(status) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{status}</div>}
      {!loading && contracts.length === 0 ? <div style={{ color: '#777', fontSize: '0.82rem' }}>No contracts yet. Create the first agreement from the approved 12C structure.</div> : contracts.map(contract => <button key={contract.id} type="button" onClick={() => openContract(contract)} style={{ textAlign: 'left', background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.8rem', cursor: 'pointer' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}><strong style={{ color: '#fff' }}>{contract.contractNumber}</strong><span style={{ color: '#fb923c', fontSize: '0.68rem', textTransform: 'uppercase' }}>{displayStatus(contract.status)}</span></div><div style={{ color: '#aaa', fontSize: '0.76rem', marginTop: '0.3rem' }}>{contract.buyer.name || contract.buyer.email || 'Buyer not entered'} · {contract.product.name || 'Product not selected'}</div><div style={{ color: '#666', fontSize: '0.68rem', marginTop: '0.25rem' }}>{money(contract.lineItems.reduce((sum,item) => sum + (item.kind === 'discount' ? -1 : 1) * item.quantity * item.unitPriceCents, 0))} · Updated {contract.updatedAt ? new Date(contract.updatedAt).toLocaleString() : 'not recorded'}</div></button>)}
    </div>
  );

  return (
    <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}><div><button type="button" onClick={() => setShowEditor(false)} style={{ ...secondaryButton, padding: '0.35rem 0.55rem', marginBottom: '0.5rem' }}>← All contracts</button><div style={{ color: '#fff', fontWeight: 800 }}>{draft.contractNumber || 'New Contract'}</div><div style={{ color: '#888', fontSize: '0.72rem' }}>Status: {displayStatus(draft.status)} · Version {draft.version} · Terms {draft.termsVersion}</div></div><div style={{ color: '#fff', fontWeight: 900, fontSize: '1.15rem' }}>{money(totalCents)}</div></div>

      {Boolean(draft.proposedChanges?.length) && <section style={{ background: '#201a12', border: '1px solid #92400e', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.5rem' }}><strong style={{ color: '#fdba74' }}>Customer email changes to apply</strong><div style={{ color: '#ddd', fontSize: '0.74rem' }}>{draft.revisionReason}</div>{draft.proposedChanges?.map((change,index)=><div key={`${change.item}-${index}`} style={{color:'#ddd',fontSize:'0.74rem',borderTop:'1px solid #5b3419',paddingTop:'0.4rem'}}><strong style={{textTransform:'capitalize'}}>{change.action}</strong> {change.item}: {change.previousValue || 'current value not stated'} → {change.requestedValue || 'requested value not stated'}{change.sourceExcerpt && <div style={{color:'#999',marginTop:'0.2rem'}}>Email evidence: “{change.sourceExcerpt}”</div>}</div>)}<div style={{color:'#fb923c',fontSize:'0.7rem'}}>Apply these changes to the structured contract fields, then validate the totals and full preview. The AI has not changed pricing or delivery terms.</div></section>}

      <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.6rem' }}><strong style={{ color: '#fff' }}>Buyer</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.5rem' }}><select value={draft.customerId} onChange={e => selectCustomer(e.target.value)} style={inputStyle}><option value="">Link existing customer (optional)</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name || customer.email || customer.phone || customer.id}</option>)}</select><input value={draft.buyer.name} onChange={e => updateBuyer({ name: e.target.value })} placeholder="Legal name *" style={inputStyle}/><input value={draft.buyer.organisation} onChange={e => updateBuyer({ organisation: e.target.value })} placeholder="Organisation" style={inputStyle}/><input value={draft.buyer.email} onChange={e => updateBuyer({ email: e.target.value })} placeholder="Email *" type="email" style={inputStyle}/><input value={draft.buyer.phone} onChange={e => updateBuyer({ phone: e.target.value })} placeholder="Phone" style={inputStyle}/><input value={draft.buyer.address} onChange={e => updateBuyer({ address: e.target.value })} placeholder="Address" style={inputStyle}/></div></section>

      <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.6rem' }}><strong style={{ color: '#fff' }}>Product</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.5rem' }}><select value={draft.product.slug} onChange={e => selectProduct(e.target.value)} style={inputStyle}><option value="">Select product *</option>{products.filter(product => !('store' in product) || !(product as ProductOption & { store?: boolean }).store).map(product => <option key={product.slug} value={product.slug}>{product.title}</option>)}</select><input value={draft.product.name} onChange={e => updateProduct({ name: e.target.value })} placeholder="Product/model *" style={inputStyle}/><input value={draft.product.buildIdentifier} onChange={e => updateProduct({ buildIdentifier: e.target.value })} placeholder="Build or stock identifier" style={inputStyle}/><input value={draft.product.dimensions} onChange={e => updateProduct({ dimensions: e.target.value })} placeholder="Dimensions" style={inputStyle}/><input value={draft.product.weights} onChange={e => updateProduct({ weights: e.target.value })} placeholder="Weights (ATM, TARE, etc.)" style={inputStyle}/><select value={draft.leadId} onChange={e => setDraft(current => ({ ...current, leadId: e.target.value }))} style={inputStyle}><option value="">Link lead (optional)</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.productInterest || lead.id}</option>)}</select></div></section>

      <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.6rem' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: '#fff' }}>Pricing</strong><button type="button" onClick={addLine} style={secondaryButton}>Add line</button></div>{draft.lineItems.map((item,index) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,2fr) 90px 70px minmax(110px,1fr) auto', gap: '0.45rem', alignItems: 'center' }}><input value={item.description} onChange={e => updateLine(index,{description:e.target.value})} placeholder="Description" style={inputStyle}/><select value={item.kind} onChange={e => updateLine(index,{kind:e.target.value as LineKind})} style={inputStyle}><option value="base">Base</option><option value="extra">Extra</option><option value="custom">Custom</option><option value="discount">Discount</option></select><input value={item.quantity} onChange={e => updateLine(index,{quantity:Number(e.target.value)})} type="number" min="1" style={inputStyle}/><input value={(item.unitPriceCents/100).toFixed(2)} onChange={e => updateLine(index,{unitPriceCents:priceToCents(e.target.value)})} aria-label="Unit price in dollars" style={inputStyle}/><button type="button" onClick={() => setDraft(current => ({...current,lineItems:current.lineItems.filter((_,i)=>i!==index)}))} disabled={draft.lineItems.length===1} style={{...secondaryButton,padding:'0.45rem'}}>×</button>{item.kind==='discount' && <input value={item.reason || ''} onChange={e => updateLine(index,{reason:e.target.value})} placeholder="Discount reason required" style={{...inputStyle,gridColumn:'1 / -1'}}/>}</div>)}<div style={{ color: '#aaa', fontSize: '0.75rem' }}>Payments: 30% on signing ({money(Math.round(totalCents*.3))}) · 20% on arrival in Australia ({money(Math.round(totalCents*.2))}) · balance on delivery ({money(totalCents-Math.round(totalCents*.3)-Math.round(totalCents*.2))})</div></section>

      <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.65rem' }}><strong style={{ color: '#fff' }}>Specifications and inclusions</strong>{draft.specificationSections.map((section,index) => <div key={`${section.heading}-${index}`} style={{ display:'grid',gap:'0.35rem' }}><input value={section.heading} onChange={e=>updateSection(index,{heading:e.target.value})} placeholder="Section heading" style={inputStyle}/><textarea value={section.items.join('\n')} onChange={e=>updateSection(index,{items:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)})} rows={Math.min(12,Math.max(4,section.items.length+1))} placeholder="One inclusion per line" style={{...inputStyle,resize:'vertical'}}/></div>)}<button type="button" onClick={()=>setDraft(current=>({...current,specificationSections:[...current.specificationSections,{heading:'Additional Specifications',items:[]}]}))} style={secondaryButton}>Add specification section</button></section>

      <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.85rem', display: 'grid', gap: '0.55rem' }}><strong style={{ color: '#fff' }}>Delivery and exclusions</strong><textarea value={draft.deliveryNotes} onChange={e=>setDraft(current=>({...current,deliveryNotes:e.target.value}))} rows={3} placeholder="Delivery and handover notes" style={{...inputStyle,resize:'vertical'}}/><textarea value={draft.exclusions.join('\n')} onChange={e=>setDraft(current=>({...current,exclusions:e.target.value.split('\n').map(v=>v.trim()).filter(Boolean)}))} rows={3} placeholder="Exclusions — one per line" style={{...inputStyle,resize:'vertical'}}/><label style={{color:'#aaa',fontSize:'0.74rem'}}>Valid until<input type="date" value={draft.validityDate} onChange={e=>setDraft(current=>({...current,validityDate:e.target.value}))} style={{...inputStyle,marginTop:'0.3rem',maxWidth:'220px'}}/></label></section>

      {validation && <div style={{ background: validation.valid ? '#10251a' : '#2b1712', border: `1px solid ${validation.valid ? '#166534' : '#9a3412'}`, borderRadius:'8px',padding:'0.75rem',fontSize:'0.76rem',lineHeight:1.5,color:'#ddd' }}><strong>{validation.valid ? 'Ready for owner approval' : 'Needs attention'}</strong>{validation.errors.map(error=><div key={error} style={{color:'#fca5a5'}}>• {error}</div>)}{validation.warnings.map(warning=><div key={warning} style={{color:'#fdba74'}}>• {warning}</div>)}</div>}
      {status && <div style={{color:/could|fix|error|disabled/i.test(status)?'#fb923c':'#aaa',fontSize:'0.76rem'}}>{status}</div>}
      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}><button type="button" onClick={()=>void preview()} disabled={loading} style={secondaryButton}>Validate & Preview</button><button type="button" onClick={()=>void save(draft.status==='approved'?'draft':draft.status)} disabled={loading||['sent','signed','superseded'].includes(draft.status)||Boolean(draft.signature?.documentId)||Boolean(draft.documentSnapshot?.sha256)} style={secondaryButton}>Save Draft</button><button type="button" onClick={()=>void save('ready_for_review')} disabled={loading||['sent','signed','superseded'].includes(draft.status)||Boolean(draft.signature?.documentId)||Boolean(draft.documentSnapshot?.sha256)} style={secondaryButton}>Ready for Review</button><button type="button" onClick={()=>void save('approved')} disabled={loading||validation?.valid!==true||['sent','signed','superseded'].includes(draft.status)||Boolean(draft.signature?.documentId)||Boolean(draft.documentSnapshot?.sha256)} style={{...secondaryButton,background:validation?.valid?'#E8540A':'#333',borderColor:validation?.valid?'#E8540A':'#444'}}>Approve Contract</button></div>
      {previewHtml && <section style={{display:'grid',gap:'0.4rem'}}><strong style={{color:'#fff'}}>Document preview</strong><iframe title="Contract preview" srcDoc={previewHtml} sandbox="" style={{width:'100%',height:'780px',border:'1px solid #444',borderRadius:'8px',background:'#fff'}}/></section>}
      <section style={{ background:'#111',border:'1px solid #303030',borderRadius:'8px',padding:'0.85rem',display:'grid',gap:'0.65rem' }}>
        <div style={{display:'flex',justifyContent:'space-between',gap:'0.7rem',alignItems:'baseline',flexWrap:'wrap'}}>
          <strong style={{color:'#fff'}}>Customer acceptance</strong>
          <span style={{color:termsApproved?'#86efac':'#fb923c',fontSize:'0.72rem'}}>{termsApproved ? `Terms ${draft.termsVersion} approved` : `Legal approval required for ${draft.termsVersion}`}</span>
        </div>
        <div style={{color:'#aaa',fontSize:'0.74rem',lineHeight:1.5}}>No paid e-signature provider is used. Prepare a locked final copy, download it, and attach both that file and the matching approved Terms document to the company Gmail draft. After sending, record the returned signed copy, explicit email acceptance, or deposit receipt as evidence.</div>
        {draft.documentSnapshot?.sha256 && <div style={{color:'#aaa',fontSize:'0.72rem'}}>Final-copy fingerprint: <code>{draft.documentSnapshot.sha256.slice(0,20)}…</code> · prepared {draft.acceptance?.preparedAt ? new Date(draft.acceptance.preparedAt).toLocaleString() : 'date not recorded'}</div>}
        <div style={{display:'flex',gap:'0.45rem',flexWrap:'wrap'}}>
          {!draft.documentSnapshot?.sha256 && <button type="button" onClick={()=>void acceptanceAction('prepare')} disabled={loading||draft.status!=='approved'} style={secondaryButton}>Prepare Final Copy</button>}
          {draft.documentSnapshot?.sha256 && <a href={`/.netlify/functions/admin-contract-preview?id=${encodeURIComponent(draft.id)}`} target="_blank" rel="noreferrer" style={{...secondaryButton,textDecoration:'none'}}>View Final Copy</a>}
          {draft.documentSnapshot?.sha256 && <button type="button" onClick={printFinalCopy} style={{...secondaryButton,background:'#1d4ed8',borderColor:'#2563eb'}}>Print / Save PDF</button>}
          {draft.documentSnapshot?.sha256 && <a href={`/.netlify/functions/admin-contract-preview?id=${encodeURIComponent(draft.id)}&download=1`} style={{...secondaryButton,textDecoration:'none'}}>Download HTML</a>}
          {draft.documentSnapshot?.sha256 && composeUrl && termsApproved && <a href={composeUrl} target="_blank" rel="noreferrer" style={{...secondaryButton,textDecoration:'none'}}>Open Gmail Draft</a>}
          {draft.documentSnapshot?.sha256 && draft.status==='approved' && <button type="button" onClick={()=>void acceptanceAction('mark_sent')} disabled={loading||!termsApproved} style={{...secondaryButton,background:termsApproved?'#E8540A':'#333',borderColor:termsApproved?'#E8540A':'#444'}}>Mark as Sent</button>}
        </div>
        {draft.status === 'sent' && <div style={{borderTop:'1px solid #333',paddingTop:'0.65rem',display:'grid',gap:'0.5rem'}}>
          <strong style={{color:'#fff',fontSize:'0.8rem'}}>Record acceptance evidence</strong>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'0.45rem'}}>
            <select value={acceptanceForm.method} onChange={event=>setAcceptanceForm(current=>({...current,method:event.target.value}))} style={inputStyle}>
              <option value="hand_signed_copy">Signed copy/photo returned</option>
              <option value="email_confirmation">Explicit email acceptance</option>
              <option value="deposit_payment">Deposit payment received</option>
            </select>
            <input type="datetime-local" value={acceptanceForm.acceptedAt} onChange={event=>setAcceptanceForm(current=>({...current,acceptedAt:event.target.value}))} style={inputStyle}/>
            <input value={acceptanceForm.acceptedByName} onChange={event=>setAcceptanceForm(current=>({...current,acceptedByName:event.target.value}))} placeholder="Accepting customer name *" style={inputStyle}/>
            <input value={acceptanceForm.acceptedByEmail} onChange={event=>setAcceptanceForm(current=>({...current,acceptedByEmail:event.target.value}))} placeholder="Customer email *" style={inputStyle}/>
            <input value={acceptanceForm.evidenceReference} onChange={event=>setAcceptanceForm(current=>({...current,evidenceReference:event.target.value}))} placeholder="Gmail message link, receipt or file reference *" style={{...inputStyle,gridColumn:'1 / -1'}}/>
            {acceptanceForm.method==='deposit_payment' && <><input value={acceptanceForm.depositAmount} onChange={event=>setAcceptanceForm(current=>({...current,depositAmount:event.target.value}))} placeholder="Deposit amount $" style={inputStyle}/><input value={acceptanceForm.depositReference} onChange={event=>setAcceptanceForm(current=>({...current,depositReference:event.target.value}))} placeholder="Bank/payment reference *" style={inputStyle}/></>}
            <textarea value={acceptanceForm.evidenceNotes} onChange={event=>setAcceptanceForm(current=>({...current,evidenceNotes:event.target.value}))} placeholder="Evidence notes" rows={2} style={{...inputStyle,resize:'vertical',gridColumn:'1 / -1'}}/>
          </div>
          <button type="button" onClick={()=>void acceptanceAction('record_acceptance')} disabled={loading||!termsApproved} style={{...secondaryButton,background:'#E8540A',borderColor:'#E8540A',justifySelf:'start'}}>Record Acceptance</button>
        </div>}
        {draft.status === 'signed' && <div style={{color:'#86efac',fontSize:'0.76rem',lineHeight:1.5}}>Accepted by {draft.acceptance?.acceptedByName || 'customer'} on {draft.acceptance?.acceptedAt ? new Date(draft.acceptance.acceptedAt).toLocaleString() : 'recorded date'} via {draft.acceptance?.method?.replace(/_/g,' ')}. Evidence: {draft.acceptance?.evidenceReference || 'recorded in audit log'}.</div>}
      </section>
      {persisted && <ContractChangeManager contract={draft} onRevisionCreated={revision => { setDraft(revision as ContractRecord); setPersisted(true); setValidation(null); setPreviewHtml(''); void loadContracts(); void loadAcceptanceInfo(revision.id); }}/>}
    </div>
  );
}
