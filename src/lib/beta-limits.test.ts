import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["BETA_MESSAGE_CAP", "BETA_BOT_CAP"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  vi.resetModules();
});

describe("beta limit env parsing", () => {
  it("falls back to sensible defaults when unset", async () => {
    delete process.env.BETA_MESSAGE_CAP;
    delete process.env.BETA_BOT_CAP;
    const { BETA_MESSAGE_CAP, BETA_BOT_CAP } = await import("./beta-limits");
    expect(BETA_MESSAGE_CAP).toBe(500);
    expect(BETA_BOT_CAP).toBe(2);
  });

  it("reads a valid override from the environment", async () => {
    process.env.BETA_MESSAGE_CAP = "1000";
    process.env.BETA_BOT_CAP = "5";
    const { BETA_MESSAGE_CAP, BETA_BOT_CAP } = await import("./beta-limits");
    expect(BETA_MESSAGE_CAP).toBe(1000);
    expect(BETA_BOT_CAP).toBe(5);
  });

  it("falls back to the default for a non-numeric or non-positive value", async () => {
    process.env.BETA_MESSAGE_CAP = "not-a-number";
    process.env.BETA_BOT_CAP = "-3";
    const { BETA_MESSAGE_CAP, BETA_BOT_CAP } = await import("./beta-limits");
    expect(BETA_MESSAGE_CAP).toBe(500);
    expect(BETA_BOT_CAP).toBe(2);
  });
});

describe("startOfCurrentMonth", () => {
  it("returns midnight UTC on the 1st of the current month", async () => {
    const { startOfCurrentMonth } = await import("./beta-limits");
    const result = startOfCurrentMonth();
    const now = new Date();
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCHours()).toBe(0);
  });
});
