import React, { useEffect, useMemo, useState } from 'react';
import { adminFetch, adminJson, clearAdminToken } from '../lib/adminApi';
import { evaluateConfiguration } from '../lib/configurator/engine';
import type {
  CatalogueValidation,
  ConfigurationCustomItem,
  ConfigurationEvaluation,
  ConfigurationRecord,
  ConfiguratorCatalogue,
} from '../lib/configurator/types';
import ConfiguratorGlbViewer from './ConfiguratorGlbViewer';
import ConfiguratorCatalogueManager from './ConfiguratorCatalogueManager';
import ConfigurationWorkflowPanel from './ConfigurationWorkflowPanel';

interface ProductOption {
  slug: string;
  title: string;
  price: string | number;
  category?: string;
}

interface CustomerOption {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface LeadOption {
  id: string;
  customerId?: string;
  productInterest?: string;
}

interface ConfiguratorResponse {
  configurations?: ConfigurationRecord[];
  configuration?: ConfigurationRecord;
  catalogue?: ConfiguratorCatalogue;
  catalogueValidation?: CatalogueValidation;
  evaluation?: ConfigurationEvaluation;
  contract?: { id: string; contractNumber: string };
  error?: string;
}

const inputStyle = {
  width: '100%', minWidth: 0, background: '#171717', border: '1px solid #444', color: '#fff', borderRadius: '8px', padding: '0.62rem', fontSize: '0.8rem',
} as const;

const secondaryButton = {
  background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '7px', padding: '0.52rem 0.72rem', cursor: 'pointer', fontWeight: 750, fontSize: '0.76rem',
} as const;

function money(cents: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(cents / 100);
}

function qualifiedMoney(cents: number, qualifier: 'exact' | 'from' | 'negotiable' | 'poa' = 'exact') {
  if (qualifier === 'poa') return 'POA';
  const amount = money(cents);
  if (qualifier === 'from') return `From ${amount}`;
  if (qualifier === 'negotiable') return `${amount} negotiable`;
  return amount;
}

function dollarsToCents(value: string) {
  const number = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}

function productPriceCents(value: string | number) {
  return dollarsToCents(String(value));
}

function blankConfiguration(catalogue: ConfiguratorCatalogue): ConfigurationRecord {
  const model = catalogue.models.find(item => item.active && item.adminVisible) ?? catalogue.models[0];
  return {
    id: '',
    configurationNumber: '',
    revision: 1,
    parentConfigurationId: '',
    status: 'draft',
    catalogueVersion: catalogue.catalogueVersion,
    modelId: model?.id ?? '',
    customerId: '',
    leadId: '',
    customer: { name: '', email: '', phone: '' },
    selectedOptions: [],
    customItems: [],
    drawings: [],
    customerReview: { status: 'not_created', tokenHash: '', tokenHint: '', createdAt: '', expiresAt: '', viewedAt: '', decidedAt: '', decidedByName: '', decidedByEmail: '', decisionNotes: '', configurationUpdatedAt: '' },
    production: { status: 'not_released', orderId: '', depositReference: '', depositReceivedAt: '', expectedArrivalDate: '', expectedHandoverDate: '', nextActionDate: '', events: [] },
    acknowledgedWarningIds: [],
    ownerNotes: '',
    customerNotes: '',
    linkedContractIds: [],
    linkedOrderIds: [],
    approvedSnapshotKey: '',
    approvedSnapshotDigest: '',
    approvedAt: '',
    approvedBy: '',
    createdBy: 'owner',
    updatedBy: 'owner',
    createdAt: '',
    updatedAt: '',
  };
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function issueColour(type: 'error' | 'warning' | 'information') {
  if (type === 'error') return '#fca5a5';
  if (type === 'warning') return '#fdba74';
  return '#93c5fd';
}

export default function ConfiguratorWorkspace({ products, customers, leads, onOpenContracts }: { products: ProductOption[]; customers: CustomerOption[]; leads: LeadOption[]; onOpenContracts?: () => void }) {
  const [catalogue, setCatalogue] = useState<ConfiguratorCatalogue | null>(null);
  const [catalogueValidation, setCatalogueValidation] = useState<CatalogueValidation | null>(null);
  const [configurations, setConfigurations] = useState<ConfigurationRecord[]>([]);
  const [draft, setDraft] = useState<ConfigurationRecord | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showCatalogueManager, setShowCatalogueManager] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('');

  const evaluation = useMemo(() => {
    if (!catalogue || !draft) return null;
    return evaluateConfiguration(catalogue, draft.modelId, draft.selectedOptions, draft.customItems);
  }, [catalogue, draft]);

  const currentModel = evaluation?.model ?? catalogue?.models.find(model => model.id === draft?.modelId) ?? null;
  const currentProduct = products.find(product => product.slug === currentModel?.productSlug);
  const publishedPriceMismatch = Boolean(currentModel && currentProduct && productPriceCents(currentProduct.price) !== currentModel.basePriceCents);
  const immutable = Boolean(draft && ['approved', 'quoted', 'converted_to_contract', 'ordered', 'superseded'].includes(draft.status));
  const catalogueReadyForContracts = Boolean(catalogue && ['approved_internal', 'approved_public'].includes(catalogue.readiness));

  async function loadConfigurations() {
    setLoading(true);
    setStatus('Loading configurations...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-configurations', { cache: 'no-store' });
      if (res.status === 401) {
        clearAdminToken();
        window.location.href = '/.netlify/functions/admin-login';
        return;
      }
      const data = await adminJson<ConfiguratorResponse>(res, 'Could not load the configurator.');
      if (!res.ok || !data.catalogue) throw new Error(data.error || 'Could not load the configurator.');
      setCatalogue(data.catalogue);
      setCatalogueValidation(data.catalogueValidation ?? null);
      setConfigurations(data.configurations ?? []);
      setActiveCategoryId(current => current || data.catalogue?.categories[0]?.id || '');
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load the configurator.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfigurations();
  }, []);

