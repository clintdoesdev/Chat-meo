import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { runTestTurn } from "@/lib/chat/run-test-turn";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  graph: z.unknown(),
  state: z.unknown().optional(),
  message: z.string().max(4000).optional(),
  sessionId: z.string().optional(),
  flowId: z.string().optional(),
  priorHistory: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

/** Studio "Test" drawer only — runs the editor's current unsaved graph against the real
 * engine with no persistence. Gated on a signed-in session, not on the graph belonging to any
 * particular bot (there's nothing to own here; the graph is passed inline). flowId is the one
 * exception: it's only used to look up that flow's uploaded AI-node documents, so unlike the
 * graph itself it DOES need an ownership check — otherwise any signed-in user could pass another
 * user's flowId and have their private documents reflected back through an AI reply. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (parsed.data.flowId) {
    const flow = await prisma.flow.findUnique({
      where: { id: parsed.data.flowId },
      select: { bot: { select: { userId: true } } },
    });
    if (!flow || flow.bot.userId !== session.user.id) {
      return NextResponse.json({ error: "Flow not found." }, { status: 404 });
    }
  }

  const result = await runTestTurn(parsed.data);
  if (result.kind === "invalid_graph") {
    return NextResponse.json({ error: "Invalid flow graph." }, { status: 400 });
  }

  return NextResponse.json({ replies: result.replies, state: result.state });
}
