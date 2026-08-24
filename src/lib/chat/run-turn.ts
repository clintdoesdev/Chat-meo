import { after } from "next/server";
import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineDeps, EngineStatus, LlmChatMessage, LlmDep, Reply } from "@/engine/types";
import { attachAiNodeDocuments } from "@/lib/chat/attach-ai-documents";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";

const MESSAGE_PREVIEW_LENGTH = 140;

function previewOf(content: string): string {
  return content.length > MESSAGE_PREVIEW_LENGTH ? `${content.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : content;
}

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
        },
      },
    },
  });
  if (!apiKey) return null;
  return {
    botId: apiKey.bot.id,
    live: apiKey.bot.status === "LIVE" && apiKey.bot.flows.length > 0,
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
        },
      },
    },
  });

  if (!apiKey || apiKey.bot.status !== "LIVE") return { kind: "not_found" };
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
  // findFirst above only ever returns/creates an OPEN conversation, so reaching HANDOFF here is
  // always a fresh transition, never a repeat notification for one already handed off.
  if (params.message) {
    const preview = previewOf(params.message);
    after(() =>
      sendPushToUser(apiKey.bot.userId, {
        title: `New message · ${apiKey.bot.name}`,
        body: preview,
        url: "/app/inbox",
      }).catch((error) => console.error("[chat] failed to send new-message push", { conversationId: conversation.id, error })),
    );
  }
  if (output.state.status === "HANDOFF") {
    after(() =>
      sendPushToUser(apiKey.bot.userId, {
        title: `${apiKey.bot.name} needs a human`,
        body: `${params.visitorId} needs your help.`,
        url: "/app/inbox",
      }).catch((error) => console.error("[chat] failed to send handoff push", { conversationId: conversation.id, error })),
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
