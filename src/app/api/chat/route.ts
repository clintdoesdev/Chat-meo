import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createStreamingGrokLlm, grokLlm } from "@/engine/llm";
import { isBotLiveForKey, runChatTurn } from "@/lib/chat/run-turn";

const BodySchema = z.object({
  botPublicKey: z.string().min(1),
  visitorId: z.string().min(1),
  message: z.string().max(4000).optional(),
});

function sseFrame(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // TODO(phase 3 step 5): enforce allowedDomains against the request's Origin header, and rate
  // limit per visitorId.

  const streaming = request.nextUrl.searchParams.get("stream") === "1";

  if (!streaming) {
    const result = await runChatTurn(parsed.data, { llm: grokLlm });
    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Bot not found." }, { status: 404 });
    }
    return NextResponse.json({ replies: result.replies, status: result.status });
  }

  // The stream's response status is fixed the moment it's returned below, so "bot not found"
  // has to be resolved before we commit to starting it — can't downgrade a 200 to a 404 mid-stream.
  const live = await isBotLiveForKey(parsed.data.botPublicKey);
  if (!live) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llm = createStreamingGrokLlm((delta) =>
          controller.enqueue(sseFrame({ type: "chunk", content: delta })),
        );
        const result = await runChatTurn(parsed.data, { llm });
        if (result.kind === "not_found") {
          controller.enqueue(sseFrame({ type: "error", error: "Bot not found." }));
        } else {
          controller.enqueue(sseFrame({ type: "done", replies: result.replies, status: result.status }));
        }
      } catch {
        controller.enqueue(sseFrame({ type: "error", error: "Something went wrong." }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
