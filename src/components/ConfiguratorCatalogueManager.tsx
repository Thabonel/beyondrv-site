import React, { useMemo, useState } from 'react';
import { adminFetch, adminJson } from '../lib/adminApi';
import type { ConfigurationOption, ConfiguratorCatalogue } from '../lib/configurator/types';

const input = { width: '100%', minWidth: 0, background: '#171717', border: '1px solid #444', color: '#fff', borderRadius: 7, padding: '0.5rem', fontSize: '0.75rem' } as const;
const button = { background: '#222', border: '1px solid #444', color: '#fff', borderRadius: 7, padding: '0.5rem 0.7rem', cursor: 'pointer', fontWeight: 750, fontSize: '0.74rem' } as const;
const cents = (value: string) => Math.max(0, Math.round((Number(value.replace(/[$,\s]/g, '')) || 0) * 100));

export default function ConfiguratorCatalogueManager({ catalogue, onSaved, onClose }: { catalogue: ConfiguratorCatalogue; onSaved: (catalogue: ConfiguratorCatalogue) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(catalogue)) as ConfiguratorCatalogue);
  const [modelId, setModelId] = useState(catalogue.models[0]?.id || '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const model = draft.models.find(item => item.id === modelId);
  const options = useMemo(() => draft.options.filter(option => option.modelIds.includes(modelId)).sort((a, b) => a.sortOrder - b.sortOrder), [draft.options, modelId]);

  function updateModel(change: Record<string, unknown>) {
    setDraft(current => ({ ...current, models: current.models.map(item => item.id === modelId ? { ...item, ...change } : item) }));
  }
  function updateOption(id: string, change: Partial<ConfigurationOption>) {
    setDraft(current => ({ ...current, options: current.options.map(item => item.id === id ? { ...item, ...change } : item) }));
  }
  function addOption() {
    const category = draft.categories[0];
    const option: ConfigurationOption = {
      id: `option_${Date.now()}`, categoryId: category?.id || '', name: 'New option', shortDescription: '', active: false, adminVisible: true, customerVisible: false,
      modelIds: [modelId], selectionMode: 'single', retailPriceDeltaCents: 0, internalCostDeltaCents: null, weightDeltaKg: null, visualBindingId: null,
      verificationStatus: 'unverified', sortOrder: Math.max(0, ...draft.options.map(item => item.sortOrder)) + 10,
    };
    setDraft(current => ({ ...current, options: [...current.options, option] }));
  }
  function updateVisualJson(kind: 'bindings' | 'hotspots', value: string) {
    if (!model) return;
    try {
      const parsed = JSON.parse(value) as unknown[];
      if (!Array.isArray(parsed)) throw new Error('Value must be a JSON array.');
      updateModel({ visualAsset: {
        status: model.visualAsset?.status || 'cad_pending', glbUrl: model.visualAsset?.glbUrl || '', posterUrl: model.visualAsset?.posterUrl || '',
        assetVersion: model.visualAsset?.assetVersion || '1', maxBytes: model.visualAsset?.maxBytes || 26214400,
        bindings: kind === 'bindings' ? parsed : model.visualAsset?.bindings || [], hotspots: kind === 'hotspots' ? parsed : model.visualAsset?.hotspots || [],
      } });
      setStatus(`${kind === 'bindings' ? 'Bindings' : 'Hotspots'} JSON accepted. Save the catalogue to persist it.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Invalid visual JSON.'); }
  }
  async function save(action: 'save' | 'approve') {
    if (action === 'approve' && !window.confirm('Approve this catalogue for internal contract creation? This should only be done after prices and rules have been checked.')) return;
    setBusy(true); setStatus(action === 'approve' ? 'Validating and approving catalogue…' : 'Saving catalogue…');
    try {
      const response = await adminFetch('/.netlify/functions/admin-configurator-catalogue', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalogue: draft, action, confirmation: action === 'approve' ? 'APPROVE CATALOGUE' : '' }) });
      const data = await adminJson<{ catalogue?: ConfiguratorCatalogue; error?: string; validation?: { errors?: string[] } }>(response, 'Could not save catalogue.');
      if (!response.ok || !data.catalogue) throw new Error(data.error || data.validation?.errors?.join(' ') || 'Could not save catalogue.');
      setDraft(data.catalogue); onSaved(data.catalogue); setStatus(action === 'approve' ? 'Catalogue approved for internal use.' : 'Catalogue saved for owner review.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save catalogue.'); }
    finally { setBusy(false); }
  }

  return <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.8rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><button type="button" onClick={onClose} style={button}>← Configurations</button><h2 style={{ color: '#fff', fontSize: '1rem', margin: '0.7rem 0 0' }}>Operational catalogue editor</h2><p style={{ color: '#888', fontSize: '0.73rem' }}>Prices are GST-inclusive AUD. Saving returns the catalogue to owner review; approval is a separate deliberate action.</p></div>
      <div style={{ color: draft.readiness.startsWith('approved') ? '#86efac' : '#fdba74', fontSize: '0.75rem' }}>{draft.readiness.replace(/_/g, ' ')}</div>
    </div>
    <select value={modelId} onChange={event => setModelId(event.target.value)} style={input}>{draft.models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {model && <section style={{ background: '#111', border: '1px solid #333', borderRadius: 9, padding: '0.8rem', display: 'grid', gap: 8 }}>
      <strong style={{ color: '#fff', fontSize: '0.8rem' }}>Model pricing and availability</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Name<input value={model.name} onChange={event => updateModel({ name: event.target.value })} style={input}/></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Base price AUD<input value={(model.basePriceCents / 100).toFixed(2)} onChange={event => updateModel({ basePriceCents: cents(event.target.value) })} style={input}/></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Price qualifier<select value={model.priceQualifier} onChange={event => updateModel({ priceQualifier: event.target.value })} style={input}><option value="exact">Exact</option><option value="from">From</option><option value="negotiable">Negotiable</option><option value="poa">POA</option></select></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Verification<select value={model.priceVerificationStatus} onChange={event => updateModel({ priceVerificationStatus: event.target.value })} style={input}><option value="unverified">Unverified</option><option value="price_confirmed_rules_pending">Price confirmed, rules pending</option><option value="owner_confirmed">Owner confirmed</option></select></label>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#ddd', fontSize: '0.72rem' }}>
        <label><input type="checkbox" checked={model.active} onChange={event => updateModel({ active: event.target.checked })}/> Active</label>
        <label><input type="checkbox" checked={model.adminVisible} onChange={event => updateModel({ adminVisible: event.target.checked })}/> Admin visible</label>
        <label><input type="checkbox" checked={model.customerVisible} onChange={event => updateModel({ customerVisible: event.target.checked })}/> Customer visible</label>
      </div>
      <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Customer order-process summary<textarea value={model.orderProcess.customerSummary} onChange={event => updateModel({ orderProcess: { ...model.orderProcess, customerSummary: event.target.value } })} rows={2} style={{ ...input, resize: 'vertical' }}/></label>
      <strong style={{ color: '#fff', fontSize: '0.8rem', marginTop: 8 }}>3D web asset</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Status<select value={model.visualAsset?.status || 'cad_pending'} onChange={event => updateModel({ visualAsset: { status: event.target.value, glbUrl: model.visualAsset?.glbUrl || '', posterUrl: model.visualAsset?.posterUrl || '', assetVersion: model.visualAsset?.assetVersion || '1', maxBytes: model.visualAsset?.maxBytes || 26214400, bindings: model.visualAsset?.bindings || [], hotspots: model.visualAsset?.hotspots || [] } })} style={input}><option value="cad_pending">CAD pending</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="needs_revision">Needs revision</option></select></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>GLB URL<input value={model.visualAsset?.glbUrl || ''} onChange={event => updateModel({ visualAsset: { status: model.visualAsset?.status || 'cad_pending', glbUrl: event.target.value, posterUrl: model.visualAsset?.posterUrl || '', assetVersion: model.visualAsset?.assetVersion || '1', maxBytes: model.visualAsset?.maxBytes || 26214400, bindings: model.visualAsset?.bindings || [], hotspots: model.visualAsset?.hotspots || [] } })} placeholder="/models/camper.glb" style={input}/></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Poster URL<input value={model.visualAsset?.posterUrl || ''} onChange={event => updateModel({ visualAsset: { status: model.visualAsset?.status || 'cad_pending', glbUrl: model.visualAsset?.glbUrl || '', posterUrl: event.target.value, assetVersion: model.visualAsset?.assetVersion || '1', maxBytes: model.visualAsset?.maxBytes || 26214400, bindings: model.visualAsset?.bindings || [], hotspots: model.visualAsset?.hotspots || [] } })} style={input}/></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Option-to-node bindings JSON<textarea key={`${modelId}-bindings`} defaultValue={JSON.stringify(model.visualAsset?.bindings || [], null, 2)} onBlur={event => updateVisualJson('bindings', event.target.value)} rows={5} style={{ ...input, resize: 'vertical', fontFamily: 'monospace' }}/></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>3D hotspots JSON<textarea key={`${modelId}-hotspots`} defaultValue={JSON.stringify(model.visualAsset?.hotspots || [], null, 2)} onBlur={event => updateVisualJson('hotspots', event.target.value)} rows={5} style={{ ...input, resize: 'vertical', fontFamily: 'monospace' }}/></label>
      </div>
    </section>}
    <section style={{ background: '#111', border: '1px solid #333', borderRadius: 9, padding: '0.8rem', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: '#fff', fontSize: '0.8rem' }}>Options for selected model</strong><button type="button" onClick={addOption} style={button}>Add option</button></div>
      {options.map(option => <div key={option.id} style={{ borderTop: '1px solid #292929', paddingTop: 8, display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 120px 150px auto', gap: 8, alignItems: 'end' }}>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Option<input value={option.name} onChange={event => updateOption(option.id, { name: event.target.value })} style={input}/></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Price AUD<input value={(option.retailPriceDeltaCents / 100).toFixed(2)} onChange={event => updateOption(option.id, { retailPriceDeltaCents: cents(event.target.value) })} style={input}/></label>
        <label style={{ color: '#aaa', fontSize: '0.68rem' }}>Verification<select value={option.verificationStatus} onChange={event => updateOption(option.id, { verificationStatus: event.target.value as ConfigurationOption['verificationStatus'] })} style={input}><option value="unverified">Unverified</option><option value="price_confirmed_rules_pending">Price confirmed</option><option value="owner_confirmed">Owner confirmed</option></select></label>
        <label style={{ color: '#ddd', fontSize: '0.72rem', paddingBottom: 9 }}><input type="checkbox" checked={option.active} onChange={event => updateOption(option.id, { active: event.target.checked })}/> Active</label>
      </div>)}
    </section>
    {status && <div style={{ color: /could|failed|error/i.test(status) ? '#fb923c' : '#aaa', fontSize: '0.75rem' }}>{status}</div>}
    <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: '#0a0a0a', padding: '0.7rem 0', borderTop: '1px solid #333' }}><button type="button" disabled={busy} onClick={() => void save('save')} style={button}>Save for Owner Review</button><button type="button" disabled={busy} onClick={() => void save('approve')} style={{ ...button, background: '#166534', borderColor: '#15803d' }}>Approve Catalogue Internally</button></div>
  </div>;
}
