import { NextResponse, type NextRequest } from "next/server";
import { listConversationsForUser } from "@/lib/chat/inbox-queries";
import { requireMobileUser } from "@/lib/mobile-auth/token";

/** Every conversation across every bot this user owns — the native Inbox screen's data source,
 * same query the web Inbox uses (see listConversationsForUser's doc comment). */
export async function GET(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const conversations = await listConversationsForUser(userId);
  return NextResponse.json({ conversations });
}
