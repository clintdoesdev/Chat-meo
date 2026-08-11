import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { completeWhatsAppConnection } from "@/lib/whatsapp/complete-connection";
import { WHATSAPP_CONNECT_STATE_COOKIE } from "@/lib/whatsapp/connect-state";

function redirectWithStatus(request: NextRequest, status: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/app?whatsapp=${status}`, request.url));
  // One-time use — whether this callback succeeds, fails, or is malformed, the nonce is spent.
  response.cookies.set(WHATSAPP_CONNECT_STATE_COOKIE, "", { path: "/api/whatsapp/connect", maxAge: 0 });
  return response;
}

/**
 * Where Meta redirects back to after WhatsApp Embedded Signup — see
 * src/app/api/whatsapp/connect/start/route.ts for how this got started, and
 * buildEmbeddedSignupUrl's doc comment in meta-graph.ts for why this is a redirect rather than
 * the Facebook JS SDK's popup. Every exit path lands back on /app with a `?whatsapp=` status the
 * dashboard's toast (WhatsAppConnectStatusToast) reads and clears.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  if (oauthError) {
    // access_denied is the seller backing out of the flow partway through — not a real failure,
    // so it gets its own, less alarming status than a genuine error.
    return redirectWithStatus(request, oauthError === "access_denied" ? "cancelled" : "error");
  }

  const expectedState = request.cookies.get(WHATSAPP_CONNECT_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, "error");
  }

  const botId = state.split(".")[0];

  const session = await auth();
  if (!session?.user) {
    return redirectWithStatus(request, "error");
  }

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { userId: true } });
  if (!bot || bot.userId !== session.user.id) {
    return redirectWithStatus(request, "error");
  }

  const result = await completeWhatsAppConnection(botId, code);
  return redirectWithStatus(request, result.ok ? "connected" : "error");
}
