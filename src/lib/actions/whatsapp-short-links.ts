"use server";

import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireBotOwnership(botId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true } });
  if (!bot || bot.userId !== session.user.id) return null;

  return bot;
}

// Short and URL-safe (8 base64url chars from 6 random bytes) — collisions are handled by retrying
// on Prisma's unique constraint below rather than checked for up front, since at this length a
// collision is astronomically unlikely and a retry loop costs nothing in the rare case it happens.
function newSlug(): string {
  return randomBytes(6).toString("base64url");
}

const MAX_SLUG_ATTEMPTS = 5;

export type WhatsAppShortLinkInfo = {
  id: string;
  slug: string;
  label: string;
  message: string;
  clickCount: number;
  createdAt: string;
};

/** Every click-to-chat link created for this bot, newest first — see WhatsAppShortLinkPanel. */
export async function listWhatsAppShortLinks(
  botId: string,
): Promise<{ links: WhatsAppShortLinkInfo[]; error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { links: [], error: "Bot not found." };

  const rows = await prisma.whatsAppShortLink.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
  });
  return {
    links: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      message: row.message,
      clickCount: row.clickCount,
      createdAt: row.createdAt.toISOString(),
    })),
    error: null,
  };
}

const MAX_LABEL_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 1000;

/** Creates a click-to-chat short link, snapshotting the bot's currently connected WhatsApp
 * number (see WhatsAppShortLink.phoneNumber's doc comment in schema.prisma) — requires an active
 * connection since a link with nowhere to point would be useless the moment it's shared. */
export async function createWhatsAppShortLink(
  botId: string,
  input: { label: string; message: string },
): Promise<{ link: WhatsAppShortLinkInfo | null; error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { link: null, error: "Bot not found." };

  const label = input.label.trim();
  const message = input.message.trim();
  if (!label) return { link: null, error: "Give this link a name." };
  if (label.length > MAX_LABEL_LENGTH) return { link: null, error: `Name is too long (max ${MAX_LABEL_LENGTH} characters).` };
  if (!message) return { link: null, error: "Enter the message this link should pre-fill." };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { link: null, error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { botId },
    select: { status: true, displayPhoneNumber: true },
  });
  if (!connection || connection.status === "DISCONNECTED") {
    return { link: null, error: "Connect WhatsApp before creating a short link." };
  }
  // wa.me wants digits only — no "+", spaces, or other formatting Meta's displayPhoneNumber may
  // include.
  const phoneNumber = connection.displayPhoneNumber.replace(/\D/g, "");

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    try {
      const row = await prisma.whatsAppShortLink.create({
        data: { botId, slug: newSlug(), label, message, phoneNumber },
      });
      return {
        link: {
          id: row.id,
          slug: row.slug,
          label: row.label,
          message: row.message,
          clickCount: row.clickCount,
          createdAt: row.createdAt.toISOString(),
        },
        error: null,
      };
    } catch (error) {
      // P2002 = unique constraint violation on `slug` — vanishingly unlikely at 8 base64url
      // chars, but retried with a fresh random slug rather than surfaced as a failure.
      const isSlugCollision =
        error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002";
      if (!isSlugCollision) throw error;
    }
  }
  return { link: null, error: "Couldn't generate a unique link — try again." };
}

/** Deletes a short link — it stops redirecting immediately; anyone who already clicked it before
 * that isn't affected (the message they sent is already in WhatsApp). */
export async function deleteWhatsAppShortLink(botId: string, linkId: string): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  await prisma.whatsAppShortLink.deleteMany({ where: { id: linkId, botId } });
  return { error: null };
}
