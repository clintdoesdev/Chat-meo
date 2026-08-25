"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runPythonBotCode } from "@/lib/python-bot/sandbox";
import type { PythonBotMessage } from "@/lib/python-bot/types";

async function requireBotOwnership(botId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true } });
  if (!bot || bot.userId !== session.user.id) return null;

  return bot;
}

export type PythonBotConfig = {
  code: string;
  enabled: boolean;
  lastError: string | null;
  lastRunAt: string | null;
  /** False when E2B_API_KEY isn't set on this deployment — the Studio page shows a "not
   * configured" state (same convention as WhatsAppConnectConfig.configured) instead of letting
   * the owner enable a mode that can only ever fail. */
  sandboxConfigured: boolean;
};

const DEFAULT_CODE = `# Runs once per incoming message. Read chatmeo_input, set chatmeo_reply (or
# chatmeo_replies, for more than one message) before the script ends — that's the whole contract.
#
# chatmeo_input = {
#     "message": "the customer's latest message",
#     "history": [{"role": "user" | "assistant", "content": "..."}, ...],  # most recent messages, oldest first
#     "state":   {...}  # whatever you set as chatmeo_state last turn, {} on the first turn
# }

message = chatmeo_input["message"]

if "hello" in message.lower():
    chatmeo_reply = "Hey! How can I help you today?"
else:
    chatmeo_reply = "Got it — let me know if you need anything else."

# chatmeo_state = {...}   # persisted and handed back next turn, for anything you want to remember
# chatmeo_handoff = True  # set this to hand the conversation off to a human instead of replying
`;

async function getOrCreatePythonBot(botId: string) {
  const existing = await prisma.pythonBot.findUnique({ where: { botId } });
  if (existing) return existing;
  return prisma.pythonBot.create({ data: { botId, code: DEFAULT_CODE } });
}

/** Everything the Studio's Python Bot page needs to render — creates the (disabled-by-default)
 * PythonBot row on first visit, same lazy-creation convention as the canvas page's default Flow. */
export async function getPythonBotConfig(botId: string): Promise<PythonBotConfig | { error: string }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const pythonBot = await getOrCreatePythonBot(botId);
  return {
    code: pythonBot.code,
    enabled: pythonBot.enabled,
    lastError: pythonBot.lastError,
    lastRunAt: pythonBot.lastRunAt?.toISOString() ?? null,
    sandboxConfigured: Boolean(process.env.E2B_API_KEY),
  };
}

export async function savePythonBotCode(botId: string, code: string): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  await getOrCreatePythonBot(botId);
  await prisma.pythonBot.update({ where: { botId }, data: { code } });
  return { error: null };
}

export async function setPythonBotEnabled(botId: string, enabled: boolean): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  if (enabled && !process.env.E2B_API_KEY) {
    return { error: "Python Bot isn't configured on this deployment yet (missing E2B_API_KEY)." };
  }

  await getOrCreatePythonBot(botId);
  await prisma.pythonBot.update({ where: { botId }, data: { enabled } });
  return { error: null };
}

export type TestPythonBotResult =
  | {
      kind: "success";
      replies: string[];
      state: Record<string, unknown>;
      handoff: boolean;
      stdout: string;
      stderr: string;
    }
  | { kind: "error"; message: string; stdout: string; stderr: string };

/**
 * The Python Bot page's counterpart to the Studio Test drawer's runTestTurn — runs the
 * in-editor (possibly unsaved) code against a sandbox directly, with no Conversation/Message rows
 * involved. State round-trips through the caller between calls, exactly like runTestTurn's own
 * `priorHistory`/`state` params.
 */
export async function testPythonBotCode(
  botId: string,
  code: string,
  message: string,
  history: PythonBotMessage[],
  state: Record<string, unknown>,
): Promise<TestPythonBotResult | { error: string }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };
  if (!process.env.E2B_API_KEY) {
    return { error: "Python Bot isn't configured on this deployment yet (missing E2B_API_KEY)." };
  }

  const result = await runPythonBotCode(code, { message, history, state });
  return result;
}
