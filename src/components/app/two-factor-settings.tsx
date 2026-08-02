"use client";

import { Check, Loader2, Mail, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  beginTotpSetup,
  cancelTotpSetup,
  confirmTotpSetup,
  disableTwoFactor,
  enableEmailTwoFactor,
} from "@/lib/actions/two-factor";

type Status = "off" | "email" | "totp";

type View = "picker" | "totp-setup" | "status";

export function TwoFactorSettings({
  initialStatus,
  hasPassword,
  pendingTotp,
}: {
  initialStatus: Status;
  hasPassword: boolean;
  pendingTotp: { qrDataUrl: string; secret: string } | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [view, setView] = useState<View>(
    initialStatus === "off" ? (pendingTotp ? "totp-setup" : "picker") : "status",
  );
  const [totpData, setTotpData] = useState(pendingTotp);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnableEmail() {
    if (!hasPassword || pending) return;
    setPending(true);
    setError(null);
    const result = await enableEmailTwoFactor();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus("email");
    setView("status");
    router.refresh();
  }

  async function handleStartTotpSetup() {
    if (!hasPassword || pending) return;
    setPending(true);
    setError(null);
    const result = await beginTotpSetup();
    setPending(false);
    if (result.error || !result.qrDataUrl || !result.secret) {
      setError(result.error ?? "Couldn't start setup. Try again.");
      return;
    }
    setTotpData({ qrDataUrl: result.qrDataUrl, secret: result.secret });
    setView("totp-setup");
  }

  async function handleConfirmTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") ?? "");
    setPending(true);
    setError(null);
    const result = await confirmTotpSetup(code);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus("totp");
    setView("status");
    router.refresh();
  }

  async function handleCancelTotpSetup() {
    if (pending) return;
    setPending(true);
    await cancelTotpSetup();
    setPending(false);
    setTotpData(null);
    setError(null);
    setView("picker");
  }

  async function handleDisable() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await disableTwoFactor();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus("off");
    setView("picker");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[540px] rounded-[18px] border border-line-2 bg-card p-5 text-left">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
          {status === "off" ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Two-factor authentication</p>
          <p className="text-[12px] text-muted">
            {!hasPassword
              ? "Set a password on your account to enable this."
              : status === "off"
                ? "Add a second step when signing in with your password."
                : status === "email"
                  ? "Protected with an emailed code."
                  : "Protected with an authenticator app."}
          </p>
        </div>
      </div>

      {hasPassword && view === "picker" && (
        <div className="flex flex-col gap-2.5">
          <MethodOption
            icon={<Mail size={16} />}
            title="Email code"
            description="We'll email you a one-time code at sign-in."
            disabled={pending}
            onClick={handleEnableEmail}
          />
          <MethodOption
            icon={<Smartphone size={16} />}
            title="Authenticator app"
            description="Use Google Authenticator, Authy, or similar."
            disabled={pending}
            onClick={handleStartTotpSetup}
          />
        </div>
      )}

      {view === "totp-setup" && totpData && (
        <div className="flex flex-col gap-3.5">
          <p className="text-[12.5px] text-muted">
            Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
          </p>
          <div className="flex justify-center rounded-[14px] border border-line-2 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, no next/image benefit */}
            <img src={totpData.qrDataUrl} alt="Authenticator app QR code" width={180} height={180} />
          </div>
          <div className="rounded-[10px] border border-line-2 bg-card-2 px-3 py-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted">
              Can&apos;t scan it?
            </p>
            <p className="mt-1 break-all font-mono text-[12px] text-text">{totpData.secret}</p>
          </div>

          <form onSubmit={handleConfirmTotp} className="flex flex-col gap-2.5">
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="123456"
              className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-center text-lg tracking-[.3em] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
            />
            {error && (
              <p role="alert" className="text-[12.5px] text-bad">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelTotpSetup}
                disabled={pending}
                data-fx-skip
                className="flex-1 rounded-full border border-line-2 bg-card-2 py-[10px] text-[13px] font-semibold text-muted transition hover:border-orange-2/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-grad-orange py-[10px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 disabled:opacity-60"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}

      {view === "status" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-[12px] border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-ok">
            <Check size={14} />
            {status === "email" ? "Email code enabled" : "Authenticator app enabled"}
          </div>
          {error && (
            <p role="alert" className="text-[12.5px] text-bad">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleDisable}
            disabled={pending}
            data-fx-skip
            className="w-full rounded-full border border-line-2 bg-card-2 py-[10px] text-[13px] font-semibold text-bad transition hover:border-bad/40 disabled:opacity-60"
          >
            {pending ? "Turning off…" : "Turn off two-factor authentication"}
          </button>
        </div>
      )}

      {!hasPassword && (
        <p className="text-[12.5px] text-muted">
          You signed in with Google, so there&apos;s no password to pair a second factor with.
        </p>
      )}
    </div>
  );
}

function MethodOption({
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-fx-skip
      className="flex items-center gap-3 rounded-[14px] border border-line-2 bg-card-2 p-3.5 text-left transition hover:border-orange-2/50 hover:bg-card disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11.5px] text-muted">{description}</span>
      </span>
    </button>
  );
}
