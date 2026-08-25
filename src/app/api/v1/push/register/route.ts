import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth/token";

const BodySchema = z.object({ token: z.string().min(1) });

/** Registers (or moves ownership of) an FCM device token — called by the Android app once on
 * every app start with whatever token Firebase currently has for this install. `token` is
 * globally unique (see DeviceToken's schema doc comment): upserting on it, rather than on
 * [userId, token], is what correctly reassigns a device to a new owner after a sign-out/sign-in
 * as someone else on the same phone. */
export async function POST(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  await prisma.deviceToken.upsert({
    where: { token: parsed.data.token },
    update: { userId },
    create: { userId, token: parsed.data.token },
  });

  return NextResponse.json({ error: null });
}

/** Unregisters a device token — called on sign-out so a phone that's no longer signed in doesn't
 * keep receiving another (or its own former) user's push notifications. */
export async function DELETE(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // deleteMany rather than delete: scoped to this user so one device can't unregister a token it
  // doesn't own, and silently succeeds if it's already gone (e.g. a double sign-out tap) rather
  // than 404ing on something the client has no real recourse for.
  await prisma.deviceToken.deleteMany({ where: { userId, token: parsed.data.token } });

  return NextResponse.json({ error: null });
}
