import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptTraySizeSubmission, mapWithConcurrency, recordTraySizeWithRetry } from '../netlify/functions/tray-size-core.ts';

const isCabChassis = (id: string) => id === 'ford-ranger-cc';

test('a valid submission for a cab chassis is accepted', () => {
  const result = acceptTraySizeSubmission({ variantId: 'ford-ranger-cc', lengthMm: 2100, widthMm: 1800 }, isCabChassis);
  assert.deepEqual(result, { ok: true, variantId: 'ford-ranger-cc', lengthMm: 2100, widthMm: 1800 });
});

test('a variant the catalogue has never heard of is rejected', () => {
  assert.equal(acceptTraySizeSubmission({ variantId: 'not-real', lengthMm: 2100, widthMm: 1800 }, isCabChassis).ok, false);
});

test('a tub vehicle is rejected, because its dimensions are already known', () => {
  assert.equal(acceptTraySizeSubmission({ variantId: 'ford-f150-tub', lengthMm: 2100, widthMm: 1800 }, isCabChassis).ok, false);
});

test('an implausible size is rejected before it reaches the store', () => {
  assert.equal(acceptTraySizeSubmission({ variantId: 'ford-ranger-cc', lengthMm: 18000, widthMm: 1800 }, isCabChassis).ok, false);
});

test('a missing variant id is rejected', () => {
  assert.equal(acceptTraySizeSubmission({ lengthMm: 2100, widthMm: 1800 }, isCabChassis).ok, false);
});

// A fake store: enough of the blob API to exercise the compare-and-set loop.
function fakeStore(initial: { data: any; etag: string } | null) {
  let stored = initial;
  let writes = 0;
  return {
    writes: () => writes,
    current: () => stored,
    async getWithMetadata() {
      return stored ? { data: stored.data, etag: stored.etag } : null;
    },
    async setJSON(_key: string, data: any, options: { onlyIfMatch?: string; onlyIfNew?: boolean }) {
      writes += 1;
      const matches = options.onlyIfNew ? stored === null : stored?.etag === options.onlyIfMatch;
      if (!matches) return { modified: false };
      stored = { data, etag: `etag-${writes}` };
      return { modified: true, etag: stored.etag };
    },
    // Simulate another writer landing between our read and our write.
    interleave(data: any) { stored = { data, etag: `other-${Math.random()}` }; },
  };
}

test('a first report is written with onlyIfNew, so a concurrent create cannot be clobbered', async () => {
  const store = fakeStore(null);
  const result = await recordTraySizeWithRetry(store as any, 'ford-ranger-cc', 2100, 1800, () => '2026-08-21T00:00:00.000Z');

  assert.equal(result.ok, true);
  assert.equal(store.current()!.data.totalReports, 1);
});

test('a report that loses a race is retried rather than lost', async () => {
  const store = fakeStore({ data: { variantId: 'ford-ranger-cc', sizes: [], totalReports: 0, updatedAt: 'x' }, etag: 'v1' });
  let interleaved = false;
  const stealTheWrite = () => {
    if (!interleaved) {
      interleaved = true;
      // Another customer's report lands after we read but before we write.
      store.interleave({
        variantId: 'ford-ranger-cc',
        sizes: [{ lengthMm: 2400, widthMm: 1800, reports: 1, firstReportedAt: 'a', lastReportedAt: 'a' }],
        totalReports: 1,
        updatedAt: 'a',
      });
    }
    return '2026-08-21T00:00:00.000Z';
  };

  const result = await recordTraySizeWithRetry(store as any, 'ford-ranger-cc', 2100, 1800, stealTheWrite);

  assert.equal(result.ok, true);
  // Both reports survive: the other customer's 2400 and our 2100.
  assert.equal(store.current()!.data.totalReports, 2);
  assert.equal(store.current()!.data.sizes.length, 2);
});

test('a write that keeps losing gives up rather than looping forever', async () => {
  const store = fakeStore({ data: { variantId: 'ford-ranger-cc', sizes: [], totalReports: 0, updatedAt: 'x' }, etag: 'v1' });
  const alwaysSteal = () => {
    store.interleave({ variantId: 'ford-ranger-cc', sizes: [], totalReports: 0, updatedAt: 'a' });
    return '2026-08-21T00:00:00.000Z';
  };

  const result = await recordTraySizeWithRetry(store as any, 'ford-ranger-cc', 2100, 1800, alwaysSteal);

  assert.equal(result.ok, false);
});

test('a JSON body that is not an object is rejected, not crashed on', () => {
  // JSON.parse('null') succeeds, so the try/catch around it does not help.
  for (const body of [null, undefined, 'a string', 42, [1, 2, 3]]) {
    const result = acceptTraySizeSubmission(body, isCabChassis);
    assert.equal(result.ok, false, `${JSON.stringify(body)} should be rejected`);
  }
});

test('reads run concurrently but never more than the limit at once', async () => {
  let inFlight = 0;
  let peak = 0;
  const read = async (n: number) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return n * 2;
  };

  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, read);

  assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14], 'order is preserved');
  assert.ok(peak > 1, 'reads must overlap, or this is still serial');
  assert.ok(peak <= 3, `peak concurrency was ${peak}, above the limit of 3`);
});

test('mapping an empty list does no work', async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async () => 1), []);
});
