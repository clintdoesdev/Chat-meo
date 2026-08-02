import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { NODE_KIND_ICON } from "@/components/studio/node-icons";
import { useStudioNodeActions } from "@/components/studio/node-actions-context";
import { NODE_KIND_META, type FlowNode, type FlowNodeData, type FlowNodeKind } from "@/lib/flow-types";

const HANDLE_COLOR = "#FF5C16";
const HANDLE_CLASS = "!h-[9px] !w-[9px] !border-2 !border-[#0C0C0C]";
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const WOBBLE_MS = 400;

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

export function FlowNodeView({ id, data, selected, type }: NodeProps<FlowNode>) {
  const meta = type ? NODE_KIND_META[type] : undefined;
  const color = meta?.color ?? "#FF5C16";
  const Icon = NODE_KIND_ICON[type ?? "message"];
  const branches = type === "condition" ? (data.branches ?? []) : [];
  const { openDetails } = useStudioNodeActions();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const [wobbling, setWobbling] = useState(false);

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function triggerWobble() {
    setWobbling(true);
    if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
    wobbleTimerRef.current = setTimeout(() => setWobbling(false), WOBBLE_MS);
  }

  // React Flow's own pointer handling on the node wrapper calls stopPropagation() on the
  // native pointer/touch event during the bubble phase, which short-circuits React's synthetic
  // event dispatch entirely (React's JSX props depend on the native event bubbling all the way
  // up to React's root listener). So press-and-hold detection is wired via native capture-phase
  // addEventListener instead of onTouchStart/onMouseDown JSX props — capture-phase listeners run
  // top-down before any bubble-phase stopPropagation() can block them.
  //
  // React Flow also takes pointer capture on the node for its own drag handling, which means a
  // "mouseup"/"touchend" fired at release time doesn't reliably bubble (or even dispatch) on
  // this node's own element anymore. So press-start is detected on the node itself, but the
  // move/end tracking that follows is done on `window` (capture phase) instead, which sees the
  // event regardless of which element the browser/React Flow considers its target.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    function endPress() {
      const wasPending = pressTimerRef.current !== null;
      clearPressTimer();
      pressStartRef.current = null;
      window.removeEventListener("touchmove", handleWindowTouchMove, { capture: true });
      window.removeEventListener("touchend", endPress, { capture: true });
      window.removeEventListener("touchcancel", endPress, { capture: true });
      window.removeEventListener("mousemove", handleWindowMouseMove, { capture: true });
      window.removeEventListener("mouseup", endPress, { capture: true });
      // A short tap that released before the long-press timer fired: just a wobble, no panel.
      if (wasPending && !firedRef.current) {
        triggerWobble();
      }
    }

    function movePress(x: number, y: number) {
      const start = pressStartRef.current;
      if (!start) return;
      if (Math.abs(x - start.x) > MOVE_CANCEL_PX || Math.abs(y - start.y) > MOVE_CANCEL_PX) {
        clearPressTimer();
      }
    }

    function handleWindowTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) movePress(touch.clientX, touch.clientY);
    }
    function handleWindowMouseMove(event: MouseEvent) {
      movePress(event.clientX, event.clientY);
    }

    function startPress(x: number, y: number) {
      pressStartRef.current = { x, y };
      firedRef.current = false;
      clearPressTimer();
      pressTimerRef.current = setTimeout(() => {
        firedRef.current = true;
        if (navigator.vibrate) navigator.vibrate(10);
        openDetails(id);
      }, LONG_PRESS_MS);
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      startPress(touch.clientX, touch.clientY);
      window.addEventListener("touchmove", handleWindowTouchMove, { capture: true, passive: true });
      window.addEventListener("touchend", endPress, { capture: true, passive: true });
      window.addEventListener("touchcancel", endPress, { capture: true, passive: true });
    }
    function handleMouseDown(event: MouseEvent) {
      if (event.button !== 0) return;
      startPress(event.clientX, event.clientY);
      window.addEventListener("mousemove", handleWindowMouseMove, { capture: true });
      window.addEventListener("mouseup", endPress, { capture: true });
    }

    node.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    node.addEventListener("mousedown", handleMouseDown, { capture: true });

    return () => {
      clearPressTimer();
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
      node.removeEventListener("touchstart", handleTouchStart, { capture: true });
      node.removeEventListener("mousedown", handleMouseDown, { capture: true });
      window.removeEventListener("touchmove", handleWindowTouchMove, { capture: true });
      window.removeEventListener("touchend", endPress, { capture: true });
      window.removeEventListener("touchcancel", endPress, { capture: true });
      window.removeEventListener("mousemove", handleWindowMouseMove, { capture: true });
      window.removeEventListener("mouseup", endPress, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div
      ref={rootRef}
      className={`w-[186px] rounded-[14px] border bg-[#161616] p-3 text-[12px] shadow-[0_16px_40px_-18px_rgba(0,0,0,.9)] ${
        wobbling ? "node-wobble" : ""
      }`}
      style={{
        borderColor: selected ? "#FF8A3C" : "rgba(255,255,255,.12)",
        boxShadow: selected
          ? "0 0 0 3px rgba(255,110,40,.18), 0 16px 40px -18px rgba(0,0,0,.9)"
          : undefined,
      }}
      onContextMenu={(event: React.MouseEvent) => {
        event.preventDefault();
        openDetails(id);
      }}
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
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[7px]"
          style={{
            background: `${color}26`,
            color,
            boxShadow: type === "ai" ? `0 0 8px 1px ${color}55` : undefined,
          }}
        >
          <Icon size={11} />
        </span>
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
