"use client";

import { useEffect, useState } from "react";
import { CommsBellIcon } from "@/components/icons";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/actions/push";
import type { PushDiagnostics } from "@/lib/push/send";

function describeTestResult(result: PushDiagnostics): string {
  const fcm = !result.fcm.configured
    ? "FCM: server has no Firebase key configured."
    : result.fcm.tokenCount === 0
      ? "FCM: no Android device token on file."
      : result.fcm.sent > 0
        ? `FCM: sent to ${result.fcm.sent}/${result.fcm.tokenCount} device(s).`
        : `FCM: send failed — ${result.fcm.failed.map((f) => `${f.code ?? "error"}: ${f.message}`).join("; ")}`;

  const web = !result.webPush.configured
    ? "Web push: server has no VAPID keys configured."
    : result.webPush.subscriptionCount === 0
      ? "Web push: no browser subscription on file."
      : result.webPush.sent > 0
        ? `Web push: sent to ${result.webPush.sent}/${result.webPush.subscriptionCount} subscription(s).`
        : `Web push: send failed — ${result.webPush.failed.map((f) => `${f.statusCode ?? "error"}: ${f.message}`).join("; ")}`;

  return `${fcm}\n${web}`;
}

/** web-push's applicationServerKey wants raw bytes, not the base64url string VAPID keys are
 * normally shared as. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/** Row inside NotificationsMenu's dropdown that turns browser push on/off for this device —
 * handoffs and new inbox messages (see src/lib/push/send.ts for what triggers a send). Renders
 * nothing when the browser doesn't support the Push API, or NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't
 * configured, so a beta deploy without VAPID keys set just quietly omits the row. */
export function PushSubscriptionToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return;
    }
    setSupported(true);

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        const existing = await registration.pushManager.getSubscription();
        setSubscribed(Boolean(existing));
      })
      .catch((error) => console.error("[push] service worker registration failed", error));
  }, []);

  async function handleToggle() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || busy) return;
    setBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;

      if (subscribed) {
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await unsubscribeFromPush(existing.endpoint);
          await existing.unsubscribe();
        }
        setSubscribed(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await subscribeToPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
      setSubscribed(true);
    } catch (error) {
      console.error("[push] toggle failed", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/push/test");
      const bodyText = await response.text();
      if (!response.ok) {
        setTestResult(`HTTP ${response.status} — ${bodyText.slice(0, 300)}`);
        return;
      }
      const json = JSON.parse(bodyText) as PushDiagnostics | { error: string };
      setTestResult("error" in json ? json.error : describeTestResult(json));
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setTesting(false);
    }
  }

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        data-fx-skip
        onClick={handleToggle}
        disabled={busy}
        aria-pressed={subscribed}
        className="flex w-full items-center gap-2 rounded-[11px] px-3 py-2.5 text-left text-[12.5px] font-medium text-muted transition-colors hover:bg-card-2 hover:text-text disabled:opacity-50"
      >
        <CommsBellIcon size={13} className={subscribed ? "text-orange-2" : undefined} />
        {subscribed ? "Push notifications on" : "Enable push notifications"}
      </button>
      {subscribed ? (
        <button
          type="button"
          data-fx-skip
          onClick={handleTest}
          disabled={testing}
          className="flex w-full items-center gap-2 rounded-[11px] px-3 py-2.5 text-left text-[12.5px] font-medium text-muted transition-colors hover:bg-card-2 hover:text-text disabled:opacity-50"
        >
          <CommsBellIcon size={13} />
          {testing ? "Sending…" : "Send test notification"}
        </button>
      ) : null}
      {testResult ? <p className="whitespace-pre-line px-3 py-1 text-[11px] text-muted">{testResult}</p> : null}
    </>
  );
}
