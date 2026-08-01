import { describe, expect, it } from "vitest";
import { isOriginAllowed } from "./origin-check";

describe("isOriginAllowed", () => {
  it("allows any origin when no domains are configured yet", () => {
    expect(isOriginAllowed("https://evil.example", [])).toBe(true);
    expect(isOriginAllowed(null, [])).toBe(true);
  });

  it("rejects a missing Origin header once domains are configured", () => {
    expect(isOriginAllowed(null, ["example.com"])).toBe(false);
  });

  it("matches an exact hostname, ignoring scheme and port", () => {
    expect(isOriginAllowed("https://example.com", ["example.com"])).toBe(true);
    expect(isOriginAllowed("https://example.com:8443", ["https://example.com"])).toBe(true);
  });

  it("rejects a hostname that isn't in the allowlist", () => {
    expect(isOriginAllowed("https://not-allowed.com", ["example.com"])).toBe(false);
  });

  it("matches subdomains against a *.domain.com wildcard entry", () => {
    expect(isOriginAllowed("https://widget.example.com", ["*.example.com"])).toBe(true);
    expect(isOriginAllowed("https://example.com", ["*.example.com"])).toBe(true);
    expect(isOriginAllowed("https://example.com.evil.net", ["*.example.com"])).toBe(false);
  });

  it("rejects a malformed Origin header instead of throwing", () => {
    expect(isOriginAllowed("not-a-url", ["example.com"])).toBe(false);
  });
});
