import { describe, expect, it } from "vitest";
import {
  extractAccountEvents,
  extractInboundMessages,
  extractInboundReactions,
  extractStatusUpdates,
} from "./webhook-payload";

function textMessagePayload(overrides?: {
  type?: string;
  body?: string;
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  video?: { id: string; caption?: string };
  audio?: { id: string };
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15551234567", phone_number_id: "PHONE_ID_1" },
              contacts: [{ profile: { name: "Jane" }, wa_id: "CUSTOMER_1" }],
              messages: [
                {
                  from: "CUSTOMER_1",
                  id: "wamid.ABC",
                  timestamp: "1700000000",
                  type: overrides?.type ?? "text",
                  ...(overrides?.type && overrides.type !== "text"
                    ? {}
                    : { text: { body: overrides?.body ?? "Hello there" } }),
                  ...(overrides?.image ? { image: overrides.image } : {}),
                  ...(overrides?.document ? { document: overrides.document } : {}),
                  ...(overrides?.video ? { video: overrides.video } : {}),
                  ...(overrides?.audio ? { audio: overrides.audio } : {}),
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

describe("extractInboundMessages", () => {
  it("extracts a plain text message", () => {
    const result = extractInboundMessages(textMessagePayload());
    expect(result).toEqual([
      {
        phoneNumberId: "PHONE_ID_1",
        from: "CUSTOMER_1",
        waMessageId: "wamid.ABC",
        isText: true,
        content: "Hello there",
        media: null,
        receivedAt: new Date(1700000000 * 1000),
      },
    ]);
  });

  it("marks a message type with no media field as unsupported, with a placeholder and isText: false", () => {
    const result = extractInboundMessages(textMessagePayload({ type: "location" }));
    expect(result).toEqual([
      {
        phoneNumberId: "PHONE_ID_1",
        from: "CUSTOMER_1",
        waMessageId: "wamid.ABC",
        isText: false,
        content: "[unsupported message type: location]",
        media: null,
        receivedAt: new Date(1700000000 * 1000),
      },
    ]);
  });

  it("extracts an image message's media id and caption", () => {
    const payload = textMessagePayload({ type: "image", image: { id: "MEDIA_ID_1", caption: "check this out" } });
    const result = extractInboundMessages(payload);
    expect(result).toEqual([
      {
        phoneNumberId: "PHONE_ID_1",
        from: "CUSTOMER_1",
        waMessageId: "wamid.ABC",
        isText: false,
        content: "[image]",
        media: { kind: "IMAGE", mediaId: "MEDIA_ID_1", caption: "check this out", fileName: null },
        receivedAt: new Date(1700000000 * 1000),
      },
    ]);
  });

  it("extracts an image message with no caption as null", () => {
    const payload = textMessagePayload({ type: "image", image: { id: "MEDIA_ID_1" } });
    const result = extractInboundMessages(payload);
    expect(result[0].media?.caption).toBeNull();
  });

  it("extracts a document message's media id, filename, and caption", () => {
    const payload = textMessagePayload({
      type: "document",
      document: { id: "MEDIA_ID_2", filename: "invoice.pdf", caption: "here's the invoice" },
    });
    const result = extractInboundMessages(payload);
    expect(result).toEqual([
      {
        phoneNumberId: "PHONE_ID_1",
        from: "CUSTOMER_1",
        waMessageId: "wamid.ABC",
        isText: false,
        content: "[document]",
        media: { kind: "DOCUMENT", mediaId: "MEDIA_ID_2", caption: "here's the invoice", fileName: "invoice.pdf" },
        receivedAt: new Date(1700000000 * 1000),
      },
    ]);
  });

  it("extracts a video message's media id and caption", () => {
    const payload = textMessagePayload({ type: "video", video: { id: "MEDIA_ID_3", caption: "watch this" } });
    const result = extractInboundMessages(payload);
    expect(result[0].media).toEqual({ kind: "VIDEO", mediaId: "MEDIA_ID_3", caption: "watch this", fileName: null });
  });

  it("extracts an audio message's media id with no caption", () => {
    const payload = textMessagePayload({ type: "audio", audio: { id: "MEDIA_ID_4" } });
    const result = extractInboundMessages(payload);
    expect(result[0].media).toEqual({ kind: "AUDIO", mediaId: "MEDIA_ID_4", caption: null, fileName: null });
    expect(result[0].content).toBe("[audio]");
  });

  it("parses Meta's epoch-seconds timestamp into a real Date", () => {
    const payload = textMessagePayload();
    const result = extractInboundMessages(payload);
    expect(result[0].receivedAt).toBeInstanceOf(Date);
    expect(result[0].receivedAt.getTime()).toBe(1700000000 * 1000);
  });

  it("falls back to the current time when timestamp is missing or malformed", () => {
    const payload = textMessagePayload();
    // @ts-expect-error deliberately malformed for this test
    delete payload.entry[0].changes[0].value.messages[0].timestamp;
    const before = Date.now();
    const result = extractInboundMessages(payload);
    const after = Date.now();
    expect(result[0].receivedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result[0].receivedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("ignores status-update deliveries (no messages array)", () => {
    const statusPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PHONE_ID_1" },
                statuses: [{ id: "wamid.ABC", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    expect(extractInboundMessages(statusPayload)).toEqual([]);
  });

  it("skips a change with no metadata.phone_number_id", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "CUSTOMER_1", id: "wamid.ABC", type: "text", text: { body: "hi" } }],
              },
            },
          ],
        },
      ],
    };
    expect(extractInboundMessages(payload)).toEqual([]);
  });

  it("handles multiple entries/changes/messages in one delivery", () => {
    const payload = {
      entry: [
        textMessagePayload().entry[0],
        {
          id: "waba-2",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PHONE_ID_2" },
                messages: [
                  { from: "CUSTOMER_2", id: "wamid.DEF", type: "text", text: { body: "second" } },
                  { from: "CUSTOMER_3", id: "wamid.GHI", type: "text", text: { body: "third" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const result = extractInboundMessages(payload);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.waMessageId)).toEqual(["wamid.ABC", "wamid.DEF", "wamid.GHI"]);
  });

  it("returns an empty array for a malformed payload rather than throwing", () => {
    expect(extractInboundMessages(null)).toEqual([]);
    expect(extractInboundMessages("not an object")).toEqual([]);
    expect(extractInboundMessages({})).toEqual([]);
  });

  it("skips reaction-type entries entirely (see extractInboundReactions)", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "PHONE_ID_1" },
                messages: [
                  { from: "CUSTOMER_1", id: "wamid.REACT", type: "reaction", reaction: { message_id: "wamid.ABC", emoji: "👍" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(extractInboundMessages(payload)).toEqual([]);
  });
});

function reactionPayload(reaction: { message_id: string; emoji?: string }) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "PHONE_ID_1" },
              messages: [{ from: "CUSTOMER_1", id: "wamid.REACT", type: "reaction", reaction }],
            },
          },
        ],
      },
    ],
  };
}

