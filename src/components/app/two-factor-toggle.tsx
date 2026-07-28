"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setTwoFactorEnabled } from "@/lib/actions/two-factor";

export function TwoFactorToggle({
  initialEnabled,
  hasPassword,
}: {
  initialEnabled: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!hasPassword || pending) return;
    setError(null);
    setPending(true);

    const next = !enabled;
    const result = await setTwoFactorEnabled(next);

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEnabled(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[440px] rounded-[16px] border border-line-2 bg-card p-5 text-left">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Two-factor authentication</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {hasPassword
              ? "Require a one-time email code when signing in with your password."
              : "Set a password on your account to enable this."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={!hasPassword || pending}
          data-fx-skip
          aria-pressed={enabled}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            enabled ? "bg-grad-orange" : "bg-card-2 border border-line-2"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
