import { describe, expect, it } from "vitest";
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
});
