import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROVIDERS, type ActiveProvider } from "@/lib/ai/providers";

const createCompletionMock = vi.fn();

vi.mock("openai", () => {
  class MockAPIError extends Error {}
  class MockOpenAI {
    chat = { completions: { create: createCompletionMock } };
  }
  // @ts-expect-error -- attaching the static APIError the real SDK exposes, for describeError's
  // `instanceof OpenAI.APIError` check; the mock class itself is what matters for the tests below.
  MockOpenAI.APIError = MockAPIError;
  return { default: MockOpenAI };
});

const { createStreamingProviderLlm, providerLlm, resolveActiveProvider, resolveModel } = await import("./llm");

function mockStream(chunks: Array<{ content?: string; finishReason?: string | null }>) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield {
          choices: [{ delta: { content: chunk.content }, finish_reason: chunk.finishReason ?? null }],
          usage: null,
        };
      }
    },
  };
}

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

describe("providerLlm with a per-node provider override", () => {
  const originalXai = process.env.XAI_API_KEY;
  const originalOpenrouter = process.env.OPENROUTER_API_KEY;
  const originalProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    process.env.XAI_API_KEY = "xai-key";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_PROVIDER;
  });

  afterEach(() => {
    if (originalXai === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalXai;
    if (originalOpenrouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenrouter;
    if (originalProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalProvider;
  });

  it("honors an explicit node-level provider override instead of the env-resolved default", async () => {
    // The deployment default resolves to xai (XAI_API_KEY is the only key configured), but this
    // node asks for openrouter specifically — it should try THAT provider (and fail on its
    // missing key), proving the override actually took effect rather than silently using xai.
    await expect(
      providerLlm({
        systemPrompt: "Be helpful.",
        history: [],
        temperature: 0.3,
        model: "deepseek/deepseek-chat-v3:free",
        provider: "openrouter",
      }),
    ).rejects.toThrow(/OPENROUTER_API_KEY is not configured/);
  });

  it("falls back to the env-resolved default provider when the node's provider is unrecognized", () => {
    expect(resolveActiveProvider("not-a-real-provider").provider.id).toBe("xai");
  });

  it("falls back to the env-resolved default provider when the node has no provider set", () => {
    expect(resolveActiveProvider(undefined).provider.id).toBe("xai");
  });

  it("honors a valid override over the env-resolved default", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(resolveActiveProvider("openrouter").provider.id).toBe("openrouter");
  });
});

describe("providerLlm / createStreamingProviderLlm empty-reply handling", () => {
  const originalKey = process.env.XAI_API_KEY;
  const originalProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    process.env.XAI_API_KEY = "xai-key";
    process.env.AI_PROVIDER = "xai";
    createCompletionMock.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalProvider;
  });

  it("retries once on an empty reply that isn't token-limited, and succeeds on the retry", async () => {
    createCompletionMock
      .mockResolvedValueOnce({ choices: [{ message: { content: "" }, finish_reason: "stop" }], usage: null })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Second try works." }, finish_reason: "stop" }],
        usage: null,
      });

    const result = await providerLlm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" });
    expect(result.content).toBe("Second try works.");
    expect(createCompletionMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the empty reply is token-limited, and says so", async () => {
    createCompletionMock.mockResolvedValueOnce({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
      usage: null,
    });

    await expect(
      providerLlm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/ran out of tokens/);
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
  });

  it("gives up with a generic message after the retry also comes back empty", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: "" }, finish_reason: "stop" }],
      usage: null,
    });

    await expect(
      providerLlm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/xAI returned an empty reply/);
    expect(createCompletionMock).toHaveBeenCalledTimes(2);
  });

  it("streaming retries once on an empty reply, without ever invoking onChunk for the empty attempt", async () => {
    createCompletionMock
      .mockResolvedValueOnce(mockStream([{ content: "", finishReason: "stop" }]))
      .mockResolvedValueOnce(mockStream([{ content: "Streamed ", finishReason: null }, { content: "reply.", finishReason: "stop" }]));

    const chunks: string[] = [];
    const llm = createStreamingProviderLlm((delta) => chunks.push(delta));
    const result = await llm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" });

    expect(result.content).toBe("Streamed reply.");
    expect(chunks).toEqual(["Streamed ", "reply."]);
    expect(createCompletionMock).toHaveBeenCalledTimes(2);
  });

  it("streaming does not retry a token-limited empty reply", async () => {
    createCompletionMock.mockResolvedValueOnce(mockStream([{ content: "", finishReason: "length" }]));

    const llm = createStreamingProviderLlm(() => {});
    await expect(
      llm({ systemPrompt: "Be helpful.", history: [], temperature: 0.3, model: "grok-main" }),
    ).rejects.toThrow(/ran out of tokens/);
    expect(createCompletionMock).toHaveBeenCalledTimes(1);
  });
});
