import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isProviderId, resolveProvider } from "@/lib/ai/providers";

// The model catalog can change server-side at any time (a key gets rotated, a provider adds a
// model) — never serve a stale cached result for what the Studio's model picker treats as live.
export const dynamic = "force-dynamic";

export type AiModelOption = { id: string; label?: string };

type RawModelsResponse = { data?: unknown };

function parseModels(json: unknown): AiModelOption[] {
  const data = (json as RawModelsResponse)?.data;
  if (!Array.isArray(data)) return [];

  const models: AiModelOption[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const id = (entry as Record<string, unknown>).id;
    if (typeof id !== "string" || !id) continue;
    const name = (entry as Record<string, unknown>).name;
    const label = typeof name === "string" && name && name !== id ? name : undefined;
    models.push(label ? { id, label } : { id });
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Live model catalog for a given AI provider, used by the Flow Studio AI node's model picker.
 * Gated on a signed-in session (this proxies an upstream API call using the deployment's own
 * key, so it shouldn't be callable by anonymous visitors). Never echoes the API key itself.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("provider");
  if (!raw || !isProviderId(raw)) {
    return NextResponse.json({ error: "Unknown or missing provider." }, { status: 400 });
  }

  const { provider, apiKey } = resolveProvider(raw);
  if (!apiKey) {
    return NextResponse.json(
      { error: `${provider.apiKeyEnv} is not configured — required for the "${provider.id}" AI provider.` },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${provider.baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `${provider.name} returned ${response.status} while listing models.` },
        { status: 502 },
      );
    }
    const json: unknown = await response.json();
    return NextResponse.json({ models: parseModels(json) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: `Failed to reach ${provider.name}: ${message}` }, { status: 502 });
  }
}