describe("extractInboundReactions", () => {
  it("extracts a reaction with its emoji", () => {
    const result = extractInboundReactions(reactionPayload({ message_id: "wamid.ABC", emoji: "👍" }));
    expect(result).toEqual([
      { phoneNumberId: "PHONE_ID_1", from: "CUSTOMER_1", targetWaMessageId: "wamid.ABC", emoji: "👍" },
    ]);
  });

  it("represents a removed reaction (no emoji) as an empty string", () => {
    const result = extractInboundReactions(reactionPayload({ message_id: "wamid.ABC" }));
    expect(result).toEqual([
      { phoneNumberId: "PHONE_ID_1", from: "CUSTOMER_1", targetWaMessageId: "wamid.ABC", emoji: "" },
    ]);
  });

  it("ignores non-reaction messages", () => {
    expect(extractInboundReactions(textMessagePayload())).toEqual([]);
  });

  it("returns an empty array for a malformed payload rather than throwing", () => {
    expect(extractInboundReactions(null)).toEqual([]);
  });
});

describe("extractStatusUpdates", () => {
  function statusPayload(statuses: { id: string; status: string }[]) {
    return {
      entry: [
        {
          changes: [{ value: { metadata: { phone_number_id: "PHONE_ID_1" }, statuses } }],
        },
      ],
    };
  }

  it("extracts a delivered status update", () => {
    const result = extractStatusUpdates(statusPayload([{ id: "wamid.OUT", status: "delivered" }]));
    expect(result).toEqual([{ phoneNumberId: "PHONE_ID_1", waMessageId: "wamid.OUT", status: "delivered" }]);
  });

  it("extracts multiple status updates from one delivery", () => {
    const result = extractStatusUpdates(
      statusPayload([
        { id: "wamid.OUT1", status: "sent" },
        { id: "wamid.OUT2", status: "read" },
      ]),
    );
    expect(result.map((s) => [s.waMessageId, s.status])).toEqual([
      ["wamid.OUT1", "sent"],
      ["wamid.OUT2", "read"],
    ]);
  });

  it("ignores an unrecognized status value", () => {
    expect(extractStatusUpdates(statusPayload([{ id: "wamid.OUT", status: "bogus" }]))).toEqual([]);
  });

  it("returns an empty array for a malformed payload rather than throwing", () => {
    expect(extractStatusUpdates(null)).toEqual([]);
  });
});

