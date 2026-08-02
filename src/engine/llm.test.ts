import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStreamingProviderLlm, providerLlm } from "./llm";

describe("providerLlm / createStreamingProviderLlm without a configured key", () => {
  const originalKey = process.env.XAI_API_KEY;
  const originalProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = originalKey;
    }
    if (originalProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalProvider;
    }
  });

  it("providerLlm throws a descriptive error instead of silently returning a generic reply", async () => {
    await expect(
      providerLlm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/XAI_API_KEY is not configured/);
  });

  it("createStreamingProviderLlm throws the same way, without ever invoking onChunk", async () => {
    const chunks: string[] = [];
    const llm = createStreamingProviderLlm((delta) => chunks.push(delta));

    await expect(
      llm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/XAI_API_KEY is not configured/);
    expect(chunks).toEqual([]);
  });
});
