import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let configured = false;
let lastConfigError: string | null = null;

/** Lazily initializes the Firebase Admin app from a service account key, mirroring
 * ensurePushConfigured's "missing key means skip, not crash" pattern in vapid.ts. Returns false
 * (without throwing) when the key isn't set *or* isn't valid JSON — a malformed
 * FIREBASE_SERVICE_ACCOUNT_JSON (the classic version of this: the private_key field's newlines
 * got mangled when the value was pasted into the hosting provider's env var UI) used to throw
 * JSON.parse's SyntaxError straight out of here uncaught, crashing every caller's request with an
 * opaque 500 instead of the same "not configured" no-op a missing key gets. lastConfigError lets
 * callers tell "never set" apart from "set but broken" instead of both looking identical. */
export function ensureFcmConfigured(): boolean {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    lastConfigError = null;
    return false;
  }

  if (!configured && getApps().length === 0) {
    let serviceAccount: object;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      lastConfigError = `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[push] " + lastConfigError);
      return false;
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  configured = true;
  lastConfigError = null;
  return true;
}

/** Set only when FIREBASE_SERVICE_ACCOUNT_JSON is present but failed to parse — null otherwise
 * (including "never set at all"), so a diagnostic can show "you set this but it's malformed"
 * instead of the same message a missing key gets. */
export function getFcmConfigError(): string | null {
  return lastConfigError;
}

export { getMessaging };
