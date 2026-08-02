// Central registry for the AI providers the runtime engine can talk to. Both are
// OpenAI-compatible APIs (see src/engine/llm.ts), so switching providers is just a different
// baseURL/key/model triplet — no separate client implementations.

export type ProviderId = "xai" | "openrouter";

export type Provider = {
  id: ProviderId;
  name: string;
  baseURL: string;
  /** Name of the env var holding this provider's API key — never the key itself. */
  apiKeyEnv: string;
  defaultModel: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  xai: {
    id: "xai",
    name: "xAI",
    baseURL: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    defaultModel: "grok-3-mini",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultModel: "deepseek/deepseek-chat-v3:free",
  },
};

function isProviderId(value: string): value is ProviderId {
  return value === "xai" || value === "openrouter";
}

export type ProviderConfig = {
  provider: Provider;
  model: string;
  /** undefined when the provider's key env var isn't set — callers that need to actually talk
   * to the provider should go through getActiveProvider() instead, which turns that into a
   * thrown error; this shape exists for callers (the status endpoint) that need to report a
   * missing key rather than crash on it. */
  apiKey: string | undefined;
};

/** Falls back to whichever provider actually has a key configured when AI_PROVIDER doesn't say
 * (or doesn't name a real provider) — set up XAI_API_KEY only and it silently behaves as "xai";
 * set up OPENROUTER_API_KEY only and it silently behaves as "openrouter". Existing xAI
 * deployments (which normally have XAI_API_KEY and nothing else) still resolve to exactly the
 * same provider they always did; xai only wins the final tie-break when either both keys are
 * present or neither is — the same "default to xai" behavior as before this fallback existed. */
function defaultProviderId(): ProviderId {
  if (!process.env.XAI_API_KEY && process.env.OPENROUTER_API_KEY) return "openrouter";
  return "xai";
}

/** Reads AI_PROVIDER/AI_MODEL fresh from process.env on every call — no caching — so a
 * provider switch (a new deploy, or a test toggling process.env) takes effect immediately
 * without stale state left over from an earlier resolution. */
export function resolveProviderConfig(): ProviderConfig {
  const raw = process.env.AI_PROVIDER?.trim();
  const providerId: ProviderId = raw && isProviderId(raw) ? raw : defaultProviderId();
  const provider = PROVIDERS[providerId];
  const model = process.env.AI_MODEL?.trim() || provider.defaultModel;
  const apiKey = process.env[provider.apiKeyEnv];

  return { provider, model, apiKey: apiKey || undefined };
}

export type ActiveProvider = {
  provider: Provider;
  model: string;
  apiKey: string;
};

/** Same resolution as resolveProviderConfig(), but throws a clear, actionable error instead
 * of returning an undefined key — this is what the engine itself calls before making a real
 * API request, where a missing key can't be worked around. */
export function getActiveProvider(): ActiveProvider {
  const config = resolveProviderConfig();
  if (!config.apiKey) {
    throw new Error(
      `${config.provider.apiKeyEnv} is not configured — required for the "${config.provider.id}" AI provider.`,
    );
  }
  return { provider: config.provider, model: config.model, apiKey: config.apiKey };
}
