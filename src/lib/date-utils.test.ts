import { describe, expect, it } from "vitest";
import { startOfCurrentMonth } from "./date-utils";

describe("startOfCurrentMonth", () => {
  it("returns midnight UTC on the 1st of the current month when no timezone is given", () => {
    const result = startOfCurrentMonth();
    const now = new Date();
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCHours()).toBe(0);
  });

  it("returns midnight in the given timezone's own calendar, not UTC's", () => {
    // Lagos is UTC+1 year-round (no DST) — a clean, simple zone to assert an exact offset against.
    const result = startOfCurrentMonth("Africa/Lagos");
    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(result);
    const get = (type: string) => localParts.find((p) => p.type === type)?.value;
    expect(get("day")).toBe("01");
    expect(get("hour")).toBe("00");
  });
});
