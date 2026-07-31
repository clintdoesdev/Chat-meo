"use client";

import { Check } from "lucide-react";

export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="toast-in pointer-events-none fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-ok/30 bg-[#141414] px-4 py-2.5 text-[13px] font-medium text-text shadow-[0_16px_40px_-14px_rgba(0,0,0,.9)]"
    >
      <span className="flex items-center gap-2">
        <Check size={14} className="text-ok" strokeWidth={2.5} />
        {message}
      </span>
    </div>
  );
}
