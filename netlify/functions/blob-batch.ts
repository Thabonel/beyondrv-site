/**
 * Netlify Blobs has no batch read, so a store of N records costs N network
 * calls. Firing them all at once saturates connections and invites throttling,
 * which makes a large store slower than a bounded pool would.
 *
 * Results keep input order regardless of which calls finish first.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  // A limit of zero would stall forever; treat any nonsense value as serial.
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let next = 0;

  async function drain() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workers }, drain));
  return results;
}

/**
 * Narrows a list to the items that already have a blob in the store.
 *
 * Reading a key that was never written still costs a round trip, so listing the
 * store once and skipping the misses is cheaper than asking for each in turn.
 * `keyFor` must produce the same key the writer used, encoding included.
 */
export function selectExistingKeys<T>(
  items: readonly T[],
  keyFor: (item: T) => string,
  existing: Iterable<string>,
): T[] {
  const stored = existing instanceof Set ? existing : new Set(existing);
  if (stored.size === 0) return [];
  return items.filter((item) => stored.has(keyFor(item)));
}
