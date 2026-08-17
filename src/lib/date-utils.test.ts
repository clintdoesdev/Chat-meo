import { describe, expect, it } from "vitest";
import { startOfCurrentMonth } from "./date-utils";

describe("startOfCurrentMonth", () => {
  it("returns midnight UTC on the 1st of the current month", () => {
    const result = startOfCurrentMonth();
    const now = new Date();
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCHours()).toBe(0);
  });
});
