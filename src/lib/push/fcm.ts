import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let configured = false;

/** Lazily initializes the Firebase Admin app from a service account key, mirroring
 * ensurePushConfigured's "missing key means skip, not crash" pattern in vapid.ts. Returns false
 * (without throwing) when the key isn't set, so callers can no-op a send instead of failing the
 * request it's attached to. */
export function ensureFcmConfigured(): boolean {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) return false;

  if (!configured && getApps().length === 0) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount) });
  }
  configured = true;
  return true;
}

export { getMessaging };
