import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireMobileUser, signMobileToken, verifyMobileToken } from "./token";

describe("mobile-auth/token", () => {
  const originalSecret = process.env.MOBILE_API_JWT_SECRET;

  beforeEach(() => {
    process.env.MOBILE_API_JWT_SECRET = "test-secret-test-secret-test-secret";
  });

  afterEach(() => {
    process.env.MOBILE_API_JWT_SECRET = originalSecret;
  });

  it("round-trips a signed token back to the same userId", async () => {
    const token = await signMobileToken("user-123");
    const userId = await verifyMobileToken(token);
    expect(userId).toBe("user-123");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signMobileToken("user-123");
    process.env.MOBILE_API_JWT_SECRET = "a-completely-different-secret-value";
    const userId = await verifyMobileToken(token);
    expect(userId).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    const userId = await verifyMobileToken("not-a-real-token");
    expect(userId).toBeNull();
  });

  it("throws a clear error when MOBILE_API_JWT_SECRET isn't configured", async () => {
    delete process.env.MOBILE_API_JWT_SECRET;
    await expect(signMobileToken("user-123")).rejects.toThrow("MOBILE_API_JWT_SECRET");
  });

  describe("requireMobileUser", () => {
    it("extracts the userId from a valid Bearer header", async () => {
      const token = await signMobileToken("user-456");
      const request = new Request("https://example.com/api/v1/bots", {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(await requireMobileUser(request)).toBe("user-456");
    });

    it("returns null when the Authorization header is missing", async () => {
      const request = new Request("https://example.com/api/v1/bots");
      expect(await requireMobileUser(request)).toBeNull();
    });

    it("returns null for a non-Bearer Authorization header", async () => {
      const request = new Request("https://example.com/api/v1/bots", {
        headers: { authorization: "Basic dXNlcjpwYXNz" },
      });
      expect(await requireMobileUser(request)).toBeNull();
    });

    it("returns null for an empty Bearer token", async () => {
      const request = new Request("https://example.com/api/v1/bots", {
        headers: { authorization: "Bearer " },
      });
      expect(await requireMobileUser(request)).toBeNull();
    });
  });
});
