import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMerchantProduct, buildProductSku, buildProductOffer, normalizeAvailability } from '../src/lib/structuredData.js';

test('merchant product schema includes required merchant listing fields', () => {
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
  assert.equal(product.offers?.hasMerchantReturnPolicy, undefined);
  assert.equal(product.offers?.shippingDetails, undefined);
  assert.equal(product.offers?.priceValidUntil, undefined);
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
