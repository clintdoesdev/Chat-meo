"use server";

import { auth } from "@/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  getMetaAppConfig,
  getWhatsAppBusinessProfile,
  MetaGraphError,
  requestWhatsAppDisplayNameChange,
  unsubscribeAppFromWaba,
  updateWhatsAppProfilePicture,
} from "@/lib/whatsapp/meta-graph";

async function requireBotOwnership(botId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true } });
  if (!bot || bot.userId !== session.user.id) return null;

  return bot;
}

export type WhatsAppConnectionInfo = {
  status: "CONNECTED" | "DISCONNECTED" | "TOKEN_EXPIRED" | "BANNED";
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

/** Shared guard for the profile actions below — all three need a live, usable access token, not
 * just any connection row (a DISCONNECTED one has none to call Meta with). */
async function requireActiveConnection(
  botId: string,
): Promise<{ phoneNumberId: string; accessToken: string } | { error: string }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { botId },
    select: { phoneNumberId: true, accessToken: true, status: true },
  });
  if (!connection || connection.status === "DISCONNECTED" || !connection.accessToken) {
    return { error: "This bot isn't connected to WhatsApp." };
  }
  return { phoneNumberId: connection.phoneNumberId, accessToken: decrypt(connection.accessToken) };
}

function metaErrorMessage(error: unknown, fallback: string): string {
  return error instanceof MetaGraphError ? error.message : fallback;
}

export type WhatsAppBusinessProfileInfo = {
  name: string | null;
  nameStatus: string | null;
  profilePictureUrl: string | null;
};

/** Live read of this bot's WhatsApp display name (+ Meta's review status for it) and current
 * profile picture — see getWhatsAppBusinessProfile's doc comment for why this is never cached. */
export async function getWhatsAppBusinessProfileInfo(
  botId: string,
): Promise<{ profile: WhatsAppBusinessProfileInfo | null; error: string | null }> {
  const conn = await requireActiveConnection(botId);
  if ("error" in conn) return { profile: null, error: conn.error };

  try {
    const profile = await getWhatsAppBusinessProfile(conn.phoneNumberId, conn.accessToken);
    return { profile, error: null };
  } catch (error) {
    return { profile: null, error: metaErrorMessage(error, "Couldn't load your WhatsApp business profile.") };
  }
}

const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

/** Uploads and sets a new WhatsApp profile picture, from a data: URI produced by the same
 * FileReader pattern the bot avatar upload uses (see bot-settings-modal.tsx). Takes effect
 * immediately — no Meta review, unlike the display name below. */
export async function updateWhatsAppProfilePictureAction(botId: string, dataUri: string): Promise<{ error: string | null }> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!match) return { error: "That doesn't look like a valid image." };
  const [, mimeType, base64] = match;
  if (!mimeType.startsWith("image/")) return { error: "Please upload an image file." };

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_PROFILE_PICTURE_BYTES) return { error: "Image is too large — try one under 5MB." };

  const conn = await requireActiveConnection(botId);
  if ("error" in conn) return { error: conn.error };

  try {
    await updateWhatsAppProfilePicture(conn.phoneNumberId, bytes, mimeType, conn.accessToken);
    return { error: null };
  } catch (error) {
    return { error: metaErrorMessage(error, "Failed to update the profile picture.") };
  }
}

const MAX_DISPLAY_NAME_LENGTH = 60;

/** Submits a new display name for Meta's review (see requestWhatsAppDisplayNameChange's doc
 * comment) — success here means "submitted," not "changed." Callers should show Meta's error
 * message verbatim on failure rather than a generic one: this call isn't built against a fully
 * documented endpoint, so a rejection's exact reason is the most useful thing we can surface. */
export async function requestWhatsAppNameChangeAction(botId: string, newName: string): Promise<{ error: string | null }> {
  const trimmed = newName.trim();
  if (!trimmed) return { error: "Enter a name." };
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) return { error: `Name is too long (max ${MAX_DISPLAY_NAME_LENGTH} characters).` };

  const conn = await requireActiveConnection(botId);
  if ("error" in conn) return { error: conn.error };

  try {
    await requestWhatsAppDisplayNameChange(conn.phoneNumberId, trimmed, conn.accessToken);
    return { error: null };
  } catch (error) {
    return { error: metaErrorMessage(error, "Failed to request the name change.") };
  }
}
