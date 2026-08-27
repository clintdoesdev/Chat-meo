"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";

/** The 4th nav slot (formerly Settings — see nav-links.tsx). Deliberately empty for now: a place
 * for cross-bot utilities (e.g. scheduled/broadcast messaging) to land as they're built, rather
 * than a page of its own. Same hand-rolled toggle + click-outside pattern as AvatarMenu/
 * NotificationsMenu, just anchored upward instead of downward for the bottom tab bar (variant
 * "bottom" sits pinned to the viewport's bottom edge, so its panel has to open above it). */
export function ToolsMenu({ variant }: { variant: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        data-fx-skip
        className={
          variant === "top"
            ? `flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
                open ? "bg-card-2 text-text" : "text-muted hover:text-text"
              }`
            : `flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium ${
                open ? "text-orange-2" : "text-muted"
              }`
        }
      >
        <Wrench size={variant === "top" ? 15 : 18} />
        Tools
      </button>

      {open && (
        <div
          className={`absolute right-0 z-[80] w-64 rounded-2xl border border-line-2 bg-[#161616] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)] ${
            variant === "top" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]"
          }`}
        >
          <div className="px-3 pb-1 pt-2.5 text-[13.5px] font-semibold">Tools</div>
          <p className="px-3 pb-2.5 pt-1 text-[12.5px] leading-snug text-muted">
            Nothing here yet — utilities like scheduled messaging will show up in this menu as they ship.
          </p>
        </div>
      )}
    </div>
  );
}
