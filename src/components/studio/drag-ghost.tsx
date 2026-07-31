"use client";

import { createPortal } from "react-dom";
import { NODE_KIND_META, type FlowNodeKind } from "@/lib/flow-types";

export function DragGhost({ kind, x, y }: { kind: FlowNodeKind; x: number; y: number }) {
  const meta = NODE_KIND_META[kind];
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[95] flex items-center gap-2 rounded-[13px] border border-orange-2/50 bg-card px-3 py-2.5 text-[13px] font-medium text-text shadow-[0_16px_40px_-14px_rgba(0,0,0,.9)]"
      style={{ left: x + 14, top: y + 14 }}
    >
      <i className="h-2 w-2 flex-shrink-0 rounded-[3px]" style={{ background: meta.color }} />
      {meta.label}
    </div>,
    document.body,
  );
}