  function edit(change: Partial<ConfigurationRecord>) {
    if (immutable) return;
    setDraft(current => current ? { ...current, ...change } : current);
  }

  function newConfiguration() {
    if (!catalogue) return;
    setDraft(blankConfiguration(catalogue));
    setPersisted(false);
    setShowEditor(true);
    setActiveCategoryId(catalogue.categories[0]?.id || '');
    setStatus('Development pilot started. Save when the customer and initial options are ready.');
  }

  function openConfiguration(configuration: ConfigurationRecord) {
    setDraft(JSON.parse(JSON.stringify(configuration)) as ConfigurationRecord);
    setPersisted(true);
    setShowEditor(true);
    setActiveCategoryId(catalogue?.categories[0]?.id || '');
    setStatus('');
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find(item => item.id === customerId);
    edit({
      customerId,
      customer: {
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
      },
    });
  }

  function selectionFor(optionId: string) {
    return draft?.selectedOptions.find(selection => selection.optionId === optionId);
  }

  function setSelection(optionId: string, selected: boolean, quantity = 1) {
    if (!draft || immutable) return;
    const remaining = draft.selectedOptions.filter(selection => selection.optionId !== optionId);
    edit({ selectedOptions: selected ? [...remaining, { optionId, quantity: Math.max(1, quantity) }] : remaining });
  }

  function updateQuantity(optionId: string, quantity: number, maxQuantity = 1) {
    setSelection(optionId, quantity > 0, Math.min(maxQuantity, Math.max(1, quantity)));
  }

  function addCustomItem(kind: ConfigurationCustomItem['kind']) {
    if (!draft || immutable) return;
    edit({
      customItems: [...draft.customItems, {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        description: '',
        kind,
        retailPriceCents: 0,
        internalCostCents: kind === 'discount' ? 0 : null,
        weightDeltaKg: kind === 'discount' ? 0 : null,
        reason: '',
        visualBrief: '',
        drawingStatus: kind === 'discount' ? 'not_applicable' : 'not_started',
      }],
    });
  }

