import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteConversationForUser, setConversationArchivedForUser } from "@/lib/chat/inbox-queries";
import { requireMobileUser } from "@/lib/mobile-auth/token";

const BodySchema = z.object({
  archived: z.boolean(),
});

/** Mobile's equivalent of the web app's setConversationArchived Server Action (src/lib/actions/
 * inbox.ts) — currently just the one field, since archiving is the only per-conversation PATCH
 * the Inbox screen's swipe action needs today. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await setConversationArchivedForUser(userId, id, parsed.data.archived);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ error: null });
}

/** Mobile's equivalent of the web app's deleteConversation Server Action (src/lib/actions/
 * inbox.ts) — the Inbox screen's swipe-to-delete action. Permanent, unlike archiving. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await deleteConversationForUser(userId, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ error: null });
}
