import type { SearchRecord } from '../lib/search.ts';

function page(id: string, title: string, summary: string, url: string, kind: 'guide' | 'tool'): SearchRecord {
  return { id, title, summary, url, kind, category: '', price: '', keywords: [] };
}

/**
 * Guides and calculators are .astro pages with no content collection, so they
 * are listed here. Add a row when you add a guide, or search will not find it.
 */
export const SEARCH_PAGES: SearchRecord[] = [
  page(
    'guides',
    'Slide-On Camper Guides and Weight Tools',
    'Australian guides and tools covering ute suitability, payload, tray fit, GVM and axle limits.',
    '/guides/',
    'guide',
  ),
  page(
    'guides/best-utes-for-slide-on-campers',
    'Best Utes for Slide-On Campers',
    'What makes a ute suitable for a slide-on camper: payload, GVM, tray size, axle limits and suspension.',
    '/guides/best-utes-for-slide-on-campers/',
    'guide',
  ),
  page(
    'guides/gvm-gcm-atm-gtm-explained',
    'GVM, GCM, ATM and GTM Explained',
    'Plain-English guide to GVM, GCM, ATM, GTM, payload, tare and tow ball download for Australian buyers.',
    '/guides/gvm-gcm-atm-gtm-explained/',
    'guide',
  ),
  page(
    'caravan-towing-calculator',
    'Caravan Towing Calculator',
    'Estimate whether your tow vehicle suits a Beyond RV caravan using GVM, GCM, braked towing capacity and tow ball download.',
    '/caravan-towing-calculator/',
    'tool',
  ),
  page(
    'slide-on-camper-weight-calculator',
    'Slide-On Camper Weight Calculator',
    'Estimate whether your ute has the payload, GVM margin and tray size for a slide-on camper.',
    '/slide-on-camper-weight-calculator/',
    'tool',
  ),
  page(
    'vehicle-suitability-checker',
    'Vehicle Suitability Checker',
    'Check whether your ute suits a slide-on camper, or whether your vehicle can tow a Beyond RV caravan.',
    '/vehicle-suitability-checker/',
    'tool',
  ),
];
