"use client";

import { StatusSuccessIcon, StatusWarningIcon } from "@/components/icons";

export function Toast({ message, tone = "ok" }: { message: string; tone?: "ok" | "bad" }) {
  return (
    <div
      role="status"
      className={`toast-in pointer-events-none fixed bottom-20 left-1/2 z-[110] -translate-x-1/2 rounded-full border px-4 py-2.5 text-[13px] font-medium text-text shadow-[0_16px_40px_-14px_rgba(0,0,0,.9)] min-[760px]:bottom-6 ${
        tone === "bad" ? "border-bad/30 bg-[#141414]" : "border-ok/30 bg-[#141414]"
      }`}
    >
      <span className="flex items-center gap-2">
        {tone === "bad" ? (
          <StatusWarningIcon size={14} className="text-bad" />
        ) : (
          <StatusSuccessIcon size={14} className="text-ok" />
        )}
        {message}
      </span>
    </div>
  );
}
