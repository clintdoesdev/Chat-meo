import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildEmbeddedSignupUrl, requireMetaAppConfig } from "@/lib/whatsapp/meta-graph";
import { WHATSAPP_CONNECT_STATE_COOKIE } from "@/lib/whatsapp/connect-state";

/**
 * Kicks off WhatsApp Embedded Signup as a full-page redirect to Meta, rather than the Facebook
 * JS SDK's popup — see buildEmbeddedSignupUrl's doc comment for why. A plain link to this route
 * (not a fetch()) is all the "Connect WhatsApp" button needs to do; everything else — ownership
 * check, CSRF-style state, building Meta's URL — happens here before the browser ever leaves
 * chatmeo.app.
 */
export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get("botId");
  if (!botId) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { userId: true } });
  if (!bot || bot.userId !== session.user.id) {
    return NextResponse.redirect(new URL("/app?whatsapp=error", request.url));
  }

  try {
    requireMetaAppConfig();
  } catch (error) {
    console.error("[whatsapp/connect/start] Meta app not configured:", error);
    return NextResponse.redirect(new URL("/app?whatsapp=error", request.url));
  }

  // Bound to this specific bot + a random nonce, and checked against the cookie set below when
  // Meta redirects back — without this, someone could forge a `state` on the callback URL and
  // have an attacker-controlled WhatsApp number linked to a victim's bot (classic OAuth CSRF).
  const nonce = randomBytes(16).toString("hex");
  const state = `${botId}.${nonce}`;
  const redirectUri = new URL("/api/whatsapp/connect/callback", request.url).toString();

  const response = NextResponse.redirect(buildEmbeddedSignupUrl({ redirectUri, state }));
  response.cookies.set(WHATSAPP_CONNECT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/whatsapp/connect",
  });
  return response;
}
