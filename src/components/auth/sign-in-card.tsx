"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MeoMark } from "@/components/meo-mark";
import { googleSignInAction } from "@/lib/actions/auth";
import { registerUser } from "@/lib/actions/register";

type Mode = "in" | "up";
type Step = "form" | "twoFactor";

const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  in: {
    title: "Welcome back",
    subtitle: "Meo missed you. Sign in to keep building.",
    cta: "Sign in",
  },
  up: {
    title: "Create your account",
    subtitle: "Give Meo a few details and start building your first bot.",
    cta: "Create account",
  },
};

function authErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "AccessDenied") {
    return "That sign-in was denied. Please try again.";
  }
  return "Something went wrong signing in — please try again.";
}

export function SignInCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "up" ? "up" : "in");
  const [step, setStep] = useState<Step>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    authErrorMessage(searchParams.get("error")),
  );
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(
    null,
  );
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "totp" | null>(null);

  const copy = COPY[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (mode === "up") {
      await registerUser({ name, email, password });
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (result?.code === "TwoFactorRequiredEmail" || result?.code === "TwoFactorRequiredTotp") {
      setCredentials({ email, password });
      setTwoFactorMethod(result.code === "TwoFactorRequiredTotp" ? "totp" : "email");
      setStep("twoFactor");
      return;
    }

    if (result?.error) {
      setError(
        mode === "up"
          ? "If that email is new, check your inbox to verify your account — otherwise sign in below."
          : "That email and password don't match.",
      );
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credentials) return;
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const code = String(formData.get("code") ?? "");

    const result = await signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      code,
      redirect: false,
    });

    setPending(false);

    if (result?.code === "InvalidTwoFactorCode") {
      setError("That code isn't right or has expired.");
      return;
    }

    if (result?.error) {
      setError("Something went wrong — please try signing in again.");
      setStep("form");
      setCredentials(null);
      setTwoFactorMethod(null);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
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
          <h2 className="mt-3 text-[22px] font-bold">{copy.title}</h2>
          <p className="mt-1.5 text-[13px] text-muted">{copy.subtitle}</p>
        </div>

        {step === "twoFactor" ? (
          <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-[13px]">
            <p className="text-[13px] text-muted">
              {twoFactorMethod === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : `Enter the 6-digit code we emailed to ${credentials?.email}.`}
            </p>
            <div>
              <label htmlFor="code" className="mb-1.5 block text-xs font-semibold text-muted">
                {twoFactorMethod === "totp" ? "Authenticator code" : "Verification code"}
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-center text-lg tracking-[.3em] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
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
              {pending ? "Verifying…" : "Verify"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("form");
                setCredentials(null);
                setTwoFactorMethod(null);
                setError(null);
              }}
              data-fx-skip
              className="text-center text-[12.5px] text-muted"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <>
        <div className="mb-[22px] flex rounded-full border border-line bg-bg p-1">
          <button
            type="button"
            onClick={() => {
              setMode("in");
              setError(null);
            }}
            data-fx-skip
            className={`flex-1 rounded-full py-[9px] text-[13.5px] font-semibold transition-colors ${
              mode === "in" ? "bg-card-2 text-text" : "text-muted"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("up");
              setError(null);
            }}
            data-fx-skip
            className={`flex-1 rounded-full py-[9px] text-[13.5px] font-semibold transition-colors ${
              mode === "up" ? "bg-card-2 text-text" : "text-muted"
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[13px]">
          {mode === "up" && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-semibold text-muted">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Clinton A."
                autoComplete="name"
                required
                className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-sm text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
              />
            </div>
          )}

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

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-muted">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                required
                minLength={mode === "up" ? 8 : undefined}
                className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 pr-11 text-sm text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                data-fx-skip
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
          </div>

          {mode === "in" && (
            <div className="mt-1 flex items-center justify-between text-[12.5px] text-muted">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="remember" defaultChecked className="peer sr-only" />
                <span className="flex h-4 w-4 items-center justify-center rounded-[5px] border border-line-2 bg-card-2 peer-checked:border-transparent peer-checked:bg-grad-orange">
                  <svg width="9" height="9" viewBox="0 0 16 16" className="text-white">
                    <path
                      d="M3.5 8.5l3 3L13 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Remember me
              </label>
              <Link href="/forgot-password" className="text-orange-2">
                Forgot password?
              </Link>
            </div>
          )}

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
            {pending ? "Please wait…" : copy.cta}
          </button>
        </form>

        <div className="my-[18px] flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#5C5C5C]">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action={googleSignInAction}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line-2 bg-card-2 py-[10px] text-[13px] font-semibold text-text transition hover:border-orange-2/50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.4c1.8 0 3 .8 3.7 1.4l2.7-2.6C16.8 2.6 14.6 1.6 12 1.6 8 1.6 4.6 3.9 3 7.2l3.1 2.4C7 7.2 9.3 5.4 12 5.4z"
              />
              <path
                fill="#4285F4"
                d="M22.4 12.2c0-.8-.1-1.4-.2-2H12v4h5.9c-.2 1.3-1 3.2-2.9 4.5l3 2.3c2.1-2 3.4-4.9 3.4-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M6.1 14.4A6.6 6.6 0 015.8 12c0-.8.1-1.6.3-2.4L3 7.2A11 11 0 001.9 12c0 1.7.4 3.4 1.1 4.8l3.1-2.4z"
              />
              <path
                fill="#34A853"
                d="M12 22.4c2.6 0 4.8-.9 6.4-2.4l-3-2.3c-.8.6-1.9 1-3.4 1-2.7 0-5-1.8-5.9-4.3L3 16.8c1.6 3.3 5 5.6 9 5.6z"
              />
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted">
          {mode === "in" ? (
            <>
              New to Chatmeo?{" "}
              <button
                type="button"
                onClick={() => setMode("up")}
                data-fx-skip
                className="font-semibold text-orange-2"
              >
                Create a free account
              </button>
            </>
          ) : (
            <>
              Already building?{" "}
              <button
                type="button"
                onClick={() => setMode("in")}
                data-fx-skip
                className="font-semibold text-orange-2"
              >
                Sign in
              </button>
            </>
          )}
        </p>
          </>
        )}
      </div>
    </div>
  );
}
