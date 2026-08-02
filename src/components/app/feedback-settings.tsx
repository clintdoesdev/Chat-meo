"use client";

import { Check, MessageSquarePlus, Paperclip } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { submitFeedback } from "@/lib/actions/feedback";

export function FeedbackSettings() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitFeedback(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      formRef.current?.reset();
      setFileName(null);
      setTimeout(() => setSent(false), 2500);
    });
  }

  return (
    <div className="w-full max-w-[540px] rounded-[18px] border border-line-2 bg-card p-5 text-left">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
          <MessageSquarePlus size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Beta feedback</p>
          <p className="text-[12px] text-muted">What&apos;s broken, confusing, or missing?</p>
        </div>
      </div>

      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2.5">
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Tell us what's on your mind…"
          className="w-full resize-y rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted transition hover:text-text">
          <Paperclip size={12} />
          {fileName ?? "Attach a screenshot (optional)"}
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
        </label>

        {error && (
          <p role="alert" className="text-[12.5px] text-bad">
            {error}
          </p>
        )}
        {sent && !error && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-ok">
            <Check size={13} /> Thanks — got it!
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-grad-orange px-5 py-[10px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </div>
  );
}
