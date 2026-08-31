"use client";

import { ActionsCloseIcon, ActionsPlusIcon } from "@/components/icons";
import { NodeInfoButton } from "@/components/studio/node-info-button";
import { NODE_KIND_ICON } from "@/components/studio/node-icons";
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
      // bottom-20 (not bottom-4) below the 760px breakpoint — the site's own fixed mobile tab bar
      // (top-bar.tsx, ~64px tall, z-[70]) sits on top of anything positioned at the canvas
      // container's actual bottom edge otherwise, which left roughly half of this button covered
      // and its taps swallowed by the tab bar underneath. Reverts to bottom-4 once that tab bar
      // hides itself at min-[760px], well before this button hides at min-[1020px].
      className="absolute bottom-20 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full
        border border-orange-2/40 bg-grad-orange text-white shadow-[0_10px_30px_-10px_rgba(255,92,22,.7)]
        transition active:scale-95 min-[760px]:bottom-4 min-[1020px]:hidden"
    >
      <ActionsPlusIcon size={20} />
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
            <ActionsCloseIcon size={16} />
          </button>
        </div>

        <h3 className="mb-3 text-sm font-semibold">Add a node</h3>

        <div className="grid grid-cols-2 gap-2.5">
          {PALETTE_KINDS.map((meta) => {
            const Icon = NODE_KIND_ICON[meta.kind];
            return (
              <div
                key={meta.kind}
                role="button"
                tabIndex={0}
                data-fx-skip
                onClick={() => onSelect(meta.kind)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(meta.kind);
                  }
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border border-line-2 bg-card-2 p-3.5 text-left transition active:scale-[0.97] hover:border-orange-2/50"
              >
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[9px]"
                  style={{ background: `${meta.color}26`, color: meta.color }}
                >
                  <Icon size={15} />
                </span>
                <span className="flex-1 text-[13px] font-medium">{meta.label}</span>
                <NodeInfoButton label={meta.label} description={meta.description} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
