"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { MeoMark } from "@/components/meo-mark";

export function TestDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[75] bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Test bot"
        className={`fixed inset-y-0 right-0 z-[80] flex w-full max-w-[380px] flex-col border-l border-line bg-[#111] pb-[env(safe-area-inset-bottom)] shadow-[-24px_0_60px_-24px_rgba(0,0,0,.8)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <MeoMark size={22} />
            <h3 className="text-[13.5px] font-semibold">Test bot</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <MeoMark size={40} />
          <p className="text-[13px] font-semibold text-text">Runtime engine coming in Phase 3</p>
          <p className="max-w-[26ch] text-[12px] text-muted">
            This drawer will let you chat with your flow live, right here, before you publish it.
          </p>
        </div>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5 opacity-50">
            <input
              disabled
              placeholder="Type a message…"
              className="w-full bg-transparent text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:outline-none"
            />
          </div>
        </div>
      </aside>
    </>
  );
}
