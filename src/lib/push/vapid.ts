import webpush from "web-push";

let configured = false;

/** Lazily wires up web-push's VAPID identity, mirroring getResendClient's "missing key means
 * skip, not crash" pattern in src/lib/email/resend.ts. Returns false (without throwing) when
 * the keys aren't set, so callers can no-op a send instead of failing the request it's attached
 * to. */
export function ensurePushConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@chatmeo.app", publicKey, privateKey);
    configured = true;
  }
  return true;
}

export { webpush };
