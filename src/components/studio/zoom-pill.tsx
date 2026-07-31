"use client";

import { useReactFlow, useStore } from "@xyflow/react";
import { Minus, Plus } from "lucide-react";

export function ZoomPill() {
  const { zoomIn, zoomOut } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-full border border-line-2 bg-[#141414]/90 p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,.8)] backdrop-blur">
      <button
        type="button"
        onClick={() => zoomOut({ duration: 150 })}
        aria-label="Zoom out"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>
      <span className="w-9 select-none text-center text-[11.5px] font-semibold tabular-nums text-muted">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => zoomIn({ duration: 150 })}
        aria-label="Zoom in"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
