import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { classifierLlm, createStreamingProviderLlm, providerLlm } from "@/engine/llm";
import { BETA_LIMIT_REPLY, isBotOverMessageCap } from "@/lib/chat/beta-quota";
import { corsHeaders } from "@/lib/chat/cors";
import { isChatRequestAllowed, isOwnHost, resolveEmbedHostname } from "@/lib/chat/origin-check";
import { resolveBotAccess, runChatTurn } from "@/lib/chat/run-turn";
import { chatRateLimiter } from "@/lib/rate-limit";

const BodySchema = z.object({
  botPublicKey: z.string().min(1),
  visitorId: z.string().min(1),
  message: z.string().max(4000).optional(),
});

const RATE_LIMIT_REPLY = "You're sending messages a little fast — please wait a moment and try again.";

function sseFrame(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: cors });
  }

  // Resolved once, up front, for both response modes below — a streaming response's status
  // can't change after the stream starts, so "not found"/"origin not allowed"/"rate limited"
  // all have to be decided before committing to one. runChatTurn repeats a small part of this
  // lookup once it actually runs; that duplication buys keeping this check free of any
  // conversation/message side effects.
  const access = await resolveBotAccess(parsed.data.botPublicKey);
  if (!access || !access.live) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404, headers: cors });
  }

  const embedHost = resolveEmbedHostname(request);
  if (!isOwnHost(embedHost, request) && !isChatRequestAllowed(embedHost, access)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors });
  }

  if (!(await chatRateLimiter.consume(parsed.data.visitorId))) {
    // A graceful in-character reply rather than a bare error — the widget renders `replies`
    // as a normal bot bubble regardless of status code.
    return NextResponse.json(
      { error: "Too many requests.", replies: [{ content: RATE_LIMIT_REPLY }], status: "RUNNING" },
      { status: 429, headers: cors },
    );
  }

  // Soft beta guardrail, not billing enforcement — checked before touching the engine so a
  // capped bot doesn't rack up further LLM cost, and surfaced as a normal bot reply (200) since
  // this is expected beta behavior from the visitor's side, not an error to alarm them with.
  if (await isBotOverMessageCap(access.botId)) {
    console.log("[chat] beta message cap reached", { botId: access.botId });
    return NextResponse.json({ replies: [{ content: BETA_LIMIT_REPLY }], status: "ENDED" }, { headers: cors });
  }

  const streaming = request.nextUrl.searchParams.get("stream") === "1";

  if (!streaming) {
    const result = await runChatTurn(parsed.data, { llm: providerLlm, classify: classifierLlm });
    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Bot not found." }, { status: 404, headers: cors });
    }
    return NextResponse.json({ replies: result.replies, status: result.status }, { headers: cors });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llm = createStreamingProviderLlm((delta: string) =>
          controller.enqueue(sseFrame({ type: "chunk", content: delta })),
        );
        const result = await runChatTurn(parsed.data, { llm, classify: classifierLlm });
        if (result.kind === "not_found") {
          controller.enqueue(sseFrame({ type: "error", error: "Bot not found." }));
        } else {
          controller.enqueue(sseFrame({ type: "done", replies: result.replies, status: result.status }));
        }
      } catch (error) {
        console.error("[api/chat] streaming turn failed", error);
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
      ...cors,
    },
  });
}
