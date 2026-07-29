import assert from 'node:assert/strict';
import test from 'node:test';
import { croppedImageSrcSet, croppedImageUrl } from '../src/lib/media.ts';

test('cropped homepage images request exact 16:10 dimensions from Netlify', () => {
  const url = croppedImageUrl('/images/site/example.webp', 840);
  assert.equal(url, '/.netlify/images?url=%2Fimages%2Fsite%2Fexample.webp&w=840&h=525&fit=cover');
});

test('cropped image srcsets preserve the declared candidate widths', () => {
  const srcset = croppedImageSrcSet('/images/site/example.webp', [480, 840]);
  assert.match(srcset, /w=480&h=300&fit=cover 480w/);
  assert.match(srcset, /w=840&h=525&fit=cover 840w/);
});
