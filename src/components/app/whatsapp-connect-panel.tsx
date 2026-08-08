"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ActionsTrashIcon, StatusWarningIcon, WhatsAppIcon } from "@/components/icons";
import { Skeleton } from "@/components/skeleton";
import {
  disconnectWhatsApp,
  getWhatsAppConnectConfig,
  setWhatsAppActive,
  type WhatsAppConnectionInfo,
} from "@/lib/actions/whatsapp";

// Facebook Login for Business JS SDK — loaded once per page via next/script below, not an npm
// package (Meta only ships this as a browser global). window.fbAsyncInit is the SDK's own
// documented ready-hook, called automatically once connect.facebook.net/en_US/sdk.js finishes
// loading; declared here since nothing else in the app touches the FB SDK.
type FacebookLoginResponse = {
  authResponse?: { code?: string; accessToken?: string } | null;
  status?: string;
};

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (params: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
          extras?: { setup?: Record<string, unknown>; featureType?: string; sessionInfoVersion?: string };
        },
      ) => void;
    };
  }
}

const FB_SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const FB_SDK_VERSION = "v23.0";
// Meta's own message-event origins for the Embedded Signup popup/iframe — anything else is
// ignored outright rather than trusting arbitrary postMessage senders.
const META_MESSAGE_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

type WaEmbeddedSignupEvent = {
  type?: string;
  event?: string;
  data?: { waba_id?: string; phone_number_id?: string; business_id?: string };
};

type SignupAssets = { wabaId?: string; phoneNumberId?: string };

type PanelStatus = "loading" | "not_configured" | "idle" | "connecting" | "connected" | "error";

// Checked in this order deliberately: connection health (status) takes precedence over the
// seller's own pause toggle — a DISCONNECTED or TOKEN_EXPIRED connection is worth flagging as
// such even if isActive happens to still be true underneath, and disconnectWhatsApp always
// clears isActive anyway so "Disconnected" and "Paused" never both apply at once in practice.
function statusLabel(connection: WhatsAppConnectionInfo): { text: string; className: string } {
  if (connection.status === "DISCONNECTED") {
    return { text: "Disconnected", className: "border-line-2 bg-card-2 text-muted" };
  }
  if (connection.status === "TOKEN_EXPIRED") {
    return { text: "Needs reconnecting", className: "border-bad/30 bg-bad/10 text-bad" };
  }
  if (!connection.isActive) {
    return { text: "Paused", className: "border-line-2 bg-card-2 text-muted" };
  }
  return { text: "Connected", className: "border-ok/30 bg-ok/10 text-ok" };
}

