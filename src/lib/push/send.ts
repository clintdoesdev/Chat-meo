import { prisma } from "@/lib/prisma";
import { ensureFcmConfigured, getFcmConfigError, getMessaging } from "@/lib/push/fcm";
import { ensurePushConfigured, webpush } from "@/lib/push/vapid";

export type PushPayload = {
  title: string;
  body: string;
  /** App path to open (or focus) when the notification is clicked — see public/sw.js. */
  url: string;
};

export type WebPushDiagnostics =
  | { configured: false }
  | { configured: true; subscriptionCount: number; sent: number; failed: { statusCode?: number; message: string }[] };

export type FcmDiagnostics =
  | { configured: false; configError: string | null }
  | { configured: true; tokenCount: number; sent: number; failed: { code?: string; message: string }[] };

export type PushDiagnostics = { webPush: WebPushDiagnostics; fcm: FcmDiagnostics };

/** Pushes a notification to every device this user has registered — both the web app (browser
 * Push API, via VAPID) and the native Android app (FCM) — mirroring sendSecurityAlertEmail's
 * fire-and-forget dispatch pattern (src/lib/email/send.ts): errors are logged, never thrown, so a
 * push failure never breaks the caller's own request. A device either channel reports as gone
 * (a stale web PushSubscription endpoint, or an unregistered FCM token) has its row pruned here
 * rather than surfacing as a repeat failure on every future send. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  await Promise.all([sendWebPush(userId, payload), sendFcmPush(userId, payload)]);
}

/** Same two sends as sendPushToUser, but returns what actually happened on each channel instead
 * of swallowing it — used by the "send me a test push" diagnostic (see /api/push/test and
 * /api/v1/push/test) so a real device/account with real webhook traffic can be checked without
 * anyone needing server log access. */
export async function sendTestPush(userId: string): Promise<PushDiagnostics> {
  const payload: PushPayload = {
    title: "Chatmeo test notification",
    body: "If you can see this, push notifications are working for this device.",
    url: "/app/inbox",
  };
  const [webPush, fcm] = await Promise.all([sendWebPush(userId, payload), sendFcmPush(userId, payload)]);
  return { webPush, fcm };
}

async function sendWebPush(userId: string, payload: PushPayload): Promise<WebPushDiagnostics> {
  if (!ensurePushConfigured()) {
    console.warn("[push] VAPID keys not set — skipping web push", { userId });
    return { configured: false };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return { configured: true, subscriptionCount: 0, sent: 0, failed: [] };

  const body = JSON.stringify(payload);
  const staleEndpoints: string[] = [];
  const failed: { statusCode?: number; message: string }[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const message = error instanceof Error ? error.message : String(error);
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error("[push] web push send failed", { userId, error });
        }
        failed.push({ statusCode, message });
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: staleEndpoints } } });
  }

  return { configured: true, subscriptionCount: subscriptions.length, sent, failed };
}

async function sendFcmPush(userId: string, payload: PushPayload): Promise<FcmDiagnostics> {
  if (!ensureFcmConfigured()) {
    const configError = getFcmConfigError();
    console.warn(
      configError
        ? "[push] FIREBASE_SERVICE_ACCOUNT_JSON is set but invalid — skipping FCM push"
        : "[push] FIREBASE_SERVICE_ACCOUNT_JSON not set — skipping FCM push",
      { userId, configError },
    );
    return { configured: false, configError };
  }

  const deviceTokens = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
  if (deviceTokens.length === 0) return { configured: true, tokenCount: 0, sent: 0, failed: [] };

  const response = await getMessaging()
    .sendEachForMulticast({
      tokens: deviceTokens.map((d) => d.token),
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url },
      android: { notification: { channelId: "chatmeo_messages", color: "#FF5C16" } },
    })
    .catch((error) => {
      console.error("[push] FCM send failed", { userId, error });
      return null;
    });
  if (!response) {
    const message = "FCM multicast send threw before returning any per-token result — see server logs.";
    return { configured: true, tokenCount: deviceTokens.length, sent: 0, failed: [{ message }] };
  }

  // Same pruning logic as the web-push branch above, keyed on FCM's own "this token is dead"
  // error codes (app uninstalled, token rotated without us hearing about it yet) rather than an
  // HTTP status code.
  const staleTokens: string[] = [];
  const failed: { code?: string; message: string }[] = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    const message = result.error?.message ?? "Unknown FCM error.";
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      staleTokens.push(deviceTokens[index].token);
    }
    failed.push({ code, message });
  });

  if (staleTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: staleTokens } } });
  }

  return { configured: true, tokenCount: deviceTokens.length, sent: response.successCount, failed };
}
