import type { WorkspaceEnquiry, WorkspaceProduct } from './sales-workspace-core.ts';

function text(value: unknown, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normaliseWords(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function priceToCents(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  const raw = text(value);
  if (!raw || /poa|contact|tba/i.test(raw)) return 0;
  const match = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1]) * 100) : 0;
}

export function findTrustedEnquiryProduct(enquiry: WorkspaceEnquiry, products: WorkspaceProduct[]) {
  const interest = normaliseWords(enquiry.product_interest);
  if (!interest) return null;
  const exact = products.filter(product => [normaliseWords(product.title), normaliseWords(product.slug)].includes(interest));
  if (exact.length === 1) return exact[0];
  if (interest.length < 8) return null;
  const uniqueContained = products.filter(product => {
    const title = normaliseWords(product.title);
    const slug = normaliseWords(product.slug);
    return title.includes(interest) || interest.includes(title) || slug.includes(interest) || interest.includes(slug);
  });
  return uniqueContained.length === 1 ? uniqueContained[0] : null;
}

export function buildAgreementInputFromEnquiry(enquiry: WorkspaceEnquiry, products: WorkspaceProduct[], now = new Date()) {
  const product = findTrustedEnquiryProduct(enquiry, products);
  const basePriceCents = priceToCents(product?.price);
  return {
    sourceEnquiryId: enquiry.id,
    opportunityId: `opportunity:${enquiry.id}`,
    leadId: enquiry.id,
    status: 'draft',
    buyer: {
      name: text(enquiry.name, 180), organisation: '', address: '', phone: text(enquiry.phone, 80), email: text(enquiry.email, 240).toLowerCase(),
    },
    product: {
      slug: product?.slug ?? '', name: product?.title ?? '', category: product?.category ?? '', buildIdentifier: '', dimensions: '', weights: '',
    },
    lineItems: product ? [{ id: 'base', description: product.title, quantity: 1, unitPriceCents: basePriceCents, kind: 'base', reason: '' }] : [],
    specificationSections: [],
    exclusions: [],
    deliveryNotes: '',
    validityDate: '',
    salesContext: {
      source: 'website_enquiry',
      sourceReference: enquiry.id,
      enquiryMessage: text(enquiry.message),
      statedProductInterest: text(enquiry.product_interest, 500),
      submittedAt: text(enquiry.received_at || enquiry.submittedAt, 80),
      capturedAt: now.toISOString(),
    },
  };
}