export function WhatsAppConnectPanel({ botId }: { botId: string }) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [appId, setAppId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [connection, setConnection] = useState<WhatsAppConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const signupAssetsRef = useRef<SignupAssets>({});

  useEffect(() => {
    let cancelled = false;
    getWhatsAppConnectConfig(botId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setAppId(result.appId);
      setConfigId(result.configId);
      setConnection(result.connection);
      setStatus(result.appId && result.configId ? "idle" : "not_configured");
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  // The FB SDK calls window.fbAsyncInit itself once connect.facebook.net finishes loading —
  // that's the documented hook, not Script's own onLoad (which can fire before the SDK has
  // finished setting up window.FB internally).
  useEffect(() => {
    if (!appId) return;
    if (window.FB) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: FB_SDK_VERSION });
      setSdkReady(true);
    };
  }, [appId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!META_MESSAGE_ORIGINS.has(event.origin)) return;
      let payload: WaEmbeddedSignupEvent;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "FINISH" || payload.event?.startsWith("FINISH")) {
        signupAssetsRef.current = {
          wabaId: payload.data?.waba_id,
          phoneNumberId: payload.data?.phone_number_id,
        };
      } else if (payload.event === "CANCEL") {
        setStatus("idle");
        setError("WhatsApp sign-in was cancelled.");
      } else if (payload.event === "ERROR") {
        setStatus("idle");
        setError("Something went wrong during WhatsApp sign-in — try again.");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function finishConnect(code: string) {
    try {
      const response = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, code, ...signupAssetsRef.current }),
      });
      const json: { ok?: boolean; displayPhoneNumber?: string; error?: string } = await response.json();
      if (!response.ok || !json.ok || !json.displayPhoneNumber) {
        setStatus("idle");
        setError(json.error ?? "Couldn't connect WhatsApp — try again.");
        return;
      }
      setConnection({
        status: "CONNECTED",
        isActive: true,
        displayPhoneNumber: json.displayPhoneNumber,
        connectedAt: new Date().toISOString(),
      });
      setStatus("connected");
    } catch {
      setStatus("idle");
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      signupAssetsRef.current = {};
    }
  }

  function handleConnectClick() {
    if (!window.FB || !configId) return;
    setError(null);
    setStatus("connecting");
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) {
          void finishConnect(code);
        } else {
          setStatus("idle");
          setError("WhatsApp sign-in didn't complete — try again.");
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  async function handleToggleActive() {
    if (!connection) return;
    const nextActive = !connection.isActive;
    setActionError(null);
    setTogglePending(true);
    const result = await setWhatsAppActive(botId, nextActive);
    setTogglePending(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setConnection((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
  }

  async function handleDisconnect() {
    setActionError(null);
    setDisconnectPending(true);
    const result = await disconnectWhatsApp(botId);
    setDisconnectPending(false);
    setShowDisconnectConfirm(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setConnection((prev) => (prev ? { ...prev, status: "DISCONNECTED", isActive: false } : prev));
  }

  if (status === "loading") {
    return (
      <div>
        <Skeleton className="mb-2 h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (status === "not_configured") {
    return (
      <div className="rounded-xl border border-line-2 bg-card-2 p-3.5 text-[12.5px] leading-relaxed text-muted">
        WhatsApp connect isn&apos;t set up on this deployment yet — an admin needs to add
        META_APP_ID, META_APP_SECRET, and META_CONFIG_ID (see the README).
      </div>
    );
  }


  // A DISCONNECTED connection still has a row (phone number, status), but nothing left to
  // pause or revoke — it's functionally the same "needs (re)connecting" state as never having
  // connected at all, just with a number to show instead of the Coexistence pitch.
  const isRevoked = !connection || connection.status === "DISCONNECTED";

  return (
    <div>
      {appId && <Script src={FB_SDK_SRC} strategy="afterInteractive" />}

      {isRevoked ? (
        <p className="mb-3.5 text-[12.5px] leading-relaxed text-muted">
          We recommend <strong className="text-text">linking your existing WhatsApp Business App
          number</strong> (Coexistence) rather than starting fresh — you&apos;ll keep your chat
          history and can keep using the WhatsApp Business App side by side with Chatmeo. You&apos;ll
          get the choice to link an existing number partway through the next step.
        </p>
      ) : (
        connection && (
          <div className="rounded-xl border border-line-2 bg-card-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(37,211,102,.15)", color: "#25D366" }}
                >
                  <WhatsAppIcon size={16} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold">{connection.displayPhoneNumber}</p>
                  <p className="text-[11px] text-muted">
                    Connected {new Date(connection.connectedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span
                className={`flex-shrink-0 rounded-full border px-[11px] py-1 text-[11px] font-semibold ${statusLabel(connection).className}`}
              >
                {statusLabel(connection).text}
              </span>
            </div>

            {connection.status === "TOKEN_EXPIRED" && (
              <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] text-bad">
                <StatusWarningIcon size={13} className="mt-0.5 flex-shrink-0" />
                Meta says this connection needs reauthorizing — reconnect below to restore it.
              </p>
            )}

            <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line-2 pt-3.5">
              <div>
                <p className="text-[12.5px] font-semibold text-text">
                  {connection.isActive ? "Live" : "Paused"}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  {connection.isActive
                    ? "The bot replies automatically to incoming messages."
                    : "Messages still land in your inbox, but the bot stays silent — good for handling this number manually. Your Meta connection stays intact."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={connection.isActive}
                aria-label="Automated replies"
                onClick={handleToggleActive}
                disabled={togglePending}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
                  connection.isActive
                    ? "bg-grad-orange text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
                    : "border border-line-2 bg-card-2 text-muted"
                }`}
              >
                {connection.isActive ? "Live" : "Paused"}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-2 pt-3">
              <p className="text-[11px] leading-relaxed text-muted">
                Disconnecting revokes Chatmeo&apos;s access entirely — you&apos;ll redo setup to
                reconnect.
              </p>
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(true)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-bad/30 px-3 py-1.5 text-[11.5px] font-semibold text-bad transition hover:bg-bad/10"
              >
                <ActionsTrashIcon size={12} />
                Disconnect
              </button>
            </div>
          </div>
        )
      )}

      {isRevoked && (
        <button
          type="button"
          onClick={handleConnectClick}
          disabled={!sdkReady || status === "connecting"}
          className="mt-3.5 flex items-center gap-2 rounded-full bg-grad-orange px-4 py-2.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition disabled:opacity-50"
        >
          <WhatsAppIcon size={14} />
          {status === "connecting" ? "Connecting…" : connection ? "Reconnect WhatsApp" : "Connect WhatsApp"}
        </button>
      )}

      {actionError && <p className="mt-2.5 text-[11.5px] text-bad">{actionError}</p>}
      {error && <p className="mt-2.5 text-[11.5px] text-bad">{error}</p>}

      {showDisconnectConfirm && connection && (
        <DisconnectConfirmModal
          phoneNumber={connection.displayPhoneNumber}
          pending={disconnectPending}
          onCancel={() => setShowDisconnectConfirm(false)}
          onConfirm={handleDisconnect}
        />
      )}
    </div>
  );
}

function DisconnectConfirmModal({
  phoneNumber,
  pending,
  onCancel,
  onConfirm,
}: {
  phoneNumber: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div onClick={pending ? undefined : onCancel} aria-hidden="true" className="fixed inset-0 z-[105] bg-black/60" />
      <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Disconnect WhatsApp"
          className="w-full max-w-[380px] rounded-2xl border border-line bg-[#111] p-5 shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-bad/30 bg-bad/10 text-bad">
              <StatusWarningIcon size={16} />
            </span>
            <h3 className="text-[14px] font-semibold">Disconnect WhatsApp?</h3>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            This revokes Chatmeo&apos;s access to <strong className="text-text">{phoneNumber}</strong> and
            clears the stored connection. Unlike pausing, this can&apos;t be undone from here — you&apos;ll
            need to redo WhatsApp Embedded Signup to reconnect this number.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="rounded-full bg-bad px-3.5 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
