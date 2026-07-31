"use client";

import { useRef } from "react";
import type { FlowNodeKind } from "@/lib/flow-types";

// A short hold-and-still period before a touch counts as "picking up" a node, rather than
// scrolling the horizontal chip strip. Mouse users clear this instantly in practice.
const ACTIVATION_DELAY_MS = 150;
const MOVE_CANCEL_THRESHOLD_PX = 6;

export type PaletteDragPoint = { x: number; y: number };

export type PaletteDragCallbacks = {
  onDragStart: (kind: FlowNodeKind, point: PaletteDragPoint) => void;
  onDragMove: (point: PaletteDragPoint) => void;
  onDragEnd: (point: PaletteDragPoint) => void;
};

/** Pointer-events-based drag source for a palette chip — works for mouse and touch alike,
 * unlike the HTML5 drag-and-drop API which touch browsers never fire. */
export function usePaletteDragHandle(kind: FlowNodeKind, callbacks: PaletteDragCallbacks) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startRef = useRef<PaletteDragPoint | null>(null);
  const activeRef = useRef(false);

  function reset() {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    startRef.current = null;
    activeRef.current = false;
  }

  return {
    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const point = { x: event.clientX, y: event.clientY };
      startRef.current = point;
      const target = event.currentTarget;
      const pointerId = event.pointerId;
      timerRef.current = setTimeout(() => {
        if (!startRef.current) return;
        activeRef.current = true;
        try {
          target.setPointerCapture(pointerId);
        } catch {
          // The pointer may already be gone (e.g. a fast tap-release). The drag can still
          // proceed off whatever move/up events do arrive.
        }
        callbacks.onDragStart(kind, startRef.current);
      }, ACTIVATION_DELAY_MS);
    },
    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      if (activeRef.current) {
        event.preventDefault();
        callbacks.onDragMove({ x: event.clientX, y: event.clientY });
        return;
      }
      const start = startRef.current;
      if (!start) return;
      const dx = Math.abs(event.clientX - start.x);
      const dy = Math.abs(event.clientY - start.y);
      if (dx > MOVE_CANCEL_THRESHOLD_PX || dy > MOVE_CANCEL_THRESHOLD_PX) {
        reset();
      }
    },
    onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
      if (activeRef.current) {
        callbacks.onDragEnd({ x: event.clientX, y: event.clientY });
      }
      reset();
    },
    onPointerCancel() {
      reset();
    },
  };
}
