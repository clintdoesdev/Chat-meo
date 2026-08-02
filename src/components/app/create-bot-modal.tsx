"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { createBot } from "@/lib/actions/bots";

const DEFAULT_COLOR = "#FF5C16";

export function CreateBotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-fx-skip
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-grad-orange px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)]"
      >
        <Plus size={13} />
        New bot
      </button>
      {open && <CreateBotModal onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateBotModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createBot(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-[95] bg-black/60" />
      <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create a new bot"
          className="w-full max-w-[440px] rounded-2xl border border-line bg-[#111] shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-[14.5px] font-semibold">New bot</h3>
            <button
              type="button"
              data-fx-skip
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
            >
              <X size={16} />
            </button>
          </div>

          <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4 p-5">
            <div>
              <label htmlFor="new-bot-name" className={labelClass()}>
                Name
              </label>
              <input
                id="new-bot-name"
                name="name"
                required
                autoFocus
                placeholder="Support bot"
                className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[13px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-bot-color" className={labelClass()}>
                Primary color
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  id="new-bot-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-line-2 bg-transparent p-0.5"
                />
                <input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  name="primaryColor"
                  className="w-28 rounded-[13px] border border-line-2 bg-card-2 px-3 py-2 font-mono text-[12.5px] text-text focus:border-orange-2/60 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-bot-welcome" className={labelClass()}>
                Welcome message
              </label>
              <textarea
                id="new-bot-welcome"
                name="welcomeMessage"
                rows={2}
                placeholder="Hey! How can I help?"
                className="w-full resize-y rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
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
              className="flex items-center justify-center gap-1.5 rounded-full bg-grad-orange px-4 py-2.5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] disabled:opacity-60"
            >
              <Plus size={14} />
              {pending ? "Creating…" : "Create bot"}
            </button>
            <p className="text-center text-[11px] text-muted">
              You can fine-tune everything else — domains, embed code, launcher position — from
              the bot&apos;s settings afterward.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}

function labelClass() {
  return "mb-1.5 block text-xs font-semibold text-muted";
}
