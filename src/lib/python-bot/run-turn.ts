import { prisma } from "@/lib/prisma";
import { runPythonBotCode } from "./sandbox";
import type { PythonBotMessage } from "./types";

// Mirrors run-turn.ts's/run-whatsapp-turn.ts's constant of the same name.
const MAX_HISTORY_MESSAGES = 12;

export type PythonBotTurnResult = {
  /** Empty when the script had nothing to say this turn (not an error) or the run failed —
   * callers can't tell the two apart from this alone, which is deliberate: a sandbox/script
   * failure should degrade to silence (like a Logic rule that doesn't match), not an error
   * message that reads as if it came from the bot's own logic. PythonBot.lastError carries the
   * actual diagnostic for the owner. */
  replies: string[];
  handoff: boolean;
};

/**
 * Runs one turn of a bot's Python Bot mode against an already-resolved Conversation row — the
 * caller (runChatTurn / runWhatsAppTurn / the Studio's test action) owns finding-or-creating the
 * conversation and persisting the inbound Message row, exactly as it already does for the Flow
 * graph path; this owns everything specific to Python Bot: building the history the script sees,
 * invoking the sandbox, and persisting the result (pythonState, conversation status,
 * PythonBot.lastError).
 */
export async function runPythonBotTurn(params: {
  conversationId: string;
  pythonState: unknown;
  message: string;
  code: string;
  botId: string;
}): Promise<PythonBotTurnResult> {
  const priorMessages = await prisma.message.findMany({
    where: { conversationId: params.conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
    select: { role: true, content: true, contentType: true, caption: true },
  });
  // Same "represent an image by its caption" convention as engine/executor.ts's own local
  // history — the sandboxed script only ever sees plain text, never a raw `data:` URI.
  const history: PythonBotMessage[] = priorMessages.reverse().map((entry) => ({
    role: entry.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: entry.contentType === "IMAGE" ? (entry.caption ?? "[image]") : entry.content,
  }));

  const state =
    params.pythonState && typeof params.pythonState === "object" && !Array.isArray(params.pythonState)
      ? (params.pythonState as Record<string, unknown>)
      : {};

  const result = await runPythonBotCode(params.code, { message: params.message, history, state });

  if (result.kind === "error") {
    await prisma.pythonBot.update({
      where: { botId: params.botId },
      data: { lastError: result.message, lastRunAt: new Date() },
    });
    console.error("[python-bot] run failed", {
      botId: params.botId,
      conversationId: params.conversationId,
      error: result.message,
      stderr: result.stderr,
    });
    return { replies: [], handoff: false };
  }

  await prisma.$transaction([
    prisma.pythonBot.update({ where: { botId: params.botId }, data: { lastError: null, lastRunAt: new Date() } }),
    prisma.conversation.update({
      where: { id: params.conversationId },
      data: { pythonState: result.state as object, status: result.handoff ? "HANDOFF" : "OPEN" },
    }),
  ]);

  return { replies: result.replies, handoff: result.handoff };
}
