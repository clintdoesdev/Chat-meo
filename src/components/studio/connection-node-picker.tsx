"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NODE_KIND_ICON } from "@/components/studio/node-icons";
import type { NodeKindMeta } from "@/lib/flow-types";

const PANEL_WIDTH = 220;
const PANEL_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Dropping a dragged connection on empty canvas (instead of onto an existing node's handle)
 * pops this up right where you let go, offering the node kinds you can wire in on the spot —
 * so finishing a connection doesn't require first placing a node elsewhere and dragging a
 * second edge to it. `kinds` is pre-filtered by the caller (e.g. an AI node's "logic" handle
 * only offers the Logic kind) so every option here is guaranteed to be a valid target.
 */
export function ConnectionNodePicker({
  x,
  y,
  kinds,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  kinds: NodeKindMeta[];
  onSelect: (kind: NodeKindMeta["kind"]) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // Deferred so the same pointerup/click that ended the drag doesn't immediately close this.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
    }, 0);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const left = clamp(x - PANEL_WIDTH / 2, VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
  const top = clamp(y, VIEWPORT_MARGIN, window.innerHeight - PANEL_MAX_HEIGHT - VIEWPORT_MARGIN);

  return createPortal(
    <div
      ref={panelRef}
      style={{ top, left, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}
      className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-line-2 bg-[#1c1c1c] shadow-[0_30px_60px_-16px_rgba(0,0,0,.9)]"
    >
      <div className="border-b border-line-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[.1em] text-muted">
        Connect to…
      </div>
      <div className="max-h-[280px] overflow-y-auto p-1.5">
        {kinds.map((meta) => {
          const Icon = NODE_KIND_ICON[meta.kind];
          return (
            <button
              key={meta.kind}
              type="button"
              data-fx-skip
              onClick={() => onSelect(meta.kind)}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-medium text-text transition hover:bg-white/[.06]"
            >
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[8px]"
                style={{ background: `${meta.color}26`, color: meta.color }}
              >
                <Icon size={13} />
              </span>
              {meta.label}
            </button>
          );
        })}
        {kinds.length === 0 && <p className="px-2.5 py-2 text-[11.5px] text-muted">Nothing to connect here.</p>}
      </div>
    </div>,
    document.body,
  );
}
