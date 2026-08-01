import { NextResponse } from "next/server";
import { z } from "zod";
import type { LlmDep } from "@/engine/types";
import { runChatTurn } from "@/lib/chat/run-turn";

const BodySchema = z.object({
  botPublicKey: z.string().min(1),
  visitorId: z.string().min(1),
  message: z.string().max(4000).optional(),
});

// TODO(phase 3 step 3): replace with the real Grok/xAI integration in src/engine/llm.ts.
// Throwing here is intentional — the executor already falls back to a friendly reply on any
// llm rejection, so an "ai" node degrades gracefully until this lands.
const placeholderLlm: LlmDep = async () => {
  throw new Error("AI replies are not wired up yet.");
};

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // TODO(phase 3 step 5): enforce allowedDomains against the request's Origin header, and rate
  // limit per visitorId.

  const result = await runChatTurn(parsed.data, { llm: placeholderLlm });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  }

  return NextResponse.json({ replies: result.replies, status: result.status });
}
