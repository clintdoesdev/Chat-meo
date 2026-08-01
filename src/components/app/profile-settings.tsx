"use client";

import { Check, Loader2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateProfileName } from "@/lib/actions/profile";

export function ProfileSettings({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updateProfileName({ name: value });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const dirty = value.trim() !== name.trim();

  return (
    <div className="w-full max-w-[440px] rounded-[18px] border border-line-2 bg-card p-5 text-left">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
          <User size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Profile</p>
          <p className="text-[12px] text-muted">Your name and account email.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">Name</span>
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            maxLength={80}
            required
            className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-[13px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none focus:ring-4 focus:ring-orange/10"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">Email</span>
          <input
            value={email}
            disabled
            className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-3 text-[13px] text-muted opacity-70"
          />
        </label>

        {error && (
          <p role="alert" className="text-[12.5px] text-bad">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-ok">
            <Check size={13} /> Saved
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !dirty || !value.trim()}
          data-fx-skip
          className="flex items-center justify-center gap-1.5 self-start rounded-full bg-grad-orange px-5 py-[10px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save changes
        </button>
      </form>
    </div>
  );
}
