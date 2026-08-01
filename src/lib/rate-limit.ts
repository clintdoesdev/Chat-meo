// Interfaced so an in-memory limiter (fine for a single instance) can be swapped for a
// Redis-backed one later without touching call sites.
export type RateLimiter = {
  /** Returns true if the request under `key` is allowed, false if it should be rejected. */
  consume(key: string): Promise<boolean>;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
/** Sweep expired entries once the map grows past this, so long-lived processes with many
 * distinct visitors don't leak memory indefinitely. */
const SWEEP_THRESHOLD = 10_000;

type Window = { count: number; windowStart: number };

export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, Window>();

  constructor(
    private readonly windowMs = WINDOW_MS,
    private readonly maxRequests = MAX_REQUESTS_PER_WINDOW,
  ) {}

  async consume(key: string): Promise<boolean> {
    const now = Date.now();

    if (this.hits.size > SWEEP_THRESHOLD) {
      for (const [existingKey, window] of this.hits) {
        if (now - window.windowStart >= this.windowMs) this.hits.delete(existingKey);
      }
    }

    const existing = this.hits.get(key);
    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (existing.count >= this.maxRequests) return false;
    existing.count += 1;
    return true;
  }
}

/** Shared instance for the public chat endpoint's per-visitor rate limit. */
export const chatRateLimiter: RateLimiter = new InMemoryRateLimiter();
