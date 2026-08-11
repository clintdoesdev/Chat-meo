import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEmbeddedSignupUrl, chunkWhatsAppText, verifyWebhookSignature } from "./meta-graph";

const APP_SECRET = "test-app-secret-do-not-use-in-production";

function signatureFor(rawBody: string, secret = APP_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a signature computed with the correct secret", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    expect(verifyWebhookSignature(rawBody, signatureFor(rawBody), APP_SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    expect(verifyWebhookSignature(rawBody, signatureFor(rawBody, "wrong-secret"), APP_SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const original = JSON.stringify({ entry: [{ id: "1" }] });
    const signature = signatureFor(original);
    const tampered = JSON.stringify({ entry: [{ id: "2" }] });
    expect(verifyWebhookSignature(tampered, signature, APP_SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookSignature("{}", null, APP_SECRET)).toBe(false);
  });

  it("rejects a header missing the sha256= prefix", () => {
    const rawBody = "{}";
    const bareHex = createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex");
    expect(verifyWebhookSignature(rawBody, bareHex, APP_SECRET)).toBe(false);
  });

  it("rejects a malformed (non-hex, wrong-length) signature without throwing", () => {
    expect(() => verifyWebhookSignature("{}", "sha256=not-hex-and-too-short", APP_SECRET)).not.toThrow();
    expect(verifyWebhookSignature("{}", "sha256=not-hex-and-too-short", APP_SECRET)).toBe(false);
  });
});

describe("chunkWhatsAppText", () => {
  it("returns a single chunk for text under the limit", () => {
    expect(chunkWhatsAppText("hello", 100)).toEqual(["hello"]);
  });

  it("splits text over the limit into multiple chunks, none exceeding it", () => {
    const text = "a".repeat(250);
    const chunks = chunkWhatsAppText(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
    expect(chunks.join("")).toBe(text);
  });

  it("prefers splitting on a space near the limit over a mid-word cut", () => {
    const text = `${"word ".repeat(20)}tail`; // lots of spaces well before a 30-char limit
    const chunks = chunkWhatsAppText(text, 30);
    for (const chunk of chunks) {
      expect(chunk.endsWith(" ")).toBe(false); // trimmed
    }
    expect(chunks.every((c) => c.length <= 30)).toBe(true);
  });
});

describe("buildEmbeddedSignupUrl", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.META_APP_ID = "test-app-id";
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_CONFIG_ID = "test-config-id";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds Meta's OAuth dialog URL with the app id, config id, and caller-supplied redirect/state", () => {
    const url = new URL(
      buildEmbeddedSignupUrl({ redirectUri: "https://chatmeo.app/api/whatsapp/connect/callback", state: "bot123.nonce456" }),
    );
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toMatch(/\/dialog\/oauth$/);
    expect(url.searchParams.get("client_id")).toBe("test-app-id");
    expect(url.searchParams.get("config_id")).toBe("test-config-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://chatmeo.app/api/whatsapp/connect/callback");
    expect(url.searchParams.get("state")).toBe("bot123.nonce456");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("override_default_response_type")).toBe("true");
  });

  it("throws when Meta app config is missing rather than building a broken URL", () => {
    delete process.env.META_APP_ID;
    expect(() => buildEmbeddedSignupUrl({ redirectUri: "https://chatmeo.app/callback", state: "x" })).toThrow(
      /META_APP_ID/,
    );
  });
});
