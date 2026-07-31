"use client";

import { useStore } from "@xyflow/react";
import type { FlowNode } from "@/lib/flow-types";

const NODE_WIDTH = 186;

/** Floating hint that points at the Start node until the user drags in a second one. */
export function EmptyFlowHint({ startNode }: { startNode: FlowNode }) {
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const screenX = startNode.position.x * zoom + tx;
  const screenY = startNode.position.y * zoom + ty;

  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[180px] rounded-[13px] border border-orange-2/40 bg-card/95 px-3 py-2.5 text-[12px] leading-snug text-muted shadow-[0_16px_40px_-18px_rgba(0,0,0,.9)]"
      style={{ left: screenX + NODE_WIDTH * zoom + 18, top: screenY }}
    >
      Drag a node from the left to begin
    </div>
  );
}
