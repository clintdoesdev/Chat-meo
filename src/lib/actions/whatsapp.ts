"use server";

import { auth } from "@/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getMetaAppConfig, unsubscribeAppFromWaba } from "@/lib/whatsapp/meta-graph";

async function requireBotOwnership(botId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true } });
  if (!bot || bot.userId !== session.user.id) return null;

  return bot;
}

export type WhatsAppConnectionInfo = {
  status: "CONNECTED" | "DISCONNECTED" | "TOKEN_EXPIRED";
  isActive: boolean;
  displayPhoneNumber: string;
  connectedAt: string;
};

export type WhatsAppConnectConfig = {
  /** False when META_APP_ID/META_APP_SECRET/META_CONFIG_ID aren't all set on this deployment —
   * the connect button shows a "not configured" state instead of a link to a redirect that would
   * just fail. The client never needs the values themselves: /api/whatsapp/connect/start builds
   * Meta's redirect URL server-side, so nothing Meta-specific has to reach the browser at all. */
  configured: boolean;
  connection: WhatsAppConnectionInfo | null;
};

/** Everything the "WhatsApp" card needs to render: whether Embedded Signup is even configured on
 * this deployment, and this bot's current connection (if any). Read-only — connecting happens
 * through the /api/whatsapp/connect/start → Meta → /api/whatsapp/connect/callback redirect
 * chain, not here. */
export async function getWhatsAppConnectConfig(botId: string): Promise<WhatsAppConnectConfig | { error: string }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { botId },
    select: { status: true, isActive: true, displayPhoneNumber: true, connectedAt: true },
  });

  return {
    configured: getMetaAppConfig() !== null,
    connection: connection
      ? {
          status: connection.status,
          isActive: connection.isActive,
          displayPhoneNumber: connection.displayPhoneNumber,
          connectedAt: connection.connectedAt.toISOString(),
        }
      : null,
  };
}

/** The seller's own pause/live toggle (not Meta's connection health) — while paused, the webhook
 * still stores inbound messages for the Inbox, but the runtime engine never runs and nothing
 * gets sent back. Meta's subscription is untouched: this is reversible with one click, unlike
 * disconnectWhatsApp below. */
export async function setWhatsAppActive(botId: string, isActive: boolean): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const connection = await prisma.whatsAppConnection.findUnique({ where: { botId }, select: { status: true } });
  if (!connection || connection.status === "DISCONNECTED") {
    return { error: "This bot isn't connected to WhatsApp." };
  }

  await prisma.whatsAppConnection.update({ where: { botId }, data: { isActive } });
  return { error: null };
}

/**
 * Fully revokes this bot's WhatsApp connection — the opposite of setWhatsAppActive's pause,
 * which only stops automated replies while leaving Meta's subscription intact. Disconnecting
 * unsubscribes our app from the WABA's webhook (best-effort: a token that's already expired or
 * revoked on Meta's side can't be unsubscribed with, but the local connection still needs to
 * come down either way, so that failure doesn't block it) and clears the stored token — there's
 * nothing left to reconnect with short of redoing Embedded Signup from scratch.
 */
export async function disconnectWhatsApp(botId: string): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { botId },
    select: { wabaId: true, accessToken: true, status: true },
  });
  if (!connection || connection.status === "DISCONNECTED") {
    return { error: null };
  }

  if (connection.accessToken) {
    try {
      await unsubscribeAppFromWaba(connection.wabaId, decrypt(connection.accessToken));
    } catch (error) {
      console.warn("[whatsapp] failed to unsubscribe from Meta during disconnect — proceeding anyway", {
        botId,
        error,
      });
    }
  }

  await prisma.whatsAppConnection.update({
    where: { botId },
    data: { status: "DISCONNECTED", isActive: false, accessToken: null },
  });
  return { error: null };
}
