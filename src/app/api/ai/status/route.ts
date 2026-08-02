import { NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveProviderConfig } from "@/lib/ai/providers";

// Health can change between requests (a key gets added/rotated, the provider goes down) —
// never serve a stale cached result for what's meant to be a live check.
export const dynamic = "force-dynamic";

type Reachable = { ok: true } | { ok: false; error: string };

function describeError(error: unknown): string {
  if (error instanceof OpenAI.APIError) return `API error (${error.status ?? "?"}): ${error.message}`;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/**
 * Reports which AI provider is currently active and whether it's actually reachable — never
 * echoes the API key itself, only whether one is configured. No auth: this is a low-sensitivity
 * operational check (provider name, model id, up/down), not account data, and the dashboard
 * status indicator needs to call it unauthenticated-fast on every page load.
 */
export async function GET() {
  const { provider, model, apiKey } = resolveProviderConfig();
  const keyPresent = Boolean(apiKey);

  let reachable: Reachable;
  if (!keyPresent) {
    reachable = { ok: false, error: `${provider.apiKeyEnv} is not configured.` };
  } else {
    try {
      const client = new OpenAI({ apiKey, baseURL: provider.baseURL });
      await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      reachable = { ok: true };
    } catch (error) {
      reachable = { ok: false, error: describeError(error) };
    }
  }

  return NextResponse.json({ provider: provider.name, model, keyPresent, reachable });
}
