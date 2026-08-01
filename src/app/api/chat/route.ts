import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createStreamingGrokLlm, grokLlm } from "@/engine/llm";
import { isOriginAllowed } from "@/lib/chat/origin-check";
import { resolveBotAccess, runChatTurn } from "@/lib/chat/run-turn";
import { chatRateLimiter } from "@/lib/rate-limit";

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

  // Resolved once, up front, for both response modes below — a streaming response's status
  // can't change after the stream starts, so "not found"/"origin not allowed"/"rate limited"
  // all have to be decided before committing to one. runChatTurn repeats a small part of this
  // lookup once it actually runs; that duplication buys keeping this check free of any
  // conversation/message side effects.
  const access = await resolveBotAccess(parsed.data.botPublicKey);
  if (!access || !access.live) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  }

  if (process.env.NODE_ENV === "production") {
    if (!isOriginAllowed(request.headers.get("origin"), access.allowedDomains)) {
      return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
    }
  }

  if (!(await chatRateLimiter.consume(parsed.data.visitorId))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const streaming = request.nextUrl.searchParams.get("stream") === "1";

  if (!streaming) {
    const result = await runChatTurn(parsed.data, { llm: grokLlm });
    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Bot not found." }, { status: 404 });
    }
    return NextResponse.json({ replies: result.replies, status: result.status });
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
