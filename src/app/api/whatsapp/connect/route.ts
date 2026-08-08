import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  discoverWhatsAppAssets,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchDisplayPhoneNumber,
  MetaGraphError,
  requireMetaAppConfig,
  subscribeAppToWaba,
} from "@/lib/whatsapp/meta-graph";

const BodySchema = z.object({
  botId: z.string().min(1),
  code: z.string().min(1),
  // The Embedded Signup postMessage 'FINISH' event hands these over directly on the happy path
  // (see the connect button component) — passed through when present so the server can skip its
  // own discovery round trip. All optional: discoverWhatsAppAssets() is the fallback when they
  // didn't make it through.
  wabaId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
  displayPhoneNumber: z.string().min(1).optional(),
});

/**
 * Finishes the WhatsApp Embedded Signup flow: exchanges the auth code FB.login's callback
 * handed the client for a long-lived access token, resolves which WABA/phone number it was
 * granted for, subscribes our app to that WABA's webhook, and stores the (encrypted) result as
 * this bot's WhatsAppConnection. Gated on the requesting user owning the bot — this is a
 * powerful action (grants our app standing access to someone's WhatsApp number), so an
 * ownership mismatch is treated the same as a 404 rather than a 403, matching the
 * no-enumeration convention used for auth elsewhere in this app.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const {
    botId,
    code,
    wabaId: clientWabaId,
    phoneNumberId: clientPhoneNumberId,
    displayPhoneNumber: clientDisplayPhoneNumber,
  } = parsed.data;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { userId: true } });
  if (!bot || bot.userId !== session.user.id) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404 });
  }

  try {
    requireMetaAppConfig();
  } catch (error) {
    console.error("[whatsapp/connect] Meta app not configured:", error);
    return NextResponse.json({ error: "WhatsApp connect isn't configured on this deployment yet." }, { status: 500 });
  }

  try {
    const shortLivedToken = await exchangeCodeForToken(code);
    const accessToken = await exchangeForLongLivedToken(shortLivedToken);

    let wabaId: string;
    let phoneNumberId: string;
    let displayPhoneNumber: string;

    if (clientWabaId && clientPhoneNumberId) {
      wabaId = clientWabaId;
      phoneNumberId = clientPhoneNumberId;
      displayPhoneNumber = clientDisplayPhoneNumber ?? (await fetchDisplayPhoneNumber(phoneNumberId, accessToken));
    } else {
      const assets = await discoverWhatsAppAssets(accessToken);
      wabaId = assets.wabaId;
      phoneNumberId = assets.phoneNumberId;
      displayPhoneNumber = assets.displayPhoneNumber;
    }

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

    return NextResponse.json({ ok: true, displayPhoneNumber });
  } catch (error) {
    if (error instanceof MetaGraphError) {
      console.error(`[whatsapp/connect] failed at "${error.step}":`, error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    // phoneNumberId is globally unique (see the schema doc comment) — this fires when the
    // WhatsApp number just signed up is already linked to a different bot.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This WhatsApp number is already connected to another bot." },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("[whatsapp/connect] unexpected failure:", error);
    return NextResponse.json({ error: `Couldn't connect WhatsApp: ${message}` }, { status: 500 });
  }
}
