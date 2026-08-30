import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeadline, TimeBudgetExceededError, withTimeBudget } from '../netlify/functions/time-budget.ts';

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => resolve('done'), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    });
  });
}

test('work that finishes inside the budget returns its result', async () => {
  const result = await withTimeBudget('analytics', 100, () => Promise.resolve('ready'));

  assert.equal(result, 'ready');
});

test('work that outruns the budget throws a time budget error naming the label', async () => {
  await assert.rejects(
    () => withTimeBudget('analytics', 10, (signal) => delay(5_000, signal)),
    (error: unknown) => {
      assert.ok(error instanceof TimeBudgetExceededError);
      assert.match((error as Error).message, /analytics/);
      return true;
    },
  );
});

test('the budget aborts the signal so abandoned work stops holding sockets open', async () => {
  let aborted = false;

  await assert.rejects(() => withTimeBudget('insights', 10, (signal) => {
    signal.addEventListener('abort', () => { aborted = true; });
    // Work that ignores the signal, so the abort is observed rather than obeyed.
    return new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 5_000).unref();
    });
  }));

  assert.equal(aborted, true);
});

test('work rejecting inside the budget surfaces its own error, not a budget error', async () => {
  await assert.rejects(
    () => withTimeBudget('insights', 1_000, () => Promise.reject(new Error('openai exploded'))),
    /openai exploded/,
  );
});

// A late rejection from abandoned work would otherwise crash the function process
// well after the dashboard response has been sent.
test('work rejecting after the budget expires does not raise an unhandled rejection', async () => {
  const unhandled: unknown[] = [];
  const capture = (reason: unknown) => unhandled.push(reason);
  process.on('unhandledRejection', capture);

  try {
    await assert.rejects(() => withTimeBudget('insights', 10, () => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('late failure')), 40);
    })));
    await delay(120);
  } finally {
    process.off('unhandledRejection', capture);
  }

  assert.deepEqual(unhandled, []);
});

test('a budget with no time left fails without starting the work', async () => {
  let started = false;

  await assert.rejects(() => withTimeBudget('insights', 0, () => {
    started = true;
    return Promise.resolve('ready');
  }), TimeBudgetExceededError);

  assert.equal(started, false);
});

test('a deadline reports the time left for the dependencies that follow', async () => {
  const deadline = createDeadline(200);
  const atStart = deadline.remainingMs();
  await delay(60);
  const afterWork = deadline.remainingMs();

  assert.ok(atStart > 150 && atStart <= 200, `unexpected starting budget: ${atStart}`);
  assert.ok(afterWork < atStart, 'remaining time should shrink as work runs');
});

test('a deadline never reports negative time left', async () => {
  const deadline = createDeadline(10);
  await delay(40);

  assert.equal(deadline.remainingMs(), 0);
});
