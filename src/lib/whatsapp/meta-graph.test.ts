import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEmbeddedSignupUrl,
  chunkWhatsAppText,
  MetaGraphError,
  sendWhatsAppImageMessage,
  sendWhatsAppTextMessage,
  toWhatsAppText,
  verifyWebhookSignature,
} from "./meta-graph";

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

describe("toWhatsAppText", () => {
  it("converts a Markdown link with bold link text into plain \"label: url\"", () => {
    // Regression: exactly the shape a Logic rule reply produced in production — a bold label
    // wrapping a markdown link — which showed up on WhatsApp as literal asterisks and brackets.
    const markdown =
      "Here is your secure payment link: [**Click here to complete your registration for ₦14,500**](https://vireonwebsite.com.ng/payments)";
    expect(toWhatsAppText(markdown)).toBe(
      "Here is your secure payment link: Click here to complete your registration for ₦14,500: https://vireonwebsite.com.ng/payments",
    );
  });

  it("uses the bare url when the link label just repeats it", () => {
    expect(toWhatsAppText("[https://example.com/pay](https://example.com/pay)")).toBe("https://example.com/pay");
  });

  it("strips bold markers without leaving stray asterisks", () => {
    expect(toWhatsAppText("*Surveys:* Up to £5 each.")).toBe("Surveys: Up to £5 each.");
    expect(toWhatsAppText("**Surveys:** Up to £5 each.")).toBe("Surveys: Up to £5 each.");
  });

  it("converts markdown bullets to a plain bullet character", () => {
    expect(toWhatsAppText("- Surveys\n- Remote work\n* Referrals")).toBe("• Surveys\n• Remote work\n• Referrals");
  });

  it("strips headings, strikethrough, and inline code markers", () => {
    expect(toWhatsAppText("# Welcome\nSome ~~old~~ new text and `code`.")).toBe(
      "Welcome\nSome old new text and code.",
    );
  });

  it("leaves plain text with no markdown untouched", () => {
    expect(toWhatsAppText("Hey there! How can I help today?")).toBe("Hey there! How can I help today?");
  });

  it("leaves a lone, unpaired asterisk alone rather than eating the rest of the message", () => {
    expect(toWhatsAppText("5*3=15, easy math.")).toBe("5*3=15, easy math.");
  });
});

describe("sendWhatsAppTextMessage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("attaches context.message_id to the first chunk when replying to a message", async () => {
    const bodies: unknown[] = [];
    global.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.new" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await sendWhatsAppTextMessage("PHONE_ID", "15551234567", "Sure, here's the info.", "token-123", "wamid.original");

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ context: { message_id: "wamid.original" } });
  });

  it("attaches the reply context only to the first of several chunks", async () => {
    const bodies: unknown[] = [];
    global.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.new" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await sendWhatsAppTextMessage("PHONE_ID", "15551234567", "a".repeat(5000), "token-123", "wamid.original");

    expect(bodies.length).toBeGreaterThan(1);
    expect((bodies[0] as { context?: unknown }).context).toEqual({ message_id: "wamid.original" });
    for (const body of bodies.slice(1)) {
      expect((body as { context?: unknown }).context).toBeUndefined();
    }
  });

  it("omits context entirely when not replying to anything", async () => {
    const bodies: unknown[] = [];
    global.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.new" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await sendWhatsAppTextMessage("PHONE_ID", "15551234567", "Hello there.", "token-123");

    expect((bodies[0] as { context?: unknown }).context).toBeUndefined();
  });
});

describe("sendWhatsAppImageMessage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uploads the image bytes then sends an image message referencing the returned media id", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: input.toString(), init: init ?? {} });
      if (calls.length === 1) {
        return new Response(JSON.stringify({ id: "media-123" }), { status: 200 });
      }
      return new Response(JSON.stringify({ messages: [{ id: "wamid.abc" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await sendWhatsAppImageMessage(
      "PHONE_ID",
      "15551234567",
      "data:image/png;base64,AAAA",
      "A caption",
      "token-123",
    );

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/PHONE_ID/media");
    expect(calls[1].url).toContain("/PHONE_ID/messages");
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({
      messaging_product: "whatsapp",
      to: "15551234567",
      type: "image",
      image: { id: "media-123", caption: "A caption" },
    });
  });

  it("omits the caption field entirely when none is given", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: input.toString(), init: init ?? {} });
      if (calls.length === 1) return new Response(JSON.stringify({ id: "media-123" }), { status: 200 });
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await sendWhatsAppImageMessage("PHONE_ID", "15551234567", "data:image/png;base64,AAAA", undefined, "token-123");

    const sentBody = JSON.parse(calls[1].init.body as string);
    expect(sentBody.image).toEqual({ id: "media-123" });
  });

  it("throws without attempting a network call when given a malformed data URI", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      sendWhatsAppImageMessage("PHONE_ID", "15551234567", "not-a-data-uri", undefined, "token-123"),
    ).rejects.toThrow(MetaGraphError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("surfaces a MetaGraphError when the media upload itself fails", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "Invalid file" } }), { status: 400 }),
    ) as unknown as typeof fetch;

    await expect(
      sendWhatsAppImageMessage("PHONE_ID", "15551234567", "data:image/png;base64,AAAA", undefined, "token-123"),
    ).rejects.toThrow(/Invalid file/);
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
