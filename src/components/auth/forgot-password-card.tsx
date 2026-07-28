"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MeoMark } from "@/components/meo-mark";
import { requestPasswordReset, resetPassword } from "@/lib/actions/forgot-password";

type Step = "request" | "reset" | "done";

export function ForgotPasswordCard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();

    await requestPasswordReset(submittedEmail);

    setPending(false);
    setEmail(submittedEmail);
    setNotice("If that email has an account, we've sent a reset code.");
    setStep("reset");
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await resetPassword(email, code, password);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStep("done");
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
          <h2 className="mt-3 text-[22px] font-bold">
            {step === "done" ? "Password updated" : "Reset your password"}
          </h2>
          <p className="mt-1.5 text-[13px] text-muted">
            {step === "request" && "Enter your email and we'll send you a reset code."}
            {step === "reset" && "Enter the code we sent, plus your new password."}
            {step === "done" && "You can now sign in with your new password."}
          </p>
        </div>

        {step === "request" && (
          <form onSubmit={handleRequest} className="flex flex-col gap-[13px]">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-muted">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-sm text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mt-1 w-full rounded-full bg-grad-orange py-[11px] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleReset} className="flex flex-col gap-[13px]">
            {notice && <p className="text-[12.5px] text-muted">{notice}</p>}

            <div>
              <label htmlFor="code" className="mb-1.5 block text-xs font-semibold text-muted">
                Reset code
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

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-muted">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-sm text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
              />
            </div>

            {error && (
              <p role="alert" className="text-[12.5px] text-bad">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 w-full rounded-full bg-grad-orange py-[11px] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {step === "done" && (
          <button
            type="button"
            onClick={() => router.push("/signin")}
            className="mt-1 w-full rounded-full bg-grad-orange py-[11px] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110"
          >
            Back to sign in
          </button>
        )}

        {step !== "done" && (
          <p className="mt-5 text-center text-[13px] text-muted">
            Remembered it?{" "}
            <Link href="/signin" className="font-semibold text-orange-2">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
