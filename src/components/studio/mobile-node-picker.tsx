"use client";

import { Plus, X } from "lucide-react";
import { PALETTE_KINDS, type FlowNodeKind } from "@/lib/flow-types";

/** Mobile-only replacement for the drag-a-chip-onto-the-canvas palette: dragging a small
 * target precisely onto a canvas is fiddly on a touchscreen, and the chip strip itself has
 * nowhere to put seven options without overflowing. Tapping + opens a sheet instead — tap a
 * kind, it's added straight onto the canvas. */
export function MobileAddNodeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-fx-skip
      onClick={onClick}
      aria-label="Add node"
      className="absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full
        border border-orange-2/40 bg-grad-orange text-white shadow-[0_10px_30px_-10px_rgba(255,92,22,.7)]
        transition active:scale-95 min-[1020px]:hidden"
    >
      <Plus size={20} strokeWidth={2.5} />
    </button>
  );
}

export function MobileNodePickerSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: FlowNodeKind) => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[75] bg-black/50 transition-opacity duration-200 min-[1020px]:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a node"
        className={`fixed inset-x-0 bottom-0 z-[80] rounded-t-2xl border-t border-line bg-[#111] p-4
          pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-24px_60px_-24px_rgba(0,0,0,.8)]
          transition-transform duration-300 ease-out min-[1020px]:hidden ${
            open ? "translate-y-0" : "translate-y-full"
          }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="h-1 w-9 rounded-full bg-white/15" />
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

        <h3 className="mb-3 text-sm font-semibold">Add a node</h3>

        <div className="grid grid-cols-2 gap-2.5">
          {PALETTE_KINDS.map((meta) => (
            <button
              key={meta.kind}
              type="button"
              data-fx-skip
              onClick={() => onSelect(meta.kind)}
              className="flex items-center gap-2.5 rounded-[14px] border border-line-2 bg-card-2 p-3.5 text-left transition active:scale-[0.97] hover:border-orange-2/50"
            >
              <i className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: meta.color }} />
              <span className="text-[13px] font-medium">{meta.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
