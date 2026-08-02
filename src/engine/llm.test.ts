import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROVIDERS, type ActiveProvider } from "@/lib/ai/providers";
import { createStreamingProviderLlm, providerLlm, resolveModel } from "./llm";

const XAI: ActiveProvider = { provider: PROVIDERS.xai, model: PROVIDERS.xai.defaultModel, apiKey: "k" };
const OPENROUTER: ActiveProvider = {
  provider: PROVIDERS.openrouter,
  model: PROVIDERS.openrouter.defaultModel,
  apiKey: "k",
};

describe("resolveModel", () => {
  const originalAiModel = process.env.AI_MODEL;

  beforeEach(() => {
    delete process.env.AI_MODEL;
  });

  afterEach(() => {
    if (originalAiModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = originalAiModel;
  });

  it("maps xai's legacy grok-main/grok-fast node values to their specific model ids", () => {
    expect(resolveModel("grok-main", XAI)).toBe("grok-4.3");
    expect(resolveModel("grok-fast", XAI)).toBe("grok-4.1-fast");
  });

  it("passes an OpenRouter model id through as-is instead of discarding it for the provider default", () => {
    expect(resolveModel("deepseek/deepseek-chat-v3:free", OPENROUTER)).toBe(
      "deepseek/deepseek-chat-v3:free",
    );
    expect(resolveModel("anthropic/claude-3.5-sonnet", OPENROUTER)).toBe("anthropic/claude-3.5-sonnet");
  });

  it("passes a non-legacy node model id through as-is even when the active provider is xai", () => {
    expect(resolveModel("grok-4-turbo", XAI)).toBe("grok-4-turbo");
  });

  it("falls back to the provider's default model only when the node model is empty", () => {
    expect(resolveModel("", OPENROUTER)).toBe(PROVIDERS.openrouter.defaultModel);
    expect(resolveModel("   ", XAI)).toBe(PROVIDERS.xai.defaultModel);
  });

  it("lets an explicit AI_MODEL override win over any node-level selection", () => {
    process.env.AI_MODEL = "pinned-model";
    expect(resolveModel("deepseek/deepseek-chat-v3:free", { ...OPENROUTER, model: "pinned-model" })).toBe(
      "pinned-model",
    );
    expect(resolveModel("grok-main", { ...XAI, model: "pinned-model" })).toBe("pinned-model");
  });
});

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