describe("extractAccountEvents", () => {
  function accountUpdatePayload(value: Record<string, unknown>, wabaId = "waba-1") {
    return { entry: [{ id: wabaId, changes: [{ field: "account_update", value }] }] };
  }

  it("reports BANNED for banned_info.waba_ban_state DISABLE", () => {
    const result = extractAccountEvents(accountUpdatePayload({ banned_info: { waba_ban_state: "DISABLE" } }));
    expect(result).toEqual([{ wabaId: "waba-1", kind: "BANNED", detail: "DISABLE" }]);
  });

  it("reports BANNED for a bare event: DISABLED with no banned_info", () => {
    const result = extractAccountEvents(accountUpdatePayload({ event: "DISABLED" }));
    expect(result).toEqual([{ wabaId: "waba-1", kind: "BANNED", detail: "DISABLED" }]);
  });

  it("reports REINSTATED for banned_info.waba_ban_state REINSTATE", () => {
    const result = extractAccountEvents(accountUpdatePayload({ banned_info: { waba_ban_state: "REINSTATE" } }));
    expect(result).toEqual([{ wabaId: "waba-1", kind: "REINSTATED", detail: "REINSTATE" }]);
  });

  it("ignores an account_update change with neither a recognized ban state nor event", () => {
    expect(extractAccountEvents(accountUpdatePayload({ event: "PARTNER_APP_INSTALLED" }))).toEqual([]);
  });

  it("ignores non-account_update fields (e.g. messages)", () => {
    const payload = { entry: [{ id: "waba-1", changes: [{ field: "messages", value: { event: "DISABLED" } }] }] };
    expect(extractAccountEvents(payload)).toEqual([]);
  });

  it("skips an entry with no id", () => {
    const payload = { entry: [{ changes: [{ field: "account_update", value: { event: "DISABLED" } }] }] };
    expect(extractAccountEvents(payload)).toEqual([]);
  });

  it("returns an empty array for a malformed payload rather than throwing", () => {
    expect(extractAccountEvents(null)).toEqual([]);
    expect(extractAccountEvents("not an object")).toEqual([]);
    expect(extractAccountEvents({})).toEqual([]);
  });
});
