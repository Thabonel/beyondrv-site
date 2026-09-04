import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const seedDir = join(root, 'data/vehicle-selector');
const committed = join(seedDir, 'australian-slide-on-vehicles.sqlite');

/** Every INSERT the database would emit, sorted, so order cannot cause a false failure. */
function dumpRows(databasePath: string): string[] {
  const out = execFileSync('sqlite3', [databasePath, '.dump'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\n').filter((line) => line.startsWith('INSERT')).sort();
}

// The Hino research on 1 September was written into the built database and never
// back into the seed. Rebuilding therefore dropped two chassis, their source and
// a coverage row, and build-database.sh reported success while doing it. Nothing
// caught that for three days.
test('rebuilding from the seed reproduces the committed database', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'vehicle-seed-'));
  const rebuilt = join(workDir, 'rebuilt.sqlite');
  try {
    for (const script of ['schema.sql', 'seed.sql']) {
      execFileSync('sqlite3', [rebuilt, `.read ${join(seedDir, script)}`], { encoding: 'utf8' });
    }

    const fromSeed = dumpRows(rebuilt);
    const fromCommitted = dumpRows(committed);

    // A control: an empty rebuild would otherwise match an empty comparison.
    assert.ok(fromSeed.length > 200, `the rebuild produced only ${fromSeed.length} rows`);

    const missing = fromCommitted.filter((row) => !fromSeed.includes(row));
    const extra = fromSeed.filter((row) => !fromCommitted.includes(row));
    const summarise = (rows: string[]) => rows.map((row) => row.slice(0, 100)).join('\n');
    assert.deepEqual(
      { missing: missing.length, extra: extra.length },
      { missing: 0, extra: 0 },
      `the seed no longer rebuilds the committed database.\nmissing:\n${summarise(missing)}\nextra:\n${summarise(extra)}`,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
