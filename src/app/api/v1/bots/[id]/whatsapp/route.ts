import { NextResponse, type NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth/token";
import {
  disconnectWhatsAppForUser,
  getWhatsAppConnectConfigForUser,
  setWhatsAppActiveForUser,
} from "@/lib/whatsapp-queries";

/** Mobile's equivalent of the web Settings modal's WhatsApp card (src/components/app/
 * whatsapp-connect-panel.tsx) — status/toggle/disconnect only. Connecting or reconnecting a
 * number still goes through Meta's Embedded Signup, which is a full-page browser redirect flow
 * (see /api/whatsapp/connect/start's doc comment) — the mobile app opens that URL in an in-app
 * browser rather than reimplementing OAuth natively. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const result = await getWhatsAppConnectConfigForUser(userId, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if ("disconnect" in json && json.disconnect === true) {
    const result = await disconnectWhatsAppForUser(userId, id);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  }

  if ("isActive" in json && typeof json.isActive === "boolean") {
    const result = await setWhatsAppActiveForUser(userId, id, json.isActive);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  }

  return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
}
