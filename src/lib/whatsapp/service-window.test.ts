import { describe, expect, it } from "vitest";
import { isWithinServiceWindow, WHATSAPP_SERVICE_WINDOW_MS } from "./service-window";

const NOW = new Date("2026-01-02T00:00:00.000Z");

describe("isWithinServiceWindow", () => {
  it("is false when there's no recorded inbound message at all", () => {
    expect(isWithinServiceWindow(null, NOW)).toBe(false);
  });

  it("is true right at the moment of the inbound message", () => {
    expect(isWithinServiceWindow(NOW, NOW)).toBe(true);
  });

  it("is true just under 24 hours after the last inbound message", () => {
    const lastInboundAt = new Date(NOW.getTime() - WHATSAPP_SERVICE_WINDOW_MS + 1000);
    expect(isWithinServiceWindow(lastInboundAt, NOW)).toBe(true);
  });

  it("is true exactly at the 24 hour boundary (inclusive)", () => {
    const lastInboundAt = new Date(NOW.getTime() - WHATSAPP_SERVICE_WINDOW_MS);
    expect(isWithinServiceWindow(lastInboundAt, NOW)).toBe(true);
  });

  it("is false just over 24 hours after the last inbound message", () => {
    const lastInboundAt = new Date(NOW.getTime() - WHATSAPP_SERVICE_WINDOW_MS - 1000);
    expect(isWithinServiceWindow(lastInboundAt, NOW)).toBe(false);
  });

  it("is false for a last inbound message from days ago", () => {
    const lastInboundAt = new Date(NOW.getTime() - 5 * WHATSAPP_SERVICE_WINDOW_MS);
    expect(isWithinServiceWindow(lastInboundAt, NOW)).toBe(false);
  });
});
