import { Handle, Position, useNodeConnections, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { StatusWarningIcon } from "@/components/icons";
import { NODE_KIND_ICON } from "@/components/studio/node-icons";
import { useStudioNodeActions } from "@/components/studio/node-actions-context";
import { useNodeIssue } from "@/components/studio/node-issues-context";
import { NODE_KIND_META, type FlowNode, type FlowNodeData, type FlowNodeKind } from "@/lib/flow-types";

const HANDLE_COLOR = "#FF5C16";
const LOGIC_HANDLE_COLOR = "#B98CFF";
const HANDLE_CLASS = "!h-[9px] !w-[9px] !border-2 !border-[#0C0C0C]";
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const WOBBLE_MS = 400;
// A short tap that releases before the long-press timer fires just wobbles the node — on its
// own that's an easy signal to miss. Two or more of those in quick succession means someone's
// actually trying (and failing) to open the node, so that's the cue to spell it out.
const RAPID_TAP_WINDOW_MS = 900;
const RAPID_TAP_THRESHOLD = 2;
const TAP_HINT_VISIBLE_MS = 1800;

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
    case "silentHandoff":
      return data.note || "No note set";
    case "link":
      return data.url ? (data.linkText ? `${data.linkText} → ${data.url}` : data.url) : "No link set";
    default:
      return "";
  }
}

type BranchItem = { id: string; label: string };

function branchItemsFor(data: FlowNodeData, kind?: FlowNodeKind): BranchItem[] {
  if (kind === "condition") {
    return (data.branches ?? []).map((branch) => ({ id: branch.id, label: branch.label || "Untitled branch" }));
  }
  if (kind === "logic") {
    return (data.rules ?? []).map((rule) => ({
      id: rule.id,
      label: rule.label || (rule.triggers.trim() === "" ? "Anything else" : "Untitled rule"),
    }));
  }
  return [];
}

export function FlowNodeView({ id, data, selected, type }: NodeProps<FlowNode>) {
  const meta = type ? NODE_KIND_META[type] : undefined;
  const color = meta?.color ?? "#FF5C16";
  const Icon = NODE_KIND_ICON[type ?? "message"];
  const branchItems = branchItemsFor(data, type);
  const hasBranchHandles = type === "condition" || type === "logic";
  const logicConnections = useNodeConnections({ id, handleType: "source", handleId: "logic" });
  const hasLogicAttached = type === "ai" && logicConnections.length > 0;
  const issue = useNodeIssue(id);
  const { openDetails } = useStudioNodeActions();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wobbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const [wobbling, setWobbling] = useState(false);
  const rapidTapCountRef = useRef(0);
  const rapidTapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTapHint, setShowTapHint] = useState(false);

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

  function registerRapidTap() {
    rapidTapCountRef.current += 1;
    if (rapidTapResetTimerRef.current) clearTimeout(rapidTapResetTimerRef.current);
    rapidTapResetTimerRef.current = setTimeout(() => {
      rapidTapCountRef.current = 0;
    }, RAPID_TAP_WINDOW_MS);

    if (rapidTapCountRef.current >= RAPID_TAP_THRESHOLD) {
      rapidTapCountRef.current = 0;
      setShowTapHint(true);
      if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
      tapHintTimerRef.current = setTimeout(() => setShowTapHint(false), TAP_HINT_VISIBLE_MS);
    }
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
        registerRapidTap();
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
      if (rapidTapResetTimerRef.current) clearTimeout(rapidTapResetTimerRef.current);
      if (tapHintTimerRef.current) clearTimeout(tapHintTimerRef.current);
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
      className={`relative w-[186px] rounded-[14px] border bg-[#161616] p-3 text-[12px] shadow-[0_16px_40px_-18px_rgba(0,0,0,.9)] ${
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
      {issue && (
        <span
          title={issue}
          aria-label={`Needs attention: ${issue}`}
          className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#161616] bg-orange-2 text-[#1A1108] shadow-[0_2px_6px_rgba(0,0,0,.5)]"
        >
          <StatusWarningIcon size={11} />
        </span>
      )}

      {showTapHint && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-max max-w-[160px] -translate-x-1/2 rounded-[10px] border border-line-2 bg-[#1c1c1c] px-2.5 py-1.5 text-center text-[10.5px] font-medium leading-snug text-text shadow-[0_12px_30px_-10px_rgba(0,0,0,.9)]"
        >
          Long-press (or right-click) to edit
        </div>
      )}

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

      {hasBranchHandles ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {branchItems.length === 0 && (
            <p className="text-[11px] text-muted">{type === "logic" ? "No rules set" : "No branches set"}</p>
          )}
          {branchItems.map((item) => (
            <div
              key={item.id}
              className="relative flex items-center justify-between gap-2 rounded-[8px] bg-white/[.04] py-1 pl-2 pr-3 text-[11px]"
            >
              <span className="truncate text-muted">{item.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={item.id}
                className={`${HANDLE_CLASS} !right-[-17px] !top-1/2 !-translate-y-1/2`}
                style={{ background: type === "logic" ? LOGIC_HANDLE_COLOR : HANDLE_COLOR, position: "absolute" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="line-clamp-2 text-[11px] text-muted">{previewText(data, type)}</p>
      )}

      {type === "ai" && (
        <div
          className="mt-1.5 flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[10.5px] font-medium"
          style={{
            background: hasLogicAttached ? "rgba(185,140,255,.14)" : "rgba(255,255,255,.04)",
            color: hasLogicAttached ? LOGIC_HANDLE_COLOR : undefined,
          }}
        >
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: hasLogicAttached ? LOGIC_HANDLE_COLOR : "rgba(255,255,255,.25)" }}
          />
          <span className={hasLogicAttached ? "" : "text-muted"}>
            {hasLogicAttached ? "Logic attached" : "Drag bottom dot to attach Logic"}
          </span>
        </div>
      )}

      {type === "ai" && data.maxReplies && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-[8px] bg-white/[.04] px-2 py-1 text-[10.5px] font-medium text-muted">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "rgba(255,255,255,.25)" }} />
          Max {data.maxReplies} {data.maxReplies === 1 ? "reply" : "replies"} before handoff
        </div>
      )}

      {type !== "handoff" && type !== "silentHandoff" && !hasBranchHandles && (
        <Handle
          type="source"
          position={Position.Right}
          className={HANDLE_CLASS}
          style={{ background: HANDLE_COLOR }}
        />
      )}

      {type === "ai" && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="logic"
          className={`${HANDLE_CLASS} !bottom-[-6px] !left-1/2 !-translate-x-1/2`}
          style={{ background: LOGIC_HANDLE_COLOR }}
        />
      )}
    </div>
  );
}
