import { getBlobStore } from './blob-store';
import { getConfiguratorCatalogue } from '../../src/lib/configurator/catalogue';
import { validateConfiguratorCatalogue } from '../../src/lib/configurator/engine';
import type { ConfiguratorCatalogue } from '../../src/lib/configurator/types';

export const CONFIGURATOR_CATALOGUE_STORE = 'byondrv-configurator-catalogue';
export const CONFIGURATOR_CATALOGUE_KEY = 'catalogue/current.json';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normaliseCatalogueDraft(value: unknown, now = new Date()): ConfiguratorCatalogue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Catalogue payload must be an object.');
  const draft = clone(value as ConfiguratorCatalogue);
  const versionBase = typeof draft.catalogueVersion === 'string' && draft.catalogueVersion.trim()
    ? draft.catalogueVersion.trim().slice(0, 120)
    : 'operational';
  draft.schemaVersion = '1.0';
  draft.catalogueVersion = `${versionBase.replace(/-\d{8}T\d{6}Z$/, '')}-${now.toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;
  draft.readiness = 'owner_review';
  draft.publishedAt = now.toISOString();
  draft.currency = 'AUD';
  draft.taxTreatment = 'gst_inclusive';
  return draft;
}

export async function getEffectiveConfiguratorCatalogue() {
  const fallback = getConfiguratorCatalogue();
  try {
    const store = getBlobStore(CONFIGURATOR_CATALOGUE_STORE);
    const stored = await store.get(CONFIGURATOR_CATALOGUE_KEY, { type: 'json' }) as ConfiguratorCatalogue | null;
    if (!stored) return { catalogue: fallback, source: 'bundled' as const, validation: validateConfiguratorCatalogue(fallback) };
    const validation = validateConfiguratorCatalogue(stored);
    if (!validation.valid) return { catalogue: fallback, source: 'bundled_invalid_override' as const, validation, storedCatalogue: stored };
    return { catalogue: stored, source: 'operational' as const, validation };
  } catch {
    return { catalogue: fallback, source: 'bundled' as const, validation: validateConfiguratorCatalogue(fallback) };
  }
}
