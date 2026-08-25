import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConversationMessagesForUser } from "@/lib/chat/inbox-queries";
import { sendAgentReplyForUser } from "@/lib/chat/send-agent-reply";
import { requireMobileUser } from "@/lib/mobile-auth/token";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const conversation = await getConversationMessagesForUser(userId, id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  return NextResponse.json({ conversation });
}

const BodySchema = z.object({
  content: z.string().min(1),
  replyToId: z.string().optional(),
});

/** Sends a manual reply as the seller — same sendAgentReplyForUser the web Inbox uses (see its
 * doc comment in src/lib/chat/send-agent-reply.ts), so WhatsApp delivery/service-window/quote
 * behavior is identical between the web and native apps. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { id } = await params;
  const result = await sendAgentReplyForUser(userId, id, parsed.data.content, parsed.data.replyToId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ error: null });
}
