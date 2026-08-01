import { describe, expect, it, vi } from "vitest";
import { InMemoryRateLimiter } from "./rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows requests under the limit and rejects once it's exceeded", async () => {
    const limiter = new InMemoryRateLimiter(60_000, 3);
    expect(await limiter.consume("visitor-a")).toBe(true);
    expect(await limiter.consume("visitor-a")).toBe(true);
    expect(await limiter.consume("visitor-a")).toBe(true);
    expect(await limiter.consume("visitor-a")).toBe(false);
  });

  it("tracks separate keys independently", async () => {
    const limiter = new InMemoryRateLimiter(60_000, 1);
    expect(await limiter.consume("visitor-a")).toBe(true);
    expect(await limiter.consume("visitor-b")).toBe(true);
    expect(await limiter.consume("visitor-a")).toBe(false);
    expect(await limiter.consume("visitor-b")).toBe(false);
  });

  it("resets the count once the window elapses", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new InMemoryRateLimiter(1_000, 1);
      expect(await limiter.consume("visitor-a")).toBe(true);
      expect(await limiter.consume("visitor-a")).toBe(false);
      vi.advanceTimersByTime(1_001);
      expect(await limiter.consume("visitor-a")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
