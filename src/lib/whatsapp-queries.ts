import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getMetaAppConfig, unsubscribeAppFromWaba } from "@/lib/whatsapp/meta-graph";

async function requireBotOwnershipFor(userId: string, botId: string) {
  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true } });
  if (!bot || bot.userId !== userId) return null;
  return bot;
}

export type WhatsAppConnectionInfo = {
  status: "CONNECTED" | "DISCONNECTED" | "TOKEN_EXPIRED" | "BANNED";
  isActive: boolean;
  displayPhoneNumber: string;
  connectedAt: string;
};

export type WhatsAppConnectConfig = {
  configured: boolean;
  connection: WhatsAppConnectionInfo | null;
};

/** Same logic as the web Studio's own getWhatsAppConnectConfig Server Action
 * (src/lib/actions/whatsapp.ts, now a thin wrapper over this), extracted so the mobile REST API
 * can reuse it without duplicating the ownership check. */
export async function getWhatsAppConnectConfigForUser(
  userId: string,
  botId: string,
): Promise<WhatsAppConnectConfig | { error: string }> {
  const bot = await requireBotOwnershipFor(userId, botId);
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

export async function setWhatsAppActiveForUser(
  userId: string,
  botId: string,
  isActive: boolean,
): Promise<{ error: string | null }> {
  const bot = await requireBotOwnershipFor(userId, botId);
  if (!bot) return { error: "Bot not found." };

  const connection = await prisma.whatsAppConnection.findUnique({ where: { botId }, select: { status: true } });
  if (!connection || connection.status === "DISCONNECTED") {
    return { error: "This bot isn't connected to WhatsApp." };
  }

  await prisma.whatsAppConnection.update({ where: { botId }, data: { isActive } });
  return { error: null };
}

export async function disconnectWhatsAppForUser(userId: string, botId: string): Promise<{ error: string | null }> {
  const bot = await requireBotOwnershipFor(userId, botId);
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
