/**
 * Simple in-memory sliding-window rate limiter.
 * Single-node only — swap for Redis-backed implementation when scaling out
 * (interface stays the same).
 */
type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { hits: [] };
    buckets.set(key, b);
  }
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    const oldest = b.hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000),
    };
  }
  b.hits.push(now);
  // opportunistic cleanup
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.hits.length === 0 || now - v.hits[v.hits.length - 1] > windowMs) {
        buckets.delete(k);
      }
    }
  }
  return { ok: true, remaining: limit - b.hits.length, retryAfterSec: 0 };
}
