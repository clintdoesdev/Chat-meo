"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POPOVER_WIDTH = 220;
const POPOVER_MAX_HEIGHT = 140;
const VIEWPORT_MARGIN = 12;

/** A small (i) icon that opens a description popover — used next to node kinds in both the
 * desktop sidebar palette and the mobile "Add a node" sheet, since neither surface makes it
 * obvious what each node type actually does. Stops its own pointer/click events from bubbling:
 * the desktop palette chip is itself a drag source, and this needs to never start a drag.
 *
 * Positioned via fixed + a measured coordinate rather than CSS absolute anchoring: the desktop
 * sidebar is only 216px wide and the mobile sheet's cards are about half that, so a popover
 * anchored to the icon's own edge routinely has nowhere to fit and runs off the viewport.
 * Rendered through a portal into document.body for the same reason fixed positioning needs a
 * real coordinate in the first place — the mobile sheet slides in via a CSS transform, and any
 * transformed ancestor becomes the containing block for position:fixed descendants, which would
 * otherwise put this nowhere near the viewport coordinates it was actually given. */
export function NodeInfoButton({ label, description }: { label: string; description: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      // The popover itself is portaled to document.body, outside wrapRef's real DOM subtree,
      // so a click inside it needs its own check or it'd read as "outside" and close itself.
      if (wrapRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.min(
        Math.max(rect.right - POPOVER_WIDTH, VIEWPORT_MARGIN),
        window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN,
      );
      // Flip above the button when there isn't room below (e.g. a card near the bottom of the
      // mobile "Add a node" sheet) — using a fixed estimate since the real height depends on
      // how long the description text is and hasn't rendered yet at the point this runs.
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow >= POPOVER_MAX_HEIGHT + VIEWPORT_MARGIN
          ? rect.bottom + 6
          : rect.top - POPOVER_MAX_HEIGHT - 6;
      setCoords({ top: Math.max(top, VIEWPORT_MARGIN), left });
    }
    setOpen((v) => !v);
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        data-fx-skip
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={handleToggle}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition ${
          open ? "bg-white/[.12] text-text" : "text-muted hover:bg-white/[.08] hover:text-text"
        }`}
      >
        <Info size={12} />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{ top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
            className="fixed z-[90] rounded-[12px] border border-line-2 bg-[#1c1c1c] p-3 text-left text-[11.5px] font-normal leading-relaxed text-muted shadow-[0_20px_50px_-16px_rgba(0,0,0,.9)]"
          >
            {description}
          </div>,
          document.body,
        )}
    </div>
  );
}
