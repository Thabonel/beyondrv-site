import assert from 'node:assert/strict';
import test from 'node:test';
import { mapWithConcurrency, selectExistingKeys } from '../netlify/functions/blob-batch.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

test('results come back in input order, not completion order', async () => {
  const items = [30, 10, 20, 0];

  const results = await mapWithConcurrency(items, 4, async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return ms;
  });

  assert.deepEqual(results, [30, 10, 20, 0]);
});

// Netlify Blobs is a network call per key. Firing hundreds at once saturates
// connections and gets throttled, which is what this bound exists to prevent.
test('no more than the limit are in flight at once', async () => {
  const items = Array.from({ length: 25 }, (_, index) => index);
  let inFlight = 0;
  let peak = 0;

  await mapWithConcurrency(items, 4, async (item) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return item;
  });

  assert.equal(peak, 4, `peak concurrency was ${peak}`);
});

test('work starts as soon as a slot frees, rather than in fixed batches', async () => {
  const gate = deferred();
  const started: number[] = [];

  const run = mapWithConcurrency([0, 1, 2], 2, async (item) => {
    started.push(item);
    if (item === 0) await gate.promise;
    return item;
  });

  await new Promise((resolve) => setTimeout(resolve, 10));
  // Item 1 finished immediately, so item 2 should already have taken its slot
  // even though item 0 is still blocked.
  assert.deepEqual(started, [0, 1, 2]);

  gate.resolve();
  await run;
});

test('an empty list does no work', async () => {
  let calls = 0;

  const results = await mapWithConcurrency([], 4, async () => { calls += 1; return 1; });

  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});

test('a limit below one still makes progress instead of stalling', async () => {
  const results = await mapWithConcurrency([1, 2, 3], 0, async (item) => item * 2);

  assert.deepEqual(results, [2, 4, 6]);
});

test('a failing worker rejects the whole call', async () => {
  await assert.rejects(
    () => mapWithConcurrency([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error('blob read failed');
      return item;
    }),
    /blob read failed/,
  );
});

// A lead status blob exists only once someone sets a status, so most enquiries
// have none. Fetching a miss for each one is a network call that buys nothing.
test('only items whose blob already exists are selected for fetching', () => {
  const enquiries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const stored = ['lead-status/a.json', 'lead-status/c.json'];

  const wanted = selectExistingKeys(enquiries, (enquiry) => `lead-status/${enquiry.id}.json`, stored);

  assert.deepEqual(wanted.map((enquiry) => enquiry.id), ['a', 'c']);
});

test('nothing stored means nothing is fetched', () => {
  const wanted = selectExistingKeys([{ id: 'a' }], (enquiry) => `lead-status/${enquiry.id}.json`, []);

  assert.deepEqual(wanted, []);
});

// The keys are URL encoded when written, so the selector has to compare the
// encoded form or every status silently disappears from the dashboard.
test('keys needing encoding still match what is stored', () => {
  const enquiries = [{ id: 'a b/c' }];
  const keyFor = (enquiry: { id: string }) => `lead-status/${encodeURIComponent(enquiry.id)}.json`;

  const wanted = selectExistingKeys(enquiries, keyFor, [keyFor(enquiries[0])]);

  assert.deepEqual(wanted.map((enquiry) => enquiry.id), ['a b/c']);
});
