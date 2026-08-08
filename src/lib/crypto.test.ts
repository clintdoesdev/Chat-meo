import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

const ORIGINAL_KEY = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;

describe("encrypt/decrypt", () => {
  beforeEach(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = "test-key-do-not-use-in-production";
  });

  afterEach(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("round-trips a plaintext value", () => {
    const plaintext = "EAAG1234567890abcdefWhatsAppAccessToken";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV), but both still decrypt correctly", () => {
    const plaintext = "same-input-twice";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("throws instead of silently encrypting with an empty key when the env var is unset", () => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt("secret")).toThrow(/WHATSAPP_TOKEN_ENCRYPTION_KEY/);
  });
});
