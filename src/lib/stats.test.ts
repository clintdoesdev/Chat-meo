import { afterEach, describe, expect, it, vi } from "vitest";
import { chatsStartedBuckets } from "./stats";

const DAY_MS = 86_400_000;

function utcMidnight(daysAgo: number): Date {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayUtc - daysAgo * DAY_MS);
}

describe("chatsStartedBuckets", () => {
  it("counts each conversation once per matching window, not by message volume", () => {
    const dates = [
      new Date(utcMidnight(0).getTime() + 60_000), // today, just after midnight
      utcMidnight(1), // yesterday, exactly at midnight
      utcMidnight(3), // within the trailing 7 days, not today/yesterday
      utcMidnight(10), // within the trailing 30 days, not within 7
      utcMidnight(40), // outside every window
    ];

    const result = chatsStartedBuckets(dates);

    expect(result.today).toBe(1);
    expect(result.yesterday).toBe(1);
    expect(result.last7Days).toBe(3); // today + yesterday + the day-3 entry
    expect(result.last30Days).toBe(4); // everything except the 40-day-old one
  });

  it("returns all zeros for an empty list", () => {
    expect(chatsStartedBuckets([])).toEqual({ today: 0, yesterday: 0, last7Days: 0, last30Days: 0 });
  });

  it("excludes a conversation exactly at the 7-day boundary's start from last7Days when it's actually 8 days old", () => {
    const result = chatsStartedBuckets([utcMidnight(7)]);
    expect(result.last7Days).toBe(0);
    expect(result.last30Days).toBe(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts 'today' against the given timezone's own midnight, not UTC's", () => {
    // Pinned rather than derived from the real clock — this exact mismatch (a message sent in the
    // first few hours of the UTC day is still "yesterday" evening in New York, UTC-4 in EDT) only
    // exists for part of the real day, so an unpinned "now" made this test flaky depending on when
    // the suite happened to run. Noon UTC keeps "now" itself unambiguously the same calendar day
    // in both zones, isolating the one instant actually under test.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T12:00:00.000Z"));

    const earlyUtcMorning = new Date("2024-03-15T01:00:00.000Z");

    const utcResult = chatsStartedBuckets([earlyUtcMorning], "UTC");
    expect(utcResult.today).toBe(1);

    const nyResult = chatsStartedBuckets([earlyUtcMorning], "America/New_York");
    expect(nyResult.today).toBe(0);
    expect(nyResult.yesterday).toBe(1);
  });
});
