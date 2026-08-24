import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders } from "@/lib/chat/cors";
import { isChatRequestAllowed, isOwnHost, resolveEmbedHostname } from "@/lib/chat/origin-check";
import { resolveBotAccess } from "@/lib/chat/run-turn";
import { chatRateLimiter } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

/**
 * Lets the widget restore a returning visitor's conversation on load, instead of starting a
 * fresh one every time the iframe re-opens. Scoped by (botPublicKey, visitorId) together —
 * visitorId is effectively a bearer credential here (same trust model /api/chat already uses
 * for that pair), so this intentionally never lists or searches across visitors.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  const botPublicKey = request.nextUrl.searchParams.get("botPublicKey");
  const visitorId = request.nextUrl.searchParams.get("visitorId");
  if (!botPublicKey || !visitorId) {
    return NextResponse.json({ error: "Missing botPublicKey or visitorId." }, { status: 400, headers: cors });
  }

  const access = await resolveBotAccess(botPublicKey);
  if (!access || !access.live) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404, headers: cors });
  }

  const embedHost = resolveEmbedHostname(request);
  if (!isOwnHost(embedHost, request) && !isChatRequestAllowed(embedHost, access)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors });
  }

  if (!(await chatRateLimiter.consume(`history:${visitorId}`))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: cors });
  }

  const apiKey = await prisma.botApiKey.findUnique({
    where: { publicKey: botPublicKey },
    select: { botId: true },
  });
  if (!apiKey) {
    return NextResponse.json({ error: "Bot not found." }, { status: 404, headers: cors });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { botId: apiKey.botId, visitorId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, contentType: true, caption: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ found: false, messages: [], ended: false }, { headers: cors });
  }

  return NextResponse.json(
    {
      found: true,
      messages: conversation.messages,
      ended: conversation.status === "RESOLVED" || conversation.status === "HANDOFF",
    },
    { headers: cors },
  );
}
