import { after } from "next/server";
import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineDeps, EngineStatus, LlmChatMessage, LlmDep, Reply } from "@/engine/types";
import { attachAiNodeDocuments } from "@/lib/chat/attach-ai-documents";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";
import { runPythonBotTurn } from "@/lib/python-bot/run-turn";
import { sendPushToUser } from "@/lib/push/send";

const MAX_HISTORY_MESSAGES = 12;

export type RunTurnParams = {
  botPublicKey: string;
  visitorId: string;
  message?: string;
};

export type RunTurnDeps = {
  llm: LlmDep;
  classify: LlmDep;
};

export type RunTurnResult =
  | { kind: "not_found" }
  | { kind: "success"; replies: Reply[]; status: EngineStatus };

/** Maps the engine's fine-grained execution status onto the conversation's coarser lifecycle
 * status, used for inbox/dashboard purposes. Exported so other entry points into the engine
 * (e.g. run-whatsapp-turn.ts) apply the exact same mapping rather than re-deriving it. */
export function conversationStatusFor(engineStatus: EngineStatus): "OPEN" | "RESOLVED" | "HANDOFF" {
  if (engineStatus === "HANDOFF") return "HANDOFF";
  if (engineStatus === "ENDED") return "RESOLVED";
  return "OPEN";
}

export type BotAccess = { botId: string; live: boolean; allowedDomains: string[]; testMode: boolean };

/** A lightweight lookup the route uses to decide 404/403/429 *before* it's committed to a
 * response (streaming's status can't change after the stream starts) — runChatTurn does the
 * full lookup again once it actually runs, which is a small duplicate query but keeps this
 * check free of conversation/message side effects. */
export async function resolveBotAccess(botPublicKey: string): Promise<BotAccess | null> {
  const apiKey = await prisma.botApiKey.findUnique({
    where: { publicKey: botPublicKey },
    select: {
      allowedDomains: true,
      bot: {
        select: {
          id: true,
          status: true,
          testMode: true,
          flows: { where: { isActive: true }, take: 1, select: { id: true } },
          pythonBot: { select: { enabled: true } },
        },
      },
    },
  });
  if (!apiKey) return null;
  return {
    botId: apiKey.bot.id,
    // Python Bot mode's own `enabled` toggle is a complete, independent publish signal — see
    // runChatTurn below — rather than also requiring Bot.status: "LIVE" (the Studio canvas's own
    // Publish button), since a bot that only ever uses Python Bot mode may never visit the canvas
    // page (and its auto-created default Flow) at all.
    live: apiKey.bot.pythonBot?.enabled === true || (apiKey.bot.status === "LIVE" && apiKey.bot.flows.length > 0),
    allowedDomains: apiKey.allowedDomains,
    testMode: apiKey.bot.testMode,
  };
}

/**
 * Runs one visitor turn against a bot's live flow: looks up the bot by its public key, loads
 * or creates the visitor's open conversation, persists the inbound message, steps the engine,
 * persists whatever replies came out, and saves the resulting state. Returns `not_found` for
 * any public key that doesn't resolve to a live bot with an active flow — callers should
 * respond 404 without distinguishing "no such key" from "bot isn't live" (avoid the enumeration
 * pattern already established for auth).
 */
