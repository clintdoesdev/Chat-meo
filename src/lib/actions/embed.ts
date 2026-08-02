"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isValidHexColor } from "@/lib/color";
import { prisma } from "@/lib/prisma";

// Bare hostname, optionally with a leading "*." wildcard for subdomains — matches the shape
// isOriginAllowed() already expects (see src/lib/chat/origin-check.ts).
const DOMAIN_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

async function requireBotOwnership(botId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { id: true, userId: true, slug: true },
  });
  if (!bot || bot.userId !== session.user.id) return null;

  return bot;
}

function newPublicKey(): string {
  return `pk_${randomBytes(18).toString("base64url")}`;
}

export type EmbedConfig = {
  name: string;
  publicKey: string;
  primaryColor: string;
  welcomeMessage: string | null;
  widgetPosition: "BOTTOM_LEFT" | "BOTTOM_RIGHT";
  allowedDomains: string[];
  testMode: boolean;
};

/** Every bot gets exactly one API key/publicKey, created lazily the first time something needs
 * it (the "Get embed" panel) rather than at bot-creation time — keeps createBot() simple and
 * doesn't force a key to exist for bots that never get embedded. */
export async function getEmbedConfig(botId: string): Promise<EmbedConfig | { error: string }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const full = await prisma.bot.findUniqueOrThrow({
    where: { id: botId },
    select: {
      name: true,
      primaryColor: true,
      welcomeMessage: true,
      widgetPosition: true,
      testMode: true,
      apiKeys: { orderBy: { createdAt: "asc" }, take: 1, select: { publicKey: true, allowedDomains: true } },
    },
  });

  let apiKey = full.apiKeys[0];
  if (!apiKey) {
    apiKey = await prisma.botApiKey.create({
      data: { botId, publicKey: newPublicKey() },
      select: { publicKey: true, allowedDomains: true },
    });
  }

  return {
    name: full.name,
    publicKey: apiKey.publicKey,
    primaryColor: full.primaryColor,
    welcomeMessage: full.welcomeMessage,
    widgetPosition: full.widgetPosition,
    allowedDomains: apiKey.allowedDomains,
    testMode: full.testMode,
  };
}

export async function updateWidgetSettings(
  botId: string,
  input: {
    name?: string;
    primaryColor?: string;
    welcomeMessage?: string;
    widgetPosition?: "BOTTOM_LEFT" | "BOTTOM_RIGHT";
  },
): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  if (input.primaryColor !== undefined && !isValidHexColor(input.primaryColor)) {
    return { error: "Color must be a hex value like #FF5C16." };
  }

  const name = input.name?.trim();
  if (input.name !== undefined && !name) {
    return { error: "Name can't be empty." };
  }

  const welcomeMessage = input.welcomeMessage?.trim();

  await prisma.bot.update({
    where: { id: botId },
    data: {
      ...(name ? { name } : {}),
      ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      ...(input.welcomeMessage !== undefined ? { welcomeMessage: welcomeMessage || null } : {}),
      ...(input.widgetPosition !== undefined ? { widgetPosition: input.widgetPosition } : {}),
    },
  });

  revalidatePath(`/app/studio/${bot.slug}`);
  revalidatePath("/app/studio");
  revalidatePath("/app");
  return { error: null };
}

export async function addAllowedDomain(botId: string, domain: string): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const trimmed = domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(trimmed)) {
    return { error: "Enter a bare domain, like example.com or *.example.com." };
  }

  const apiKey = await prisma.botApiKey.findFirst({ where: { botId }, orderBy: { createdAt: "asc" } });
  if (!apiKey) return { error: "Generate an embed key first." };
  if (apiKey.allowedDomains.includes(trimmed)) return { error: null };

  await prisma.$transaction([
    prisma.botApiKey.update({
      where: { id: apiKey.id },
      data: { allowedDomains: { push: trimmed } },
    }),
    // Adding a real domain is the signal the owner is done testing — from here on, an empty
    // allowedDomains list means "not configured yet," not "anything goes" (see testMode's
    // doc comment on the Bot model).
    prisma.bot.update({ where: { id: botId }, data: { testMode: false } }),
  ]);

  revalidatePath(`/app/studio/${bot.slug}`);
  return { error: null };
}

export async function removeAllowedDomain(botId: string, domain: string): Promise<{ error: string | null }> {
  const bot = await requireBotOwnership(botId);
  if (!bot) return { error: "Bot not found." };

  const apiKey = await prisma.botApiKey.findFirst({ where: { botId }, orderBy: { createdAt: "asc" } });
  if (!apiKey) return { error: null };

  await prisma.botApiKey.update({
    where: { id: apiKey.id },
    data: { allowedDomains: apiKey.allowedDomains.filter((d) => d !== domain) },
  });

  revalidatePath(`/app/studio/${bot.slug}`);
  return { error: null };
}
