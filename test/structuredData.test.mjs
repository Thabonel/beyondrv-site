import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMerchantProduct, buildProductSku } from '../src/lib/structuredData.js';

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
  assert.equal(product.manufacturer?.name, 'Beyond RV');
  assert.equal(product.sku, buildProductSku('our-caravans/sunpatch-12c-couples-caravan'));
  assert.ok(String(product.sku).length <= 23);
  assert.equal(product.offers?.hasMerchantReturnPolicy?.returnPolicyCategory, 'https://schema.org/MerchantReturnNotPermitted');
  assert.equal(product.offers?.shippingDetails?.shippingRate?.currency, 'AUD');
});
