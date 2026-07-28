"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MeoMark } from "@/components/meo-mark";
import { resendVerificationCode, verifyEmailCode } from "@/lib/actions/verify-email";

export function VerifyEmailCard({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") ?? "");

    const result = await verifyEmailCode(code);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    await resendVerificationCode();
    setResending(false);
    setNotice("If a code was due, we've sent a fresh one.");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-[200px] w-[min(800px,100vw)] -translate-x-1/2 rounded-t-full blur-[26px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 100%, rgba(255,92,22,.4), transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[400px] rounded-[22px] border border-line-2 bg-card p-[34px_30px]">
        <div className="mb-6 text-center">
          <MeoMark size={52} excited className="mx-auto" />
          <h2 className="mt-3 text-[22px] font-bold">Verify your email</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            We sent a 6-digit code to {email}. Enter it below to finish setting up your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          <div>
            <label htmlFor="code" className="mb-1.5 block text-xs font-semibold text-muted">
              Verification code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="123456"
              className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-center text-lg tracking-[.3em] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
            />
          </div>

          {error && (
            <p role="alert" className="text-[12.5px] text-bad">
              {error}
            </p>
          )}
          {notice && <p className="text-[12.5px] text-muted">{notice}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 w-full rounded-full bg-grad-orange py-[11px] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted">
          Didn&apos;t get it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            data-fx-skip
            className="font-semibold text-orange-2 disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </div>
    </div>
  );
}
