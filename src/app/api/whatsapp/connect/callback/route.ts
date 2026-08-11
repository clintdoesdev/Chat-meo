import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { completeWhatsAppConnection } from "@/lib/whatsapp/complete-connection";
import { WHATSAPP_CONNECT_STATE_COOKIE } from "@/lib/whatsapp/connect-state";

function redirectWithStatus(
  request: NextRequest,
  status: string,
  extra?: { botId?: string; step?: string },
): NextResponse {
  const url = new URL("/app", request.url);
  url.searchParams.set("whatsapp", status);
  if (extra?.botId) url.searchParams.set("botId", extra.botId);
  if (extra?.step) url.searchParams.set("step", extra.step);

  const response = NextResponse.redirect(url);
  // One-time use — whether this callback succeeds, fails, or is malformed, the nonce is spent.
  response.cookies.set(WHATSAPP_CONNECT_STATE_COOKIE, "", { path: "/api/whatsapp/connect", maxAge: 0 });
  return response;
}

/**
 * Where Meta redirects back to after WhatsApp Embedded Signup — see
 * src/app/api/whatsapp/connect/start/route.ts for how this got started, and
 * buildEmbeddedSignupUrl's doc comment in meta-graph.ts for why this is a redirect rather than
 * the Facebook JS SDK's popup. Every exit path lands back on /app with a `?whatsapp=` status
 * (plus `botId` once we know it, and `step` on failure) that the dashboard's
 * WhatsAppConnectRedirectHandler reads — reopening that bot's settings on the Deploy & channels
 * tab, showing a toast, and clearing the query string.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  // The bot this attempt was for, if `state` at least looks well-formed enough to read it —
  // even a request we're about to reject on other grounds (bad nonce, no session) can still
  // carry a real botId worth sending the seller back to, rather than the bare dashboard.
  const botIdHint = state?.split(".")[0];

  if (oauthError) {
    // access_denied is the seller backing out of the flow partway through — not a real failure,
    // so it gets its own, less alarming status than a genuine error.
    return redirectWithStatus(request, oauthError === "access_denied" ? "cancelled" : "error", { botId: botIdHint });
  }

  const expectedState = request.cookies.get(WHATSAPP_CONNECT_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, "error", { botId: botIdHint, step: "state verification" });
  }

  const botId = state.split(".")[0];

  const session = await auth();
  if (!session?.user) {
    return redirectWithStatus(request, "error", { botId, step: "authentication" });
  }

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { userId: true } });
  if (!bot || bot.userId !== session.user.id) {
    return redirectWithStatus(request, "error", { botId, step: "ownership check" });
  }

  const result = await completeWhatsAppConnection(botId, code);
  return redirectWithStatus(request, result.ok ? "connected" : "error", {
    botId,
    step: result.ok ? undefined : result.step,
  });
}
