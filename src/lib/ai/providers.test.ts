import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getActiveProvider,
  getProvider,
  isProviderId,
  PROVIDERS,
  resolveProvider,
  resolveProviderConfig,
} from "./providers";

const ENV_KEYS = ["AI_PROVIDER", "AI_MODEL", "XAI_API_KEY", "OPENROUTER_API_KEY"] as const;
type EnvSnapshot = Partial<Record<(typeof ENV_KEYS)[number], string>>;

function snapshotEnv(): EnvSnapshot {
  const snapshot: EnvSnapshot = {};
  for (const key of ENV_KEYS) {
    if (process.env[key] !== undefined) snapshot[key] = process.env[key];
  }
  return snapshot;
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe("resolveProviderConfig / getActiveProvider", () => {
  let original: EnvSnapshot;

  beforeEach(() => {
    original = snapshotEnv();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    restoreEnv(original);
  });

  it("defaults to xai when AI_PROVIDER is unset", () => {
    process.env.XAI_API_KEY = "test-key";
    const config = resolveProviderConfig();
    expect(config.provider.id).toBe("xai");
    expect(config.model).toBe(PROVIDERS.xai.defaultModel);
    expect(config.apiKey).toBe("test-key");
  });

  it("defaults to xai for an unrecognized AI_PROVIDER value", () => {
    process.env.AI_PROVIDER = "not-a-real-provider";
    process.env.XAI_API_KEY = "test-key";
    expect(resolveProviderConfig().provider.id).toBe("xai");
  });

  it("selects openrouter when AI_PROVIDER=openrouter", () => {
    process.env.AI_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "or-key";
    const config = resolveProviderConfig();
    expect(config.provider.id).toBe("openrouter");
    expect(config.provider.baseURL).toBe("https://openrouter.ai/api/v1");
    expect(config.model).toBe(PROVIDERS.openrouter.defaultModel);
  });

  it("falls back to openrouter (not xai) when AI_PROVIDER is unset but only an OpenRouter key is configured", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(resolveProviderConfig().provider.id).toBe("openrouter");
  });

  it("falls back to openrouter for an unrecognized AI_PROVIDER value too, when only an OpenRouter key is configured", () => {
    process.env.AI_PROVIDER = "not-a-real-provider";
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(resolveProviderConfig().provider.id).toBe("openrouter");
  });

  it("still falls back to xai when AI_PROVIDER is unset and both provider keys are configured", () => {
    process.env.XAI_API_KEY = "xai-key";
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(resolveProviderConfig().provider.id).toBe("xai");
  });

  it("still falls back to xai when AI_PROVIDER is unset and neither key is configured", () => {
    expect(resolveProviderConfig().provider.id).toBe("xai");
  });

  it("lets AI_MODEL override the provider's default model", () => {
    process.env.XAI_API_KEY = "test-key";
    process.env.AI_MODEL = "grok-custom";
    expect(resolveProviderConfig().model).toBe("grok-custom");
  });

  it("reports apiKey as undefined (never throws) when the provider's key env var is missing", () => {
    const config = resolveProviderConfig();
    expect(config.apiKey).toBeUndefined();
  });

  it("getActiveProvider throws a clear, provider-specific error when the key is missing", () => {
    expect(() => getActiveProvider()).toThrow(/XAI_API_KEY is not configured/);
  });

  it("getActiveProvider throws referencing OPENROUTER_API_KEY when that provider is active and unconfigured", () => {
    process.env.AI_PROVIDER = "openrouter";
    expect(() => getActiveProvider()).toThrow(/OPENROUTER_API_KEY is not configured/);
  });

  it("getActiveProvider resolves normally once the key is present", () => {
    process.env.XAI_API_KEY = "test-key";
    const active = getActiveProvider();
    expect(active.apiKey).toBe("test-key");
    expect(active.provider.id).toBe("xai");
  });
});

describe("isProviderId", () => {
  it("recognizes exactly the two registered provider ids", () => {
    expect(isProviderId("xai")).toBe(true);
    expect(isProviderId("openrouter")).toBe(true);
    expect(isProviderId("anthropic")).toBe(false);
    expect(isProviderId("")).toBe(false);
  });
});

describe("resolveProvider / getProvider (per-id resolution)", () => {
  let original: EnvSnapshot;

  beforeEach(() => {
    original = snapshotEnv();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    restoreEnv(original);
  });

  it("resolves a specific provider's config regardless of AI_PROVIDER", () => {
    process.env.AI_PROVIDER = "xai";
    process.env.OPENROUTER_API_KEY = "or-key";
    const config = resolveProvider("openrouter");
    expect(config.provider.id).toBe("openrouter");
    expect(config.apiKey).toBe("or-key");
    expect(config.model).toBe(PROVIDERS.openrouter.defaultModel);
  });

  it("still honors AI_MODEL as an override for a specifically requested provider", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.AI_MODEL = "custom/model";
    expect(resolveProvider("openrouter").model).toBe("custom/model");
  });

  it("reports apiKey undefined for a specific provider whose key isn't configured", () => {
    expect(resolveProvider("openrouter").apiKey).toBeUndefined();
  });

  it("getProvider throws a clear, provider-specific error when that provider's key is missing", () => {
    expect(() => getProvider("openrouter")).toThrow(/OPENROUTER_API_KEY is not configured/);
  });

  it("getProvider resolves normally once that provider's key is present, independent of AI_PROVIDER", () => {
    process.env.AI_PROVIDER = "openrouter";
    process.env.XAI_API_KEY = "xai-key";
    const active = getProvider("xai");
    expect(active.provider.id).toBe("xai");
    expect(active.apiKey).toBe("xai-key");
  });
});
