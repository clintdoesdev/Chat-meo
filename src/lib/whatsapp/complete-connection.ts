// Shared by the WhatsApp connect OAuth callback route — finishes the Embedded Signup flow once
// Meta has redirected back with an auth code: exchanges it for a long-lived access token,
// resolves which WABA/phone number was granted, subscribes our webhook to it, and persists the
// (encrypted) result as this bot's WhatsAppConnection.
import { Prisma } from "@/generated/prisma/client";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  discoverWhatsAppAssets,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  MetaGraphError,
  subscribeAppToWaba,
} from "@/lib/whatsapp/meta-graph";

export type CompleteWhatsAppConnectionResult =
  | { ok: true; displayPhoneNumber: string }
  | { ok: false; status: number; error: string };

export async function completeWhatsAppConnection(botId: string, code: string): Promise<CompleteWhatsAppConnectionResult> {
  try {
    const shortLivedToken = await exchangeCodeForToken(code);
    const accessToken = await exchangeForLongLivedToken(shortLivedToken);
    const { wabaId, phoneNumberId, displayPhoneNumber } = await discoverWhatsAppAssets(accessToken);

    await subscribeAppToWaba(wabaId, accessToken);

    const connectedAt = new Date();
    await prisma.whatsAppConnection.upsert({
      where: { botId },
      create: {
        botId,
        wabaId,
        phoneNumberId,
        displayPhoneNumber,
        accessToken: encrypt(accessToken),
        status: "CONNECTED",
        isActive: true,
        connectedAt,
      },
      update: {
        wabaId,
        phoneNumberId,
        displayPhoneNumber,
        accessToken: encrypt(accessToken),
        status: "CONNECTED",
        isActive: true,
        connectedAt,
      },
    });

    return { ok: true, displayPhoneNumber };
  } catch (error) {
    if (error instanceof MetaGraphError) {
      console.error(`[whatsapp/connect] failed at "${error.step}":`, error.message);
      return { ok: false, status: 502, error: error.message };
    }
    // phoneNumberId is globally unique (see the schema doc comment) — this fires when the
    // WhatsApp number just signed up is already linked to a different bot.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, status: 409, error: "This WhatsApp number is already connected to another bot." };
    }
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("[whatsapp/connect] unexpected failure:", error);
    return { ok: false, status: 500, error: `Couldn't connect WhatsApp: ${message}` };
  }
}
