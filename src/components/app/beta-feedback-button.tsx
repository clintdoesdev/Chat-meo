"use client";

import { Check, MessageSquarePlus, Paperclip, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { submitFeedback } from "@/lib/actions/feedback";

export function BetaFeedbackButton() {
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
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
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 1600);
    });
  }

  return (
    <div className="fixed bottom-[76px] right-4 z-[85] min-[760px]:bottom-5 min-[760px]:right-5">
      {open && (
        <div
          role="dialog"
          aria-label="Beta feedback"
          className="absolute bottom-[calc(100%+10px)] right-0 w-[300px] rounded-2xl border border-line-2 bg-[#161616] p-4 shadow-[0_24px_60px_-14px_rgba(0,0,0,.85)]"
        >
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ok/15 text-ok">
                <Check size={16} strokeWidth={2.5} />
              </span>
              <p className="text-[13px] font-medium">Thanks — got it!</p>
            </div>
          ) : (
            <form ref={formRef} action={handleSubmit}>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[13px] font-semibold">Beta feedback</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
                >
                  <X size={13} />
                </button>
              </div>
              <textarea
                name="message"
                required
                rows={4}
                placeholder="What's broken, confusing, or missing?"
                className="w-full resize-none rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
              />
              <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted transition hover:text-text">
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
              {error && <p className="mt-2 text-[11.5px] text-bad">{error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="mt-3 w-full rounded-full bg-grad-orange px-4 py-2 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send feedback"}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="relative">
        {showTooltip && !open && (
          <span className="absolute bottom-[calc(100%+8px)] right-0 whitespace-nowrap rounded-full border border-line-2 bg-[#161616] px-3 py-1.5 text-[11.5px] font-medium text-text shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)]">
            Beta feedback
          </span>
        )}
        <button
          type="button"
          data-fx-skip
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          aria-label="Send beta feedback"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-[#161616] text-muted shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)] transition hover:border-orange-2/50 hover:text-orange-2"
        >
          <MessageSquarePlus size={17} />
        </button>
      </div>
    </div>
  );
}
