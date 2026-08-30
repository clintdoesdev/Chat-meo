import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let configured = false;
let lastConfigError: string | null = null;

/** Lazily initializes the Firebase Admin app from a service account key, mirroring
 * ensurePushConfigured's "missing key means skip, not crash" pattern in vapid.ts. Returns false
 * (without throwing) when the key isn't set, isn't valid JSON, or is valid JSON that isn't a
 * usable service account (missing project_id/client_email/private_key — cert() validates this
 * itself and throws). All three used to propagate straight out of here uncaught and crash
 * whatever request touched it with an opaque 500 instead of the same "not configured" no-op a
 * missing key gets — this wraps the whole init, not just the JSON.parse step, so every one of
 * them fails the same clean way. lastConfigError lets callers tell "never set" apart from "set
 * but broken" instead of both looking identical. */
export function ensureFcmConfigured(): boolean {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    lastConfigError = null;
    return false;
  }

  if (!configured && getApps().length === 0) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (error) {
      lastConfigError = `FIREBASE_SERVICE_ACCOUNT_JSON is set but unusable: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[push] " + lastConfigError);
      return false;
    }
  }
  configured = true;
  lastConfigError = null;
  return true;
}

/** Set only when FIREBASE_SERVICE_ACCOUNT_JSON is present but failed to parse or initialize —
 * null otherwise (including "never set at all"), so a diagnostic can show "you set this but it's
 * broken" instead of the same message a missing key gets. */
export function getFcmConfigError(): string | null {
  return lastConfigError;
}

export { getMessaging };
