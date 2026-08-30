/**
 * A dependency that ran out of its time budget. Callers already catch failures
 * from these dependencies and fall back, so a timeout arrives as an ordinary
 * error rather than a separate code path.
 */
export class TimeBudgetExceededError extends Error {
  readonly label: string;
  readonly budgetMs: number;

  constructor(label: string, budgetMs: number) {
    super(`${label} exceeded its ${budgetMs}ms time budget`);
    this.name = 'TimeBudgetExceededError';
    this.label = label;
    this.budgetMs = budgetMs;
  }
}

const EXPIRED = Symbol('time-budget-expired');

/**
 * Runs optional work under a deadline so one slow dependency cannot sink the
 * whole response.
 *
 * The signal lets the work cancel itself and release its sockets; the race
 * guarantees the caller is released even when the work ignores the signal.
 */
export async function withTimeBudget<T>(
  label: string,
  budgetMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  // Earlier dependencies can leave nothing for this one. Starting work that has
  // no time to finish only delays the response further.
  if (budgetMs <= 0) throw new TimeBudgetExceededError(label, budgetMs);

  const controller = new AbortController();
  let expire: ReturnType<typeof setTimeout> | undefined;
  let expired = false;

  const running = work(controller.signal);
  // The race can settle before the work does, leaving its rejection unobserved
  // and crashing the process long after the response has been sent.
  running.catch(() => {});

  const expiry = new Promise<typeof EXPIRED>((resolve) => {
    expire = setTimeout(() => {
      expired = true;
      controller.abort();
      resolve(EXPIRED);
    }, budgetMs);
  });

  try {
    const result = await Promise.race([running, expiry]);
    if (result !== EXPIRED) return result as T;
  } catch (error) {
    // Work that aborts cooperatively rejects with its own error. Report the
    // budget instead, so callers can tell "too slow" from "broken".
    if (!expired) throw error;
  } finally {
    clearTimeout(expire);
  }

  throw new TimeBudgetExceededError(label, budgetMs);
}

/**
 * A shared deadline for one request. Per-dependency budgets bound each call, but
 * only a deadline keeps their total under the limit the platform enforces.
 */
export function createDeadline(totalMs: number): Deadline {
  const expiresAt = Date.now() + totalMs;
  return {
    remainingMs: () => Math.max(0, expiresAt - Date.now()),
  };
}

export interface Deadline {
  remainingMs: () => number;
}