export async function runChatTurn(params: RunTurnParams, deps: RunTurnDeps): Promise<RunTurnResult> {
  const apiKey = await prisma.botApiKey.findUnique({
    where: { publicKey: params.botPublicKey },
    select: {
      allowedDomains: true,
      bot: {
        select: {
          id: true,
          userId: true,
          name: true,
          status: true,
          flows: { where: { isActive: true }, take: 1, select: { id: true, graph: true } },
          pythonBot: { select: { code: true, enabled: true } },
        },
      },
    },
  });

  if (!apiKey) return { kind: "not_found" };
  if (apiKey.bot.pythonBot?.enabled) {
    return runPythonBotTurnFor(apiKey.bot.id, apiKey.bot.userId, apiKey.bot.name, apiKey.bot.pythonBot.code, params);
  }

  if (apiKey.bot.status !== "LIVE") return { kind: "not_found" };
  const flow = apiKey.bot.flows[0];
  if (!flow) return { kind: "not_found" };

  const graph = adaptPersistedGraph(parseFlowGraph(flow.graph) ?? defaultFlowGraph());
  await attachAiNodeDocuments(graph, flow.id);

  let conversation = await prisma.conversation.findFirst({
    where: { botId: apiKey.bot.id, visitorId: params.visitorId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        botId: apiKey.bot.id,
        visitorId: params.visitorId,
        engineState: createInitialState(graph),
      },
    });
  }

  const state = parseEngineState(conversation.engineState, graph);

  // Fetched before persisting this turn's inbound message, so the executor's own local
  // history (which prepends that same message) doesn't end up duplicated in the merge below.
  const priorMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
  });
  const priorHistory: LlmChatMessage[] = priorMessages.reverse().map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  if (params.message) {
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "USER", content: params.message },
    });
  }

  const engineDeps: EngineDeps = {
    llm: (args) => deps.llm({ ...args, history: [...priorHistory, ...args.history].slice(-MAX_HISTORY_MESSAGES) }),
    // Same history-merging as `llm` above — a short, context-dependent reply ("done", "yes")
    // can only be classified correctly with the same conversation the AI itself would see.
    classify: (args) =>
      deps.classify({ ...args, history: [...priorHistory, ...args.history].slice(-MAX_HISTORY_MESSAGES) }),
    fetch,
    logger: console,
    conversationId: conversation.id,
    // /api/chat is the chatmeo-hosted web widget today; future webhook-delivered channels
    // (WhatsApp etc.) will pass their own channel through here instead.
    channel: "web",
  };

  const output = await step(graph, state, params.message, engineDeps);

  if (output.replies.length > 0) {
    await prisma.message.createMany({
      data: output.replies.map((reply) => ({
        conversationId: conversation.id,
        role: "BOT" as const,
        content: reply.content,
        contentType: reply.contentType ?? "TEXT",
        caption: reply.caption ?? null,
        promptTokens: reply.promptTokens ?? null,
        completionTokens: reply.completionTokens ?? null,
      })),
    });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { engineState: output.state, status: conversationStatusFor(output.state.status) },
  });

  // Deferred via after() so a push service round trip never adds latency to the widget's own
  // reply — see the same pattern in the WhatsApp webhook (src/app/api/webhooks/whatsapp/route.ts).
  // Two distinct "needs a human" signals, both worth a push: a HANDOFF transition (the flow
  // itself routed here, or gave up after too many unanswered loops — permanent, the engine won't
  // run on this conversation again) fires once, since findFirst above only ever returns/creates
  // an OPEN conversation so reaching HANDOFF here is always a fresh transition; an
  // unmatchedMessage (this one visitor message hit a Logic node and matched none of its rules,
  // but the conversation stays open and keeps trying) fires every time it happens, since it's a
  // per-message miss rather than a one-time state change. An ordinary reply from the flow means
  // nothing needs a human, so neither case pages anyone then.
  if (output.state.status === "HANDOFF") {
    after(() =>
      sendPushToUser(apiKey.bot.userId, {
        title: `${apiKey.bot.name} needs a human`,
        body: `${params.visitorId} needs your help.`,
        url: "/app/inbox",
        conversationId: conversation.id,
      }).catch((error) => console.error("[chat] failed to send handoff push", { conversationId: conversation.id, error })),
    );
  } else if (output.unmatchedMessage) {
    after(() =>
      sendPushToUser(apiKey.bot.userId, {
        title: `${apiKey.bot.name} couldn't reply`,
        body: `${params.visitorId} sent something no rule covers — reply manually?`,
        url: "/app/inbox",
        conversationId: conversation.id,
      }).catch((error) =>
        console.error("[chat] failed to send unmatched-message push", { conversationId: conversation.id, error }),
      ),
    );
  }

  console.log("[chat] turn", {
    botId: apiKey.bot.id,
    conversationId: conversation.id,
    hadInboundMessage: Boolean(params.message),
    replyCount: output.replies.length,
    status: output.state.status,
  });

  return { kind: "success", replies: output.replies, status: output.state.status };
}

/**
 * runChatTurn's counterpart for a bot in Python Bot mode (see PythonBot in
 * prisma/schema.prisma) — same Conversation/Message persistence and push-notification behavior,
 * but the reply comes from runPythonBotTurn's sandboxed script instead of stepping the Flow
 * graph. Split out from runChatTurn rather than interleaved with it since the two paths share
 * almost nothing beyond "find/create the conversation, persist the message, persist the reply."
 */
async function runPythonBotTurnFor(
  botId: string,
  botUserId: string,
  botName: string,
  code: string,
  params: RunTurnParams,
): Promise<RunTurnResult> {
  let conversation = await prisma.conversation.findFirst({
    where: { botId, visitorId: params.visitorId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { botId, visitorId: params.visitorId } });
  }

  if (params.message) {
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "USER", content: params.message },
    });
  }

  const result = await runPythonBotTurn({
    conversationId: conversation.id,
    pythonState: conversation.pythonState,
    message: params.message ?? "",
    code,
    botId,
  });

  if (result.replies.length > 0) {
    await prisma.message.createMany({
      data: result.replies.map((content) => ({ conversationId: conversation.id, role: "BOT" as const, content })),
    });
  }

  // Deferred via after() so a push service round trip never adds latency to the widget's own
  // reply — same pattern as runChatTurn above. Only the handoff transition notifies, same
  // reasoning as there.
  if (result.handoff) {
    after(() =>
      sendPushToUser(botUserId, {
        title: `${botName} needs a human`,
        body: `${params.visitorId} needs your help.`,
        url: "/app/inbox",
        conversationId: conversation.id,
      }).catch((error) => console.error("[chat] failed to send handoff push", { conversationId: conversation.id, error })),
    );
  }

  console.log("[chat] python bot turn", {
    botId,
    conversationId: conversation.id,
    hadInboundMessage: Boolean(params.message),
    replyCount: result.replies.length,
    handoff: result.handoff,
  });

  return {
    kind: "success",
    replies: result.replies.map((content) => ({ content })),
    status: result.handoff ? "HANDOFF" : "AWAITING_INPUT",
  };
}
