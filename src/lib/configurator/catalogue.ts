import rawCatalogue from '../../data/configurator/catalogue.json' with { type: 'json' };
import { validateConfiguratorCatalogue } from './engine.ts';
import type { ConfiguratorCatalogue } from './types.ts';

export const CONFIGURATOR_CATALOGUE = rawCatalogue as ConfiguratorCatalogue;

export function getConfiguratorCatalogue() {
  const validation = validateConfiguratorCatalogue(CONFIGURATOR_CATALOGUE);
  if (!validation.valid) {
    throw new Error(`Configurator catalogue is invalid: ${validation.errors.join(' ')}`);
  }
  return CONFIGURATOR_CATALOGUE;
}
