"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMetaAppConfig } from "@/lib/whatsapp/meta-graph";

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
  /** null when META_APP_ID/META_CONFIG_ID aren't set on this deployment — the connect button
   * shows a "not configured" state instead of calling FB.init() with nothing to init. */
  appId: string | null;
  configId: string | null;
  connection: WhatsAppConnectionInfo | null;
};

/** Everything the "WhatsApp" tab needs to render: whether Embedded Signup is even configured on
 * this deployment, and this bot's current connection (if any). Read-only — connecting/updating
 * happens through POST /api/whatsapp/connect, not here, since that flow needs to run mid-signup
 * from a plain fetch() rather than a form-bound server action. */
export async function getWhatsAppConnectConfig(botId: string): Promise<WhatsAppConnectConfig | { error: string }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { botId },
    select: { status: true, isActive: true, displayPhoneNumber: true, connectedAt: true },
  });
  const metaConfig = getMetaAppConfig();

  return {
    appId: metaConfig?.appId ?? null,
    configId: metaConfig?.configId ?? null,
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
