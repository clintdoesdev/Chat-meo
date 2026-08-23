import { prisma } from "@/lib/prisma";
import { ensurePushConfigured, webpush } from "@/lib/push/vapid";

export type PushPayload = {
  title: string;
  body: string;
  /** App path to open (or focus) when the notification is clicked — see public/sw.js. */
  url: string;
};

/** Pushes a browser notification to every device this user has subscribed on, mirroring
 * sendSecurityAlertEmail's fire-and-forget dispatch pattern (src/lib/email/send.ts): errors are
 * logged, never thrown, so a push failure never breaks the caller's own request. A device the
 * push service reports as gone (404/410 — uninstalled browser, revoked permission) has its
 * subscription pruned here rather than surfacing as a repeat failure on every future send. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensurePushConfigured()) {
    console.warn("[push] VAPID keys not set — skipping push", { userId });
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error("[push] send failed", { userId, error });
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: staleEndpoints } } });
  }
}
