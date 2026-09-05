import type { ModelPages } from '../src/lib/vehicleModelPages/types.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { validateModelPages } from '../src/lib/vehicleModelPages/validate.ts';

test('generator preserves every source row and resolves all 35 models', () => {
  const dir = mkdtempSync(join(tmpdir(), 'model-pages-'));
  try {
    const out = join(dir, 'pages.json');
    execFileSync(process.execPath, ['--experimental-strip-types', 'SCRIPTS/build-vehicle-model-pages.mjs', '--out', out]);
    const data: ModelPages = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(validateModelPages(data), []);
    assert.equal(data.models.length, 35);
    const variants = data.models.flatMap(m => m.variants);
    assert.equal(variants.length, 206);
    assert.equal(variants.filter(v => v.kind === 'light').length, 163);
    assert.equal(variants.filter(v => v.kind === 'heavy').length, 43);
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
