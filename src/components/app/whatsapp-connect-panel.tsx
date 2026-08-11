"use client";

import { useEffect, useState } from "react";
import { ActionsTrashIcon, AnimatedSpinnerIcon, StatusWarningIcon, WhatsAppIcon } from "@/components/icons";
import { Skeleton } from "@/components/skeleton";
import {
  disconnectWhatsApp,
  getWhatsAppConnectConfig,
  setWhatsAppActive,
  type WhatsAppConnectionInfo,
} from "@/lib/actions/whatsapp";

type PanelStatus = "loading" | "not_configured" | "idle" | "error";

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
  const [connection, setConnection] = useState<WhatsAppConnectionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglePending, setTogglePending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWhatsAppConnectConfig(botId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setConnection(result.connection);
      setStatus(result.configured ? "idle" : "not_configured");
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

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
        <a
          href={`/api/whatsapp/connect/start?botId=${encodeURIComponent(botId)}`}
          aria-disabled={redirecting}
          onClick={(event) => {
            if (redirecting) {
              event.preventDefault();
              return;
            }
            // Not preventDefault()'d otherwise — the browser's own navigation to Meta still
            // happens right after this; this just gives that brief moment (and any network
            // latency before the redirect actually lands) a visible loading state instead of
            // the button appearing to do nothing.
            setRedirecting(true);
          }}
          className={`mt-3.5 flex w-fit items-center gap-2 rounded-full bg-grad-orange px-4 py-2.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 ${
            redirecting ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {redirecting ? <AnimatedSpinnerIcon size={14} /> : <WhatsAppIcon size={14} />}
          {redirecting ? "Redirecting to Facebook…" : connection ? "Reconnect WhatsApp" : "Connect WhatsApp"}
        </a>
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
