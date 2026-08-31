import { NextResponse, type NextRequest } from "next/server";
import { getOrCreateFlowForUser, saveFlowForUser } from "@/lib/flow-queries";
import { requireMobileUser } from "@/lib/mobile-auth/token";

/** Mobile's equivalent of the web Studio page's own bot+flow load (src/app/(main)/app/studio/
 * [slug]/page.tsx) — lazily creates the bot's one Flow row on first request, same as there. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const result = await getOrCreateFlowForUser(userId, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ flowId: result.flowId, graph: result.graph });
}

/** Mobile's equivalent of the web Studio editor's saveFlow Server Action (src/lib/actions/
 * flow.ts) — same validation, same ownership check, both now backed by saveFlowForUser. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object" || !("flowId" in json) || typeof json.flowId !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await saveFlowForUser(userId, id, json.flowId, json.graph);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ error: null });
}
