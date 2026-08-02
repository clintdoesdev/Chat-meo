import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStreamingGrokLlm, grokLlm } from "./llm";

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

  it("grokLlm throws a descriptive error instead of silently returning a generic reply", async () => {
    await expect(
      grokLlm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/XAI_API_KEY is not configured/);
  });

  it("createStreamingGrokLlm throws the same way, without ever invoking onChunk", async () => {
    const chunks: string[] = [];
    const llm = createStreamingGrokLlm((delta) => chunks.push(delta));

    await expect(
      llm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/XAI_API_KEY is not configured/);
    expect(chunks).toEqual([]);
  });
});
