"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Registers (or re-registers) this browser's push subscription against the signed-in user.
 * Upserted on `endpoint` — the push service's own per-device identifier — so re-subscribing the
 * same browser (e.g. after clearing site data) just refreshes its keys rather than duplicating. */
export async function subscribeToPush(subscription: PushSubscriptionInput): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to do that." };

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return { error: null };
}

/** Drops this browser's subscription — called when the user turns notifications off, or when
 * the browser itself reports the subscription expired. Scoped to the signed-in user so one
 * browser can't unsubscribe another user's device. */
export async function unsubscribeFromPush(endpoint: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to do that." };

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  return { error: null };
}
