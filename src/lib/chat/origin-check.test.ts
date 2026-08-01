import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isChatRequestAllowed, isOriginAllowed, isOwnHost, resolveEmbedHostname } from "./origin-check";

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

describe("isChatRequestAllowed", () => {
  it("allows any hostname while in test mode with no domains configured", () => {
    expect(isChatRequestAllowed("anywhere.example", { allowedDomains: [], testMode: true })).toBe(true);
    expect(isChatRequestAllowed(null, { allowedDomains: [], testMode: true })).toBe(true);
  });

  it("rejects everything once test mode is off and no domains are configured", () => {
    expect(isChatRequestAllowed("anywhere.example", { allowedDomains: [], testMode: false })).toBe(false);
    expect(isChatRequestAllowed(null, { allowedDomains: [], testMode: false })).toBe(false);
  });

  it("defers to the normal allowlist once domains are configured, regardless of test mode", () => {
    expect(isChatRequestAllowed("example.com", { allowedDomains: ["example.com"], testMode: true })).toBe(
      true,
    );
    expect(isChatRequestAllowed("evil.example", { allowedDomains: ["example.com"], testMode: true })).toBe(
      false,
    );
    expect(isChatRequestAllowed("example.com", { allowedDomains: ["example.com"], testMode: false })).toBe(
      true,
    );
  });
});

describe("resolveEmbedHostname", () => {
  it("prefers the X-Embed-Host header (what the widget iframe actually reports)", () => {
    const request = new NextRequest("https://chatmeo.example/api/chat", {
      headers: { "x-embed-host": "Example.com", origin: "https://chatmeo.example" },
    });
    expect(resolveEmbedHostname(request)).toBe("example.com");
  });

  it("falls back to the Origin header when X-Embed-Host is absent", () => {
    const request = new NextRequest("https://chatmeo.example/api/chat", {
      headers: { origin: "https://caller.example" },
    });
    expect(resolveEmbedHostname(request)).toBe("caller.example");
  });

  it("falls back to the Referer header when neither is present", () => {
    const request = new NextRequest("https://chatmeo.example/api/chat", {
      headers: { referer: "https://referring.example/page" },
    });
    expect(resolveEmbedHostname(request)).toBe("referring.example");
  });

  it("returns null when nothing is available", () => {
    const request = new NextRequest("https://chatmeo.example/api/chat");
    expect(resolveEmbedHostname(request)).toBeNull();
  });
});

describe("isOwnHost", () => {
  it("matches the request's own Host header, ignoring port", () => {
    const request = new NextRequest("https://chatmeo.example/api/chat", {
      headers: { host: "chatmeo.example:3000" },
    });
    expect(isOwnHost("chatmeo.example", request)).toBe(true);
    expect(isOwnHost("someone-else.example", request)).toBe(false);
  });

  it("returns false for a null hostname", () => {
    const request = new NextRequest("https://chatmeo.example/api/chat", {
      headers: { host: "chatmeo.example" },
    });
    expect(isOwnHost(null, request)).toBe(false);
  });
});
