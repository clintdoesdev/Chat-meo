import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStreamingGrokLlm, FALLBACK_REPLY, grokLlm } from "./llm";

describe("grokLlm / createStreamingGrokLlm without a configured key", () => {
  const originalKey = process.env.XAI_API_KEY;

  beforeEach(() => {
    delete process.env.XAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = originalKey;
    }
  });

  it("grokLlm resolves to the fallback reply instead of throwing", async () => {
    const result = await grokLlm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" });
    expect(result).toBe(FALLBACK_REPLY);
  });

  it("createStreamingGrokLlm invokes onChunk with the fallback and resolves the same text", async () => {
    const chunks: string[] = [];
    const llm = createStreamingGrokLlm((delta) => chunks.push(delta));
    const result = await llm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" });

    expect(chunks).toEqual([FALLBACK_REPLY]);
    expect(result).toBe(FALLBACK_REPLY);
  });
});
