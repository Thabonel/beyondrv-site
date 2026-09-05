import type { ModelPages } from '../src/lib/vehicleModelPages/types.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { validateModelPages } from '../src/lib/vehicleModelPages/validate.ts';
import { answerParagraph, rearAxleHeadroom } from '../src/lib/vehicleModelPages/fitment.ts';
const pages: ModelPages = JSON.parse(readFileSync('src/data/vehicle-selector/model-pages.json', 'utf8'));

test('generator preserves every source row and resolves all 36 models', () => {
  const dir = mkdtempSync(join(tmpdir(), 'model-pages-'));
  try {
    const out = join(dir, 'pages.json');
    execFileSync(process.execPath, ['--experimental-strip-types', 'SCRIPTS/build-vehicle-model-pages.mjs', '--out', out]);
    const data: ModelPages = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(validateModelPages(data), []);
    assert.equal(data.models.length, 36);
    const variants = data.models.flatMap(m => m.variants);
    assert.equal(variants.length, 208);
    assert.equal(variants.filter(v => v.kind === 'light').length, 163);
    assert.equal(variants.filter(v => v.kind === 'heavy').length, 45);
    const ids = JSON.parse(execFileSync('sqlite3', ['-json', 'data/vehicle-selector/australian-slide-on-vehicles.sqlite', 'select id from vehicle_variants union all select id from heavy_overland_chassis'], { encoding: 'utf8' })).map((r: { id: string }) => r.id).sort();
    assert.deepEqual(variants.map(v => v.id).sort(), ids);
    assert.ok(data.models.every(m => m.coverageId && m.platform && m.fitmentMode));
    assert.ok(data.models.every(m => m.variants.every(v => m.sources.some(s => s.id === v.sourceId))));
    const committed = JSON.parse(readFileSync('src/data/vehicle-selector/model-pages.json', 'utf8'));
    assert.deepEqual({ ...data, generatedAt: '' }, { ...committed, generatedAt: '' });
    const invalid = structuredClone(data);
    invalid.models[0].variants[0].sourceId = 'missing';
    assert.ok(validateModelPages(invalid).length > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('generator fails on unresolved coverage instead of silently dropping a model', () => {
  const dir = mkdtempSync(join(tmpdir(), 'missing-coverage-'));
  const aliases = join(dir, 'aliases.json');
  writeFileSync(aliases, '{}');
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'SCRIPTS/build-vehicle-model-pages.mjs', '--aliases', aliases], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /coverage/i);
});

test('a single-variant model reads as one variant, not "1 recorded variants"', () => {
  const single = pages.models.filter(m => m.variants.length === 1);
  for (const model of single) {
    assert.equal(answerParagraph(model).includes('1 recorded variants'), false, `${model.slug} pluralises a single variant`);
    assert.equal(answerParagraph(model).includes('1 recorded variant.') || answerParagraph(model).includes('1 recorded variant '), true, `${model.slug} lost its variant count`);
  }
});

test('a model with no recorded mass says payload cannot be calculated, not "unavailable"', () => {
  for (const model of pages.models) {
    const paragraph = answerParagraph(model);
    if (model.variants.every(v => v.kerbKg === null)) {
      assert.match(paragraph, /cannot be calculated from it/, `${model.slug} substitutes unavailable into the arithmetic sentence`);
    }
    assert.equal(paragraph.includes('minus that mass is unavailable'), false, `${model.slug} claims arithmetic on a missing mass`);
  }
});

test('offline sources carry no URL and every online source keeps one', () => {
  for (const model of pages.models) {
    for (const source of model.sources) {
      if (source.sourceType === 'manufacturer_manual') assert.equal(source.url, '', `${source.id} is offline but has a URL`);
      else assert.match(source.url, /^https?:\/\//, `${source.id} has no usable URL`);
    }
  }
});

test('the U1700L record reconciles against the Army data summary', () => {
  const model = pages.models.find(m => m.slug === 'mercedes-benz-unimog-u1700l');
  assert.ok(model, 'U1700L page is missing');
  const noWinch = model.variants.find(v => v.id === 'unimog-u1700l-cargo-no-winch');
  assert.ok(noWinch && noWinch.kind === 'heavy', 'the unwinched U1700L record is missing');
  assert.equal(noWinch.gvmKg, 12000);
  assert.equal(noWinch.kerbKg, 6600);
  assert.equal(noWinch.calculatedPayloadKg, 5400);
  assert.equal(noWinch.chassisCabFrontMassKg! + noWinch.chassisCabRearMassKg!, noWinch.kerbKg);
  assert.equal(rearAxleHeadroom(noWinch.rearGawrKg, noWinch.chassisCabRearMassKg), 4210);
  for (const v of model.variants) assert.equal(v.trayState, 'included', `${v.id} lost its tray state`);
});
