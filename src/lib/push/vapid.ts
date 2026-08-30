import webpush from "web-push";

let configured = false;
let lastConfigError: string | null = null;

/** Lazily wires up web-push's VAPID identity, mirroring getResendClient's "missing key means
 * skip, not crash" pattern in src/lib/email/resend.ts. Returns false (without throwing) when
 * the keys aren't set *or* aren't valid VAPID keys — setVapidDetails throws synchronously (e.g.
 * "Vapid public key should be 65 bytes long when decoded") for a truncated/corrupted key, which
 * used to propagate straight out of here uncaught and crash whatever request touched it, same
 * bug as ensureFcmConfigured's JSON.parse (see src/lib/push/fcm.ts's doc comment). */
export function ensurePushConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    lastConfigError = null;
    return false;
  }

  if (!configured) {
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@chatmeo.app", publicKey, privateKey);
    } catch (error) {
      lastConfigError = `VAPID keys are invalid: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[push] " + lastConfigError);
      return false;
    }
    configured = true;
  }
  lastConfigError = null;
  return true;
}

/** Set only when the VAPID keys are present but rejected by web-push — null otherwise (including
 * "never set at all") — same "set but broken" vs. "never set" distinction as fcm.ts's
 * getFcmConfigError. */
export function getVapidConfigError(): string | null {
  return lastConfigError;
}

export { webpush };
