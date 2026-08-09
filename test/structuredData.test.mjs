import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMerchantProduct, buildProductSku, buildProductOffer, normalizeAvailability } from '../src/lib/structuredData.js';
import {
  buildOrganizationSchema,
  MERCHANT_RETURN_POLICY_ID,
  MERCHANT_SHIPPING_SERVICE_ID,
} from '../src/data/siteIdentity.js';

test('merchant product schema includes merchant listing fields and policy references', () => {
  const product = buildMerchantProduct({
    slug: 'our-caravans/sunpatch-12c-couples-caravan',
    name: 'Sunpatch 12C Couples Off-Road Van',
    description: 'Compact off-road caravan for couples.',
    url: 'https://beyondrv.com.au/our-caravans/sunpatch-12c-couples-caravan/',
    image: 'https://beyondrv.com.au/images/example.webp',
    price: '$99,000',
    status: 'available',
    availability: 'available_in_australia',
    category: 'Off-Road Caravans',
  });

  assert.equal(product['@type'], 'Product');
  assert.equal(product.name, 'Sunpatch 12C Couples Off-Road Van');
  assert.equal(product.description, 'Compact off-road caravan for couples.');
  assert.equal(product.image, 'https://beyondrv.com.au/images/example.webp');
  assert.equal(product.brand?.name, 'Beyond RV');
  assert.equal(product.manufacturer, undefined);
  assert.equal(product.sku, buildProductSku('our-caravans/sunpatch-12c-couples-caravan'));
  assert.ok(String(product.sku).length <= 23);
  assert.equal(product.offers?.availability, 'https://schema.org/InStock');
  assert.equal(product.offers?.seller?.['@id'], 'https://beyondrv.com.au/#organization');
  assert.equal(product.offers?.hasMerchantReturnPolicy?.['@id'], MERCHANT_RETURN_POLICY_ID);
  assert.equal(product.offers?.shippingDetails?.['@type'], 'OfferShippingDetails');
  assert.equal(product.offers?.shippingDetails?.hasShippingService?.['@id'], MERCHANT_SHIPPING_SERVICE_ID);
  assert.equal(product.offers?.shippingDetails?.shippingRate, undefined);
  assert.equal(product.offers?.shippingDetails?.deliveryTime, undefined);
  assert.equal(product.offers?.priceValidUntil, undefined);
});

test('organization schema defines truthful global merchant policies', () => {
  const organization = buildOrganizationSchema();
  const returnPolicy = organization.hasMerchantReturnPolicy;
  const shippingService = organization.hasShippingService;

  assert.equal(returnPolicy?.['@type'], 'MerchantReturnPolicy');
  assert.equal(returnPolicy?.['@id'], MERCHANT_RETURN_POLICY_ID);
  assert.equal(returnPolicy?.merchantReturnLink, 'https://beyondrv.com.au/shipping-and-returns/#returns');
  assert.equal(returnPolicy?.returnPolicyCategory, undefined);
  assert.equal(returnPolicy?.merchantReturnDays, undefined);

  assert.equal(shippingService?.['@type'], 'ShippingService');
  assert.equal(shippingService?.['@id'], MERCHANT_SHIPPING_SERVICE_ID);
  assert.equal(shippingService?.shippingConditions?.shippingDestination?.addressCountry, 'AU');
  assert.equal(shippingService?.shippingConditions?.shippingRate, undefined);
  assert.equal(shippingService?.shippingConditions?.transitTime, undefined);
});

test('merchant product schema is omitted when no genuine offer price exists', () => {
  const product = buildMerchantProduct({
    slug: 'expedition/example-build',
    name: 'Example custom expedition build',
    description: 'A made-to-order expedition build.',
    url: 'https://beyondrv.com.au/expedition/example-build/',
    image: 'https://beyondrv.com.au/images/example.webp',
    price: 'POA',
    status: 'available',
    availability: 'made_to_order',
    category: 'Expedition Vehicles',
  });

  assert.equal(product, undefined);
});

test('offer availability values are normalized to schema.org URLs', () => {
  assert.equal(normalizeAvailability('made-to-order'), 'https://schema.org/PreOrder');
  assert.equal(normalizeAvailability('sold_out'), 'https://schema.org/SoldOut');
  assert.equal(normalizeAvailability('https://schema.org/OutOfStock'), 'https://schema.org/OutOfStock');

  const offer = buildProductOffer({
    price: '$100,000',
    status: 'coming-soon',
    url: 'https://beyondrv.com.au/example/',
  });
  assert.equal(offer?.availability, 'https://schema.org/PreOrder');
});
