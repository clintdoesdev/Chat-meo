"use client";

import { Plus } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { createBot } from "@/lib/actions/bots";

export function NewBotForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createBot(formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form ref={formRef} action={handleSubmit} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="New bot name"
          className="w-40 rounded-full border border-line-2 bg-card-2 px-3.5 py-1.5 text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none sm:w-52"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-grad-orange px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] disabled:opacity-60"
        >
          <Plus size={13} />
          New bot
        </button>
      </form>
      {error && <p className="max-w-[280px] text-right text-[11.5px] text-muted">{error}</p>}
    </div>
  );
}
