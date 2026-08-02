"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionsTrashIcon } from "@/components/icons";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

type MenuPosition = { x: number; y: number };

/**
 * Wraps a card (often itself a clickable Link) with a right-click (desktop) / long-press
 * (mobile) context menu, so the primary tap/click keeps opening the card instead of competing
 * with an always-visible menu button.
 */
export function LongPressMenu({
  children,
  itemLabel,
  onDelete,
}: {
  children: ReactNode;
  itemLabel: string;
  onDelete: () => void;
}) {
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const suppressClickRef = useRef(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuPos) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setMenuPos(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuPos(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuPos]);

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuPos({ x: event.clientX, y: event.clientY });
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        clearPressTimer();
        pressTimerRef.current = setTimeout(() => {
          suppressClickRef.current = true;
          setMenuPos({ x: touch.clientX, y: touch.clientY });
          if (navigator.vibrate) navigator.vibrate(10);
        }, LONG_PRESS_MS);
      }}
      onTouchMove={(event) => {
        const start = touchStartRef.current;
        const touch = event.touches[0];
        if (!start || !touch) return;
        const dx = Math.abs(touch.clientX - start.x);
        const dy = Math.abs(touch.clientY - start.y);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearPressTimer();
      }}
      onTouchEnd={clearPressTimer}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}

      {menuPos && (
        <div
          role="menu"
          aria-label={`${itemLabel} options`}
          style={{ position: "fixed", top: menuPos.y, left: menuPos.x }}
          className="z-[90] min-w-[150px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-card-2 py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,.6)]"
        >
          <button
            type="button"
            role="menuitem"
            data-fx-skip
            onClick={() => {
              setMenuPos(null);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] font-medium text-bad transition hover:bg-bad/10"
          >
            <ActionsTrashIcon size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
