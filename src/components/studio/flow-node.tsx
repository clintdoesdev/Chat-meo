import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { NODE_KIND_META, type FlowNode, type FlowNodeData, type FlowNodeKind } from "@/lib/flow-types";

const HANDLE_COLOR = "#FF5C16";
const HANDLE_CLASS = "!h-[9px] !w-[9px] !border-2 !border-[#0C0C0C]";
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

function previewText(data: FlowNodeData, kind?: FlowNodeKind): string {
  switch (kind) {
    case "start":
    case "message":
      return data.text || "No message set";
    case "ai":
      return data.systemPrompt || "No system prompt set";
    case "capture":
      return data.question || "No question set";
    case "webhook":
      return data.url ? `${data.method ?? "POST"} ${data.url}` : "No URL set";
    case "handoff":
      return data.note || "No note set";
    default:
      return "";
  }
}

export function FlowNodeView({ id, data, selected, type, deletable }: NodeProps<FlowNode>) {
  const meta = type ? NODE_KIND_META[type] : undefined;
  const color = meta?.color ?? "#FF5C16";
  const branches = type === "condition" ? (data.branches ?? []) : [];
  const { deleteElements } = useReactFlow();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function confirmDelete() {
    const label = data.label || meta?.label || "this node";
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
    void deleteElements({ nodes: [{ id }] });
  }

  // React Flow's own pointer handling on the node wrapper calls stopPropagation() on the
  // native touch event during the bubble phase, which short-circuits React's synthetic event
  // dispatch entirely (React's JSX props depend on the native event bubbling all the way up
  // to React's root listener). So long-press detection is wired via native capture-phase
  // addEventListener instead of onTouchStart/onTouchMove/onTouchEnd JSX props — capture-phase
  // listeners run top-down before any bubble-phase stopPropagation() can block them.
  useEffect(() => {
    if (!deletable) return;
    const node = rootRef.current;
    if (!node) return;

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      clearPressTimer();
      pressTimerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(10);
        confirmDelete();
      }, LONG_PRESS_MS);
    }

    function handleTouchMove(event: TouchEvent) {
      const start = touchStartRef.current;
      const touch = event.touches[0];
      if (!start || !touch) return;
      if (
        Math.abs(touch.clientX - start.x) > MOVE_CANCEL_PX ||
        Math.abs(touch.clientY - start.y) > MOVE_CANCEL_PX
      ) {
        clearPressTimer();
      }
    }

    function handleTouchEnd() {
      clearPressTimer();
    }

    node.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    node.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
    node.addEventListener("touchend", handleTouchEnd, { capture: true, passive: true });
    node.addEventListener("touchcancel", handleTouchEnd, { capture: true, passive: true });

    return () => {
      clearPressTimer();
      node.removeEventListener("touchstart", handleTouchStart, { capture: true });
      node.removeEventListener("touchmove", handleTouchMove, { capture: true });
      node.removeEventListener("touchend", handleTouchEnd, { capture: true });
      node.removeEventListener("touchcancel", handleTouchEnd, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletable, id, data.label, meta?.label]);

  return (
    <div
      ref={rootRef}
      className="w-[186px] rounded-[14px] border bg-[#161616] p-3 text-[12px] shadow-[0_16px_40px_-18px_rgba(0,0,0,.9)]"
      style={{
        borderColor: selected ? "#FF8A3C" : "rgba(255,255,255,.12)",
        boxShadow: selected
          ? "0 0 0 3px rgba(255,110,40,.18), 0 16px 40px -18px rgba(0,0,0,.9)"
          : undefined,
      }}
      onContextMenu={
        deletable
          ? (event: React.MouseEvent) => {
              event.preventDefault();
              confirmDelete();
            }
          : undefined
      }
    >
      {type !== "start" && (
        <Handle
          type="target"
          position={Position.Left}
          className={HANDLE_CLASS}
          style={{ background: HANDLE_COLOR }}
        />
      )}

      <div className="mb-1 flex items-center gap-2 text-[12px] font-bold">
        <i
          className="h-2 w-2 flex-shrink-0 rounded-[3px]"
          style={{
            background: color,
            boxShadow: type === "ai" ? `0 0 8px 1px ${color}` : undefined,
          }}
        />
        <span className="truncate">{data.label || meta?.label}</span>
      </div>

      {type === "condition" ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {branches.length === 0 && <p className="text-[11px] text-muted">No branches set</p>}
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="relative flex items-center justify-between gap-2 rounded-[8px] bg-white/[.04] py-1 pl-2 pr-3 text-[11px]"
            >
              <span className="truncate text-muted">{branch.label || "Untitled branch"}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={branch.id}
                className={`${HANDLE_CLASS} !right-[-17px] !top-1/2 !-translate-y-1/2`}
                style={{ background: HANDLE_COLOR, position: "absolute" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="line-clamp-2 text-[11px] text-muted">{previewText(data, type)}</p>
      )}

      {type !== "handoff" && type !== "condition" && (
        <Handle
          type="source"
          position={Position.Right}
          className={HANDLE_CLASS}
          style={{ background: HANDLE_COLOR }}
        />
      )}
    </div>
  );
}