  function updateCustomItem(index: number, change: Partial<ConfigurationCustomItem>) {
    if (!draft || immutable) return;
    edit({ customItems: draft.customItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item) });
  }

  function removeCustomItem(index: number) {
    if (!draft || immutable) return;
    edit({ customItems: draft.customItems.filter((_, itemIndex) => itemIndex !== index) });
  }

  async function save(action: 'save' | 'ready_for_review' | 'approve' = 'save') {
    if (!draft) return;
    setLoading(true);
    setStatus(action === 'approve' ? 'Validating and approving the configuration...' : 'Saving configuration...');
    try {
      const method = persisted ? 'PATCH' : 'POST';
      const body = persisted
        ? { id: draft.id, expectedUpdatedAt: draft.updatedAt, action, configuration: draft }
        : { configuration: draft };
      const res = await adminFetch('/.netlify/functions/admin-configurations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await adminJson<ConfiguratorResponse>(res, 'Could not save the configuration.');
      if (!res.ok || !data.configuration) throw new Error(data.error || 'Could not save the configuration.');
      setDraft(data.configuration);
      setPersisted(true);
      setConfigurations(current => [data.configuration!, ...current.filter(item => item.id !== data.configuration!.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      setStatus(action === 'approve'
        ? 'Internal configuration approved and locked. Create a revision for later changes.'
        : action === 'ready_for_review'
          ? 'Configuration saved as ready for review.'
          : 'Configuration saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save the configuration.');
    } finally {
      setLoading(false);
    }
  }

  async function copyConfiguration(action: 'duplicate' | 'revise') {
    if (!draft?.id) return;
    setLoading(true);
    setStatus(action === 'revise' ? 'Creating a new revision...' : 'Duplicating configuration...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-configurations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: draft.id }),
      });
      const data = await adminJson<ConfiguratorResponse>(res, 'Could not copy the configuration.');
      if (!res.ok || !data.configuration) throw new Error(data.error || 'Could not copy the configuration.');
      setDraft(data.configuration);
      setPersisted(true);
      setConfigurations(current => [data.configuration!, ...current]);
      setStatus(action === 'revise' ? `Revision ${data.configuration.revision} created as a draft.` : 'Configuration duplicated as a new draft.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not copy the configuration.');
    } finally {
      setLoading(false);
    }
  }

  async function createContractDraft() {
    if (!draft?.id || draft.status !== 'approved') return;
    setLoading(true);
    setStatus('Creating a contract draft from the approved snapshot...');
    try {
      const res = await adminFetch('/.netlify/functions/admin-configuration-contract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: draft.id }),
      });
      const data = await adminJson<ConfiguratorResponse>(res, 'Could not create the contract draft.');
      if (!res.ok || !data.configuration || !data.contract) throw new Error(data.error || 'Could not create the contract draft.');
      setDraft(data.configuration);
      setConfigurations(current => [data.configuration!, ...current.filter(item => item.id !== data.configuration!.id)]);
      setStatus(`Contract ${data.contract.contractNumber} created. Open Contracts to add any missing buyer, delivery or legal details.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create the contract draft.');
    } finally {
      setLoading(false);
    }
  }

  function openSummary(print = false) {
    if (!draft?.id || !persisted) {
      setStatus('Save the configuration before opening the customer summary.');
      return;
    }
    const summaryWindow = window.open(`/.netlify/functions/admin-configuration-summary?id=${encodeURIComponent(draft.id)}`, '_blank');
    if (!summaryWindow) {
      setStatus('The browser blocked the summary window. Allow pop-ups and try again.');
      return;
    }
    summaryWindow.opener = null;
    if (print) summaryWindow.addEventListener('load', () => summaryWindow.print(), { once: true });
  }

  const counts = configurations.reduce<Record<string, number>>((result, configuration) => {
    result[configuration.status] = (result[configuration.status] || 0) + 1;
    return result;
  }, {});

  function acceptWorkflowConfiguration(configuration: ConfigurationRecord) {
    setDraft(JSON.parse(JSON.stringify(configuration)) as ConfigurationRecord);
    setConfigurations(current => [configuration, ...current.filter(item => item.id !== configuration.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }

  if (showCatalogueManager && catalogue) {
    return <ConfiguratorCatalogueManager catalogue={catalogue} onClose={() => setShowCatalogueManager(false)} onSaved={updated => { setCatalogue(updated); setCatalogueValidation(null); }} />;
  }

  if (!showEditor) {
    return (
      <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 850, fontSize: '1rem' }}>Camper Configurator</div>
            <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>Build, price and save internal camper configurations while the CAD visual is prepared.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button type="button" onClick={() => void loadConfigurations()} disabled={loading} style={secondaryButton}>Refresh</button>
            <button type="button" onClick={() => setShowCatalogueManager(true)} disabled={!catalogue} style={secondaryButton}>Manage Catalogue</button>
            <button type="button" onClick={newConfiguration} disabled={!catalogue} style={{ ...secondaryButton, background: '#E8540A', borderColor: '#E8540A' }}>New Configuration</button>
          </div>
        </div>

        {catalogue && (
          <div style={{ background: '#21170f', border: '1px solid #9a4b16', borderRadius: '9px', padding: '0.8rem', color: '#fed7aa', fontSize: '0.76rem', lineHeight: 1.5 }}>
            <strong>Development catalogue:</strong> {catalogue.notice}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.55rem' }}>
          {['draft', 'ready_for_review', 'approved', 'superseded'].map(key => (
            <div key={key} style={{ background: '#151515', border: '1px solid #333', borderRadius: '8px', padding: '0.7rem' }}>
              <div style={{ color: '#888', fontSize: '0.68rem', textTransform: 'uppercase' }}>{statusLabel(key)}</div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginTop: '0.2rem' }}>{counts[key] || 0}</div>
            </div>
          ))}
        </div>

        {status && <div style={{ color: /could|error|unavailable/i.test(status) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{status}</div>}
        {!loading && configurations.length === 0
          ? <div style={{ color: '#777', fontSize: '0.82rem' }}>No configurations yet. Start the Advent 2150 development pilot.</div>
          : configurations.map(configuration => {
            const model = catalogue?.models.find(item => item.id === configuration.modelId);
            const result = catalogue ? evaluateConfiguration(catalogue, configuration.modelId, configuration.selectedOptions, configuration.customItems) : null;
            return (
              <button key={configuration.id} type="button" onClick={() => openConfiguration(configuration)} style={{ textAlign: 'left', background: '#111', border: '1px solid #303030', borderRadius: '8px', padding: '0.82rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#fff' }}>{configuration.configurationNumber} · R{configuration.revision}</strong>
                  <span style={{ color: configuration.status === 'approved' ? '#86efac' : '#fb923c', fontSize: '0.68rem', textTransform: 'uppercase' }}>{statusLabel(configuration.status)}</span>
                </div>
                <div style={{ color: '#aaa', fontSize: '0.76rem', marginTop: '0.3rem' }}>{configuration.customer.name || configuration.customer.email || 'No customer linked'} · {model?.name || configuration.modelId}</div>
                <div style={{ color: '#666', fontSize: '0.68rem', marginTop: '0.25rem' }}>{result?.model ? qualifiedMoney(result.pricing.configuredTotalCents, result.model.priceQualifier) : 'Total unavailable'} · {configuration.selectedOptions.length} selected option{configuration.selectedOptions.length === 1 ? '' : 's'} · Updated {configuration.updatedAt ? new Date(configuration.updatedAt).toLocaleString() : 'not recorded'}</div>
              </button>
            );
          })}
      </div>
    );
  }

  if (!catalogue || !draft || !evaluation) {
    return <div style={{ padding: '1rem', color: '#aaa' }}>{status || 'Loading configurator...'}</div>;
  }

  const categoryOptions = catalogue.options
    .filter(option => option.active && option.adminVisible && option.modelIds.includes(draft.modelId) && option.categoryId === activeCategoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return (
    <div style={{ padding: '1rem', overflowY: 'auto', display: 'grid', gap: '0.85rem' }}>
      <style>{`
        .configurator-main-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(340px,.88fr);gap:.8rem;align-items:start}
        .configurator-option-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.75rem;align-items:center}
        @media(max-width:980px){.configurator-main-grid{grid-template-columns:1fr}.configurator-visual{min-height:280px!important}}
        @media(max-width:620px){.configurator-option-row{grid-template-columns:1fr}.configurator-actions>*{width:100%}}
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <button type="button" onClick={() => setShowEditor(false)} style={{ ...secondaryButton, padding: '0.35rem 0.55rem', marginBottom: '0.45rem' }}>← All configurations</button>
          <div style={{ color: '#fff', fontWeight: 850, fontSize: '1rem' }}>{draft.configurationNumber || 'New Configuration'} {draft.configurationNumber ? `· R${draft.revision}` : ''}</div>
          <div style={{ color: '#888', fontSize: '0.72rem', marginTop: '0.18rem' }}>Status: {statusLabel(draft.status)} · Catalogue {draft.catalogueVersion}</div>
          {currentModel?.orderProcess?.customerSummary && <div style={{ color: '#aaa', fontSize: '0.7rem', marginTop: '0.3rem', maxWidth: '720px', lineHeight: 1.45 }}>{currentModel.orderProcess.customerSummary}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.35rem' }}>{qualifiedMoney(evaluation.pricing.configuredTotalCents, currentModel?.priceQualifier)}</div>
          <div style={{ color: '#777', fontSize: '0.68rem' }}>{evaluation.selections.length} configured selection{evaluation.selections.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div style={{ background: '#21170f', border: '1px solid #9a4b16', borderRadius: '9px', padding: '0.75rem', color: '#fed7aa', fontSize: '0.74rem', lineHeight: 1.5 }}>
        <strong>Internal development pilot.</strong> {catalogue.notice}
      </div>

      {(publishedPriceMismatch || catalogueValidation?.errors.length || catalogueValidation?.warnings.length) ? (
        <div style={{ display: 'grid', gap: '0.3rem', background: catalogueValidation?.errors.length ? '#2a1212' : '#171717', border: `1px solid ${catalogueValidation?.errors.length ? '#991b1b' : '#3f3f46'}`, borderRadius: '8px', padding: '0.7rem' }}>
          {publishedPriceMismatch && <div style={{ color: '#fca5a5', fontSize: '0.72rem' }}>The published product price differs from this catalogue. Update the catalogue before owner approval.</div>}
          {catalogueValidation?.errors.map(error => <div key={error} style={{ color: '#fca5a5', fontSize: '0.72rem' }}>• {error}</div>)}
          {catalogueValidation?.warnings.map(warning => <div key={warning} style={{ color: '#fdba74', fontSize: '0.72rem' }}>• {warning}</div>)}
        </div>
      ) : null}

      <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '9px', padding: '0.8rem', display: 'grid', gap: '0.55rem' }}>
        <strong style={{ color: '#fff', fontSize: '0.8rem' }}>Customer and model</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '0.5rem' }}>
          <select value={draft.customerId} onChange={event => selectCustomer(event.target.value)} disabled={immutable} style={inputStyle}>
            <option value="">No customer linked yet</option>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name || customer.email || customer.phone || customer.id}</option>)}
          </select>
          <select value={draft.leadId} onChange={event => edit({ leadId: event.target.value })} disabled={immutable} style={inputStyle}>
            <option value="">No lead linked</option>
            {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.productInterest || lead.id}</option>)}
          </select>
          <select value={draft.modelId} onChange={event => edit({ modelId: event.target.value, selectedOptions: [] })} disabled={immutable} style={inputStyle}>
            {catalogue.models.filter(model => model.active && model.adminVisible).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
        </div>
      </section>

      <div className="configurator-main-grid">
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <section className="configurator-visual" style={{ minHeight: '390px', border: '1px solid #303030', borderRadius: '10px', overflow: 'hidden', position: 'relative', background: '#090909' }}>
            {currentModel?.visualAsset?.status === 'ready' && currentModel.visualAsset.glbUrl
              ? <ConfiguratorGlbViewer src={currentModel.visualAsset.glbUrl} poster={currentModel.visualAsset.posterUrl || currentModel.heroImage} alt={`${currentModel.name} interactive 3D model`} selectedOptionIds={draft.selectedOptions.map(item => item.optionId)} bindings={currentModel.visualAsset.bindings} hotspots={currentModel.visualAsset.hotspots} />
              : currentModel?.heroImage
              ? <img src={currentModel.heroImage} alt={currentModel.name} style={{ width: '100%', height: '100%', minHeight: '390px', objectFit: 'cover', opacity: 0.7, display: 'block' }} />
              : <div style={{ minHeight: '390px' }} />}
            {currentModel?.visualAsset?.status !== 'ready' && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.75))', display: 'flex', alignItems: 'flex-end', padding: '1rem' }}>
              <div>
                <div style={{ display: 'inline-block', background: '#E8540A', color: '#fff', borderRadius: '999px', padding: '0.28rem 0.55rem', fontSize: '0.65rem', fontWeight: 850, textTransform: 'uppercase' }}>CAD visual pending</div>
                <div style={{ color: '#fff', fontWeight: 850, fontSize: '1.1rem', marginTop: '0.55rem' }}>{currentModel?.name}</div>
                <div style={{ color: '#ccc', fontSize: '0.73rem', marginTop: '0.2rem', maxWidth: '580px' }}>The viewer foundation is ready. Add an optimized GLB URL in Manage Catalogue when the China CAD files arrive.</div>
              </div>
            </div>}
          </section>

          <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '9px', padding: '0.8rem', display: 'grid', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#fff', fontSize: '0.82rem' }}>Custom alterations and pricing</strong>
              {!immutable && <div style={{ display: 'flex', gap: '0.4rem' }}><button type="button" onClick={() => addCustomItem('custom')} style={secondaryButton}>Add custom alteration</button><button type="button" onClick={() => addCustomItem('discount')} style={secondaryButton}>Add discount</button></div>}
            </div>
            {draft.customItems.length === 0 && <div style={{ color: '#777', fontSize: '0.73rem' }}>No custom items or owner-approved discounts.</div>}
            {draft.customItems.map((item, index) => (
              <div key={item.id} style={{ display: 'grid', gap: '0.45rem', borderTop: index ? '1px solid #292929' : undefined, paddingTop: index ? '0.65rem' : 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1fr) 120px auto', gap: '0.45rem' }}>
                  <input value={item.description} onChange={event => updateCustomItem(index, { description: event.target.value })} disabled={immutable} placeholder={item.kind === 'discount' ? 'Discount description' : 'Custom alteration description'} style={inputStyle} />
                  <input value={(item.retailPriceCents / 100).toFixed(2)} onChange={event => updateCustomItem(index, { retailPriceCents: dollarsToCents(event.target.value) })} disabled={immutable} aria-label="Retail amount in dollars" style={inputStyle} />
                  <button type="button" onClick={() => removeCustomItem(index)} disabled={immutable} style={secondaryButton}>Remove</button>
                </div>
                <input value={item.reason} onChange={event => updateCustomItem(index, { reason: event.target.value })} disabled={immutable} placeholder="Owner reason required" style={inputStyle} />
                {item.kind === 'custom' && <>
                  <textarea value={item.visualBrief} onChange={event => updateCustomItem(index, { visualBrief: event.target.value })} disabled={immutable} rows={2} placeholder="Required 3D drawing brief — describe exactly what must change visually" style={{ ...inputStyle, resize: 'vertical' }} />
                  <select value={item.drawingStatus} onChange={event => updateCustomItem(index, { drawingStatus: event.target.value as ConfigurationCustomItem['drawingStatus'] })} disabled={immutable} aria-label="3D drawing status" style={inputStyle}>
                    <option value="not_started">3D drawing — not started</option>
                    <option value="requested">3D drawing — requested</option>
                    <option value="in_progress">3D drawing — in progress</option>
                    <option value="ready_for_review">3D drawing — ready for review</option>
                    {item.drawingStatus === 'approved' && <option value="approved">3D drawing — approved in register</option>}
                  </select>
                </>}
              </div>
            ))}
          </section>

          <ConfigurationWorkflowPanel configuration={draft} model={currentModel} onConfiguration={acceptWorkflowConfiguration} />

          <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '9px', padding: '0.8rem', display: 'grid', gap: '0.55rem' }}>
            <strong style={{ color: '#fff', fontSize: '0.82rem' }}>Notes</strong>
            <textarea value={draft.customerNotes} onChange={event => edit({ customerNotes: event.target.value })} disabled={immutable} rows={3} placeholder="Customer-safe notes for the summary" style={{ ...inputStyle, resize: 'vertical' }} />
            <textarea value={draft.ownerNotes} onChange={event => edit({ ownerNotes: event.target.value })} disabled={immutable} rows={3} placeholder="Private owner notes — never shown in the customer summary" style={{ ...inputStyle, resize: 'vertical' }} />
          </section>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '9px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '0.35rem', padding: '0.55rem', overflowX: 'auto', borderBottom: '1px solid #303030' }}>
              {catalogue.categories.map(category => {
                const selectedCount = draft.selectedOptions.filter(selection => catalogue.options.some(option => option.id === selection.optionId && option.categoryId === category.id)).length;
                return <button key={category.id} type="button" onClick={() => setActiveCategoryId(category.id)} style={{ ...secondaryButton, whiteSpace: 'nowrap', background: activeCategoryId === category.id ? '#E8540A' : '#1b1b1b', borderColor: activeCategoryId === category.id ? '#E8540A' : '#3a3a3a' }}>{category.name}{selectedCount ? ` (${selectedCount})` : ''}</button>;
              })}
            </div>
            <div style={{ padding: '0.75rem', display: 'grid', gap: '0.6rem' }}>
              {categoryOptions.length === 0 && <div style={{ color: '#777', fontSize: '0.74rem' }}>No options are configured in this category for the selected model.</div>}
              {categoryOptions.map(option => {
                const selected = selectionFor(option.id);
                const maxQuantity = option.selectionMode === 'quantity' ? Math.max(1, option.maxQuantity || 1) : 1;
                return (
                  <div key={option.id} className="configurator-option-row" style={{ background: selected ? '#20160f' : '#171717', border: `1px solid ${selected ? '#9a4b16' : '#333'}`, borderRadius: '8px', padding: '0.7rem' }}>
                    <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', cursor: immutable ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={Boolean(selected)} onChange={event => setSelection(option.id, event.target.checked)} disabled={immutable} style={{ marginTop: '0.15rem', accentColor: '#E8540A' }} />
                      <span>
                        <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 800 }}>{option.name}</span>
                        <span style={{ color: '#888', fontSize: '0.69rem', lineHeight: 1.4, display: 'block', marginTop: '0.2rem' }}>{option.shortDescription}</span>
                        <span style={{ color: '#fb923c', fontSize: '0.65rem', display: 'block', marginTop: '0.25rem' }}>{statusLabel(option.verificationStatus)}</span>
                      </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      {option.selectionMode === 'quantity' && selected && <><button type="button" onClick={() => updateQuantity(option.id, selected.quantity - 1, maxQuantity)} disabled={immutable} style={{ ...secondaryButton, padding: '0.3rem 0.5rem' }}>−</button><span style={{ color: '#fff', minWidth: '1.5rem', textAlign: 'center', fontSize: '0.78rem' }}>{selected.quantity}</span><button type="button" onClick={() => updateQuantity(option.id, selected.quantity + 1, maxQuantity)} disabled={immutable || selected.quantity >= maxQuantity} style={{ ...secondaryButton, padding: '0.3rem 0.5rem' }}>+</button></>}
                      <strong style={{ color: '#fff', fontSize: '0.78rem', minWidth: '78px', textAlign: 'right' }}>+{money(option.retailPriceDeltaCents * (selected?.quantity || 1))}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ background: '#111', border: '1px solid #303030', borderRadius: '9px', padding: '0.8rem', display: 'grid', gap: '0.48rem' }}>
            <strong style={{ color: '#fff', fontSize: '0.82rem' }}>Commercial summary</strong>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.74rem' }}><span>Base camper</span><span>{qualifiedMoney(evaluation.pricing.basePriceCents, currentModel?.priceQualifier)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.74rem' }}><span>Configured options</span><span>{money(evaluation.pricing.optionsTotalCents)}</span></div>
            {evaluation.pricing.customItemsTotalCents > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.74rem' }}><span>Custom items</span><span>{money(evaluation.pricing.customItemsTotalCents)}</span></div>}
            {evaluation.pricing.discountsTotalCents > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.74rem' }}><span>Discounts</span><span>−{money(evaluation.pricing.discountsTotalCents)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', borderTop: '1px solid #333', paddingTop: '0.5rem', marginTop: '0.1rem', fontSize: '0.9rem', fontWeight: 900 }}><span>Configured total</span><span>{qualifiedMoney(evaluation.pricing.configuredTotalCents, currentModel?.priceQualifier)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#777', fontSize: '0.7rem' }}><span>Internal cost</span><span>{evaluation.pricing.internalCostCents === null ? 'Not entered' : money(evaluation.pricing.internalCostCents)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#777', fontSize: '0.7rem' }}><span>Margin</span><span>{evaluation.pricing.marginCents === null ? 'Awaiting complete costs' : money(evaluation.pricing.marginCents)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#777', fontSize: '0.7rem' }}><span>Configured weight</span><span>{evaluation.weight.configuredWeightKg === null ? 'Awaiting verified weights' : `${evaluation.weight.configuredWeightKg.toLocaleString('en-AU')} kg`}</span></div>
          </section>

          {(evaluation.errors.length || evaluation.warnings.length || evaluation.information.length) ? (
            <section style={{ background: evaluation.errors.length ? '#291313' : '#21170f', border: `1px solid ${evaluation.errors.length ? '#991b1b' : '#9a4b16'}`, borderRadius: '9px', padding: '0.75rem', display: 'grid', gap: '0.3rem' }}>
              <strong style={{ color: '#fff', fontSize: '0.78rem' }}>{evaluation.errors.length ? 'Configuration needs attention' : 'Configuration notices'}</strong>
              {evaluation.errors.map(issue => <div key={`${issue.code}-${issue.ruleId || issue.optionId}`} style={{ color: issueColour('error'), fontSize: '0.71rem' }}>• {issue.message}</div>)}
              {evaluation.warnings.map(issue => <div key={`${issue.code}-${issue.ruleId || issue.optionId}`} style={{ color: issueColour('warning'), fontSize: '0.71rem' }}>• {issue.message}</div>)}
              {evaluation.information.map(issue => <div key={`${issue.code}-${issue.ruleId || issue.optionId}`} style={{ color: issueColour('information'), fontSize: '0.71rem' }}>• {issue.message}</div>)}
            </section>
          ) : <div style={{ background: '#10251a', border: '1px solid #166534', borderRadius: '9px', padding: '0.7rem', color: '#86efac', fontSize: '0.74rem' }}>No selection errors detected by the currently approved rules.</div>}
        </div>
      </div>

      {status && <div style={{ color: /could|fix|error|blocked|changed after/i.test(status) ? '#fb923c' : '#aaa', fontSize: '0.76rem' }}>{status}</div>}

      <div className="configurator-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', position: 'sticky', bottom: 0, background: 'rgba(10,10,10,.96)', borderTop: '1px solid #333', padding: '0.75rem 0', zIndex: 3 }}>
        {!immutable && <button type="button" onClick={() => void save('save')} disabled={loading} style={secondaryButton}>Save Draft</button>}
        {!immutable && persisted && <button type="button" onClick={() => void save('ready_for_review')} disabled={loading} style={secondaryButton}>Ready for Review</button>}
        {!immutable && persisted && <button type="button" onClick={() => void save('approve')} disabled={loading || !evaluation.valid || publishedPriceMismatch || Boolean(catalogueValidation?.errors.length) || draft.customerReview.status !== 'approved'} title={draft.customerReview.status === 'approved' ? 'Lock this customer-approved configuration' : 'Customer approval through the secure review link is required first'} style={{ ...secondaryButton, background: evaluation.valid && !publishedPriceMismatch && draft.customerReview.status === 'approved' ? '#E8540A' : '#333', borderColor: evaluation.valid && !publishedPriceMismatch && draft.customerReview.status === 'approved' ? '#E8540A' : '#444' }}>Approve Internal Configuration</button>}
        {persisted && <button type="button" onClick={() => openSummary()} style={secondaryButton}>Customer Preview</button>}
        {persisted && <button type="button" onClick={() => openSummary(true)} style={secondaryButton}>Print / Save PDF</button>}
        {persisted && <a href={`/.netlify/functions/admin-configuration-summary?id=${encodeURIComponent(draft.id)}&download=1`} style={{ ...secondaryButton, textDecoration: 'none' }}>Download HTML</a>}
        {persisted && <button type="button" onClick={() => void copyConfiguration('duplicate')} disabled={loading} style={secondaryButton}>Duplicate</button>}
        {draft.status === 'approved' && <button type="button" onClick={() => void createContractDraft()} disabled={loading || !catalogueReadyForContracts} title={catalogueReadyForContracts ? 'Create a linked contract draft' : 'Owner approval of the pilot catalogue is required first'} style={{ ...secondaryButton, background: catalogueReadyForContracts ? '#166534' : '#333', borderColor: catalogueReadyForContracts ? '#15803d' : '#444' }}>Create Contract Draft{catalogueReadyForContracts ? '' : ' — catalogue approval required'}</button>}
        {draft.linkedContractIds.length > 0 && onOpenContracts && <button type="button" onClick={onOpenContracts} style={{ ...secondaryButton, background: '#166534', borderColor: '#15803d' }}>Open Contracts</button>}
        {immutable && <button type="button" onClick={() => void copyConfiguration('revise')} disabled={loading} style={{ ...secondaryButton, background: '#1d4ed8', borderColor: '#2563eb' }}>Create Revision</button>}
      </div>
    </div>
  );
}
