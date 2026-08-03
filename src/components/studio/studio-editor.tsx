"use client";

import "@xyflow/react/dist/style.css";
import {
  addEdge,
  Background,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type FinalConnectionState,
} from "@xyflow/react";
import { ChevronLeft, Share2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { BotSettingsModal } from "@/components/app/bot-settings-modal";
import { ActionsRedoIcon, ActionsUndoIcon, CanvasPlayIcon, CanvasSaveIcon } from "@/components/icons";
import { MeoMark } from "@/components/meo-mark";
import { ConfirmDeleteModal } from "@/components/studio/confirm-delete-modal";
import { ConnectionNodePicker } from "@/components/studio/connection-node-picker";
import { DragGhost } from "@/components/studio/drag-ghost";
import { EmptyFlowHint } from "@/components/studio/empty-flow-hint";
import { createFlowHistoryStore, type FlowSnapshot } from "@/components/studio/flow-history";
import { FlowNodeView } from "@/components/studio/flow-node";
import { MobileAddNodeButton, MobileNodePickerSheet } from "@/components/studio/mobile-node-picker";
import { StudioNodeActionsContext } from "@/components/studio/node-actions-context";
import { NodeInspector } from "@/components/studio/node-inspector";
import { NodeIssuesContext } from "@/components/studio/node-issues-context";
import { NodePalette } from "@/components/studio/node-palette";
import { TestDrawer } from "@/components/studio/test-drawer";
import { Toast } from "@/components/studio/toast";
import type { PaletteDragPoint } from "@/components/studio/use-palette-drag-handle";
import { ValidationBanner } from "@/components/studio/validation-banner";
import { ZoomPill } from "@/components/studio/zoom-pill";
import { publishFlow, saveFlow, updateStudioAutosave } from "@/lib/actions/flow";
import {
  NODE_KIND_META,
  PALETTE_KINDS,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeKind,
  type NodeKindMeta,
} from "@/lib/flow-types";

const nodeTypes = {
  start: FlowNodeView,
  message: FlowNodeView,
  ai: FlowNodeView,
  condition: FlowNodeView,
  capture: FlowNodeView,
  webhook: FlowNodeView,
  handoff: FlowNodeView,
  link: FlowNodeView,
  logic: FlowNodeView,
};

type BotSummary = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "LIVE";
  studioAutosave: boolean;
};

type SaveStatus = "saved" | "saving" | "dirty" | "error";

const HISTORY_BURST_MS = 600;

/** Strips React Flow's volatile/derived fields (selected, measured, dragging…) so we can
 * detect whether the graph actually changed, not just whether it re-rendered. */
function serializeGraph(nodes: FlowNode[], edges: FlowEdge[]): string {
  const cleanNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  }));
  const cleanEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
  return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
}

function saveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case "saved":
      return "All changes saved";
    case "saving":
      return "Saving…";
    case "dirty":
      return "Unsaved changes";
    case "error":
      return "Couldn't save — try again";
  }
}

function saveStatusClass(status: SaveStatus): string {
  switch (status) {
    case "saved":
      return "text-ok";
    case "error":
      return "text-bad";
    default:
      return "text-muted";
  }
}

/** The start node is the flow's single entry point and can never be removed by the user. */
function withDeletable(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => ({ ...node, deletable: node.type !== "start" }));
}

type NodeIssue = { nodeId: string; message: string };

/** A URL field that's still just the placeholder scheme (or blank) isn't a real destination —
 * same bar for both webhook and link nodes. */
function isRealUrl(url: string | undefined): boolean {
  const trimmed = (url ?? "").trim();
  return trimmed.length > 0 && trimmed !== "https://" && trimmed !== "http://";
}

/** One issue per node that isn't actually usable yet, so the flow author can see — right on the
 * node itself, via NodeIssuesContext, as well as summarized in the top banner — exactly what's
 * missing instead of discovering it only when a real visitor hits a dead end. A node unreachable
 * from Start only reports that one issue; its other fields might also be incomplete, but wiring
 * it in is the more useful first fix to surface. */
function computeNodeIssues(nodes: FlowNode[], edges: FlowEdge[]): NodeIssue[] {
  const startNode = nodes.find((node) => node.type === "start");
  const reachable = new Set<string>();
  if (startNode) {
    const queue = [startNode.id];
    reachable.add(startNode.id);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const edge of edges) {
        if (edge.source === current && !reachable.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
  }

  const issues: NodeIssue[] = [];
  for (const node of nodes) {
    if (node.type !== "start" && !reachable.has(node.id)) {
      issues.push({ nodeId: node.id, message: "Not connected to Start" });
      continue;
    }

    switch (node.type) {
      case "message":
        if (!(node.data.text ?? "").trim()) {
          issues.push({ nodeId: node.id, message: "No message text set" });
        }
        break;
      case "ai":
        if (!(node.data.systemPrompt ?? "").trim()) {
          issues.push({ nodeId: node.id, message: "Missing a system prompt" });
        } else if (!(node.data.model ?? "").trim()) {
          issues.push({ nodeId: node.id, message: "Missing a model" });
        }
        break;
      case "condition": {
        const branches = node.data.branches ?? [];
        if (branches.length === 0) {
          issues.push({ nodeId: node.id, message: "No branches set" });
        } else {
          const unwired = branches.filter(
            (branch) => !edges.some((edge) => edge.source === node.id && edge.sourceHandle === branch.id),
          );
          if (unwired.length > 0) {
            issues.push({
              nodeId: node.id,
              message: `${unwired.length} branch${unwired.length > 1 ? "es" : ""} not connected to anything`,
            });
          }
        }
        break;
      }
      case "capture":
        if (!(node.data.question ?? "").trim()) {
          issues.push({ nodeId: node.id, message: "Missing a question" });
        } else if (!(node.data.variableName ?? "").trim()) {
          issues.push({ nodeId: node.id, message: "Missing a variable name" });
        }
        break;
      case "webhook":
        if (!isRealUrl(node.data.url)) {
          issues.push({ nodeId: node.id, message: "Missing a URL" });
        }
        break;
      case "logic":
        if ((node.data.rules ?? []).length === 0) {
          issues.push({ nodeId: node.id, message: "No rules set" });
        }
        break;
      case "link":
        if (!isRealUrl(node.data.url)) {
          issues.push({ nodeId: node.id, message: "Missing a URL" });
        }
        break;
      default:
        break;
    }
  }
  return issues;
}

/** Groups computeNodeIssues' output for the top banner, which shows a short summary rather than
 * one line per node — the per-node badge (see NodeIssuesContext) is what identifies *which*
 * node. */
function summarizeIssues(nodeIssues: NodeIssue[]): string[] {
  const counts = new Map<string, number>();
  for (const issue of nodeIssues) counts.set(issue.message, (counts.get(issue.message) ?? 0) + 1);
  return [...counts.entries()].map(([message, count]) =>
    count > 1 ? `${count} nodes: ${message}` : message,
  );
}

function StudioCanvas({
  bot,
  flowId,
  initialGraph,
}: {
  bot: BotSummary;
  flowId: string;
  initialGraph: FlowGraph;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(withDeletable(initialGraph.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialGraph.edges);
  const [status, setStatus] = useState<BotSummary["status"]>(bot.status);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [autosave, setAutosave] = useState(bot.studioAutosave);
  const [testOpen, setTestOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const { screenToFlowPosition, deleteElements } = useReactFlow<FlowNode, FlowEdge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const lastSavedRef = useRef(serializeGraph(initialGraph.nodes, initialGraph.edges));

  const [historyStore] = useState(() => createFlowHistoryStore());
  const isRestoringRef = useRef(false);
  const inBurstRef = useRef(false);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevSnapshotRef = useRef<FlowSnapshot>({ nodes, edges });

  // Which node's settings sheet is open — driven only by long-press / right-click (see
  // FlowNodeView + StudioNodeActionsContext), deliberately independent of React Flow's own
  // click-to-select state so a plain tap/click no longer pops the sheet open.
  const [detailsNodeId, setDetailsNodeId] = useState<string | null>(null);
  const detailsNode = useMemo(() => nodes.find((node) => node.id === detailsNodeId) ?? null, [nodes, detailsNodeId]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteNode = useMemo(
    () => nodes.find((node) => node.id === pendingDeleteId) ?? null,
    [nodes, pendingDeleteId],
  );

  const nodeActions = useMemo(() => ({ openDetails: (id: string) => setDetailsNodeId(id) }), []);

  const confirmDeleteNode = useCallback(() => {
    if (!pendingDeleteId) return;
    void deleteElements({ nodes: [{ id: pendingDeleteId }] });
    if (detailsNodeId === pendingDeleteId) setDetailsNodeId(null);
    setPendingDeleteId(null);
  }, [pendingDeleteId, detailsNodeId, deleteElements]);

  const nodeIssues = useMemo(() => computeNodeIssues(nodes, edges), [nodes, edges]);
  const nodeIssueMap = useMemo(
    () => Object.fromEntries(nodeIssues.map((issue) => [issue.nodeId, issue.message])),
    [nodeIssues],
  );
  const issues = useMemo(() => summarizeIssues(nodeIssues), [nodeIssues]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const lastIssueSignatureRef = useRef("");
  useEffect(() => {
    const signature = issues.join("|");
    if (signature !== lastIssueSignatureRef.current) {
      lastIssueSignatureRef.current = signature;
      setBannerDismissed(false);
    }
  }, [issues]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  // An AI node's dedicated "logic" handle only ever makes sense wired to a Logic node — block
  // anything else so a stray connection can't silently do nothing at runtime.
  const isValidConnection = useCallback(
    (connection: Connection | FlowEdge) => {
      if (connection.sourceHandle !== "logic") return true;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (sourceNode?.type !== "ai") return true;
      const targetNode = nodes.find((n) => n.id === connection.target);
      return targetNode?.type === "logic";
    },
    [nodes],
  );

  const updateNodeData = useCallback(
    (id: string, patch: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
      );
    },
    [setNodes],
  );

  const createNodeAt = useCallback(
    (kind: FlowNodeKind, screenPoint: PaletteDragPoint) => {
      const meta = NODE_KIND_META[kind];
      if (!meta) return;

      const position = screenToFlowPosition(screenPoint);
      idCounter.current += 1;
      const id = `${kind}-${Date.now()}-${idCounter.current}`;

      const newNode: FlowNode = {
        id,
        type: kind,
        position,
        data: { ...meta.defaultData },
        deletable: true,
      };

      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat({ ...newNode, selected: true }));
      // A node you just created (as opposed to one you tapped) is one you're about to fill
      // in, so open its details right away rather than making that a second action.
      setDetailsNodeId(id);
    },
    [screenToFlowPosition, setNodes],
  );

  // Dragging a connection off a handle and releasing over empty canvas (rather than onto
  // another node) pops a small picker at the drop point instead of just cancelling the drag —
  // picking a kind creates that node right there, pre-wired to the handle that was dragged.
  const [connectionPicker, setConnectionPicker] = useState<{
    x: number;
    y: number;
    nodeId: string;
    handleId: string | null;
    handleType: "source" | "target";
    kinds: NodeKindMeta[];
  } | null>(null);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
    if (connectionState.toNode || !connectionState.fromNode || !connectionState.fromHandle) return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    if (!point) return;

    const fromNode = connectionState.fromNode;
    const fromHandle = connectionState.fromHandle;
    // Mirrors isValidConnection: an AI node's "logic" dot can only ever lead to a Logic node, so
    // that's the only option worth offering. Everything else can lead anywhere in the palette.
    const kinds =
      fromHandle.type === "source" && fromHandle.id === "logic" && fromNode.type === "ai"
        ? [NODE_KIND_META.logic]
        : PALETTE_KINDS;

    setConnectionPicker({
      x: point.clientX,
      y: point.clientY,
      nodeId: fromNode.id,
      handleId: fromHandle.id ?? null,
      handleType: fromHandle.type as "source" | "target",
      kinds,
    });
  }, []);

  const handleConnectionPickerSelect = useCallback(
    (kind: FlowNodeKind) => {
      if (!connectionPicker) return;
      const meta = NODE_KIND_META[kind];
      if (!meta) return;

      const position = screenToFlowPosition({ x: connectionPicker.x, y: connectionPicker.y });
      idCounter.current += 1;
      const id = `${kind}-${Date.now()}-${idCounter.current}`;
      const newNode: FlowNode = { id, type: kind, position, data: { ...meta.defaultData }, deletable: true };
      const newEdge: FlowEdge =
        connectionPicker.handleType === "target"
          ? {
              id: `e-${id}`,
              source: id,
              target: connectionPicker.nodeId,
              targetHandle: connectionPicker.handleId ?? undefined,
            }
          : {
              id: `e-${id}`,
              source: connectionPicker.nodeId,
              target: id,
              sourceHandle: connectionPicker.handleId ?? undefined,
            };

      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat({ ...newNode, selected: true }));
      setEdges((eds) => eds.concat(newEdge));
      setDetailsNodeId(id);
      setConnectionPicker(null);
    },
    [connectionPicker, screenToFlowPosition, setNodes, setEdges],
  );

  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  const handleMobileAddNode = useCallback(
    (kind: FlowNodeKind) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const cascade = (nodes.length % 6) * 22;
      const point = rect
        ? { x: rect.left + rect.width / 2 + cascade, y: rect.top + rect.height / 2 + cascade }
        : { x: 200, y: 200 };
      createNodeAt(kind, point);
      setMobilePickerOpen(false);
    },
    [createNodeAt, nodes.length],
  );

  const [paletteDrag, setPaletteDrag] = useState<{ kind: FlowNodeKind; x: number; y: number } | null>(null);

  const handlePaletteDragStart = useCallback((kind: FlowNodeKind, point: PaletteDragPoint) => {
    setPaletteDrag({ kind, x: point.x, y: point.y });
  }, []);

  const handlePaletteDragMove = useCallback((point: PaletteDragPoint) => {
    setPaletteDrag((prev) => (prev ? { ...prev, x: point.x, y: point.y } : prev));
  }, []);

  const handlePaletteDragEnd = useCallback(
    (point: PaletteDragPoint) => {
      setPaletteDrag((prev) => {
        if (prev) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
            createNodeAt(prev.kind, point);
          }
        }
        return null;
      });
    },
    [createNodeAt],
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  function showToast(message: string) {
    setToastMessage(message);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }

  const persistGraph = useCallback(
    async (snapshot: string) => {
      const result = await saveFlow(bot.id, flowId, { nodes, edges });
      if (result.error) {
        setSaveStatus("error");
        showToast(result.error);
        return;
      }
      lastSavedRef.current = snapshot;
      setSaveStatus("saved");
    },
    [nodes, edges, flowId, bot.id],
  );

  const handleManualSave = useCallback(async () => {
    const snapshot = serializeGraph(nodes, edges);
    if (snapshot === lastSavedRef.current) return;
    setSaveStatus("saving");
    await persistGraph(snapshot);
  }, [nodes, edges, persistGraph]);

  // Autosave: debounce 1200ms after the graph actually changes. When autosave is off, this only
  // flags the graph as dirty — saving is left entirely to handleManualSave (button or Cmd/Ctrl+S).
  useEffect(() => {
    const snapshot = serializeGraph(nodes, edges);
    if (snapshot === lastSavedRef.current) return;

    if (!autosave) {
      setSaveStatus("dirty");
      return;
    }

    setSaveStatus("saving");
    const timer = setTimeout(() => {
      void persistGraph(snapshot);
    }, 1200);
    return () => clearTimeout(timer);
  }, [nodes, edges, autosave, persistGraph]);

  // Warn before leaving the tab with unsaved changes in manual-save mode — autosave mode never
  // has anything worth warning about, since a save is always in flight or just finished.
  useEffect(() => {
    if (autosave || saveStatus !== "dirty") return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [autosave, saveStatus]);

  async function handleToggleAutosave() {
    const next = !autosave;
    setAutosave(next);
    await updateStudioAutosave(bot.id, next);
  }

  // Undo history: on the first meaningful change after a quiet period, record the state as it
  // was right before that change. Further changes within the same burst (typing, dragging)
  // don't add new entries, so one undo reverts one edit rather than one keystroke/frame.
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      prevSnapshotRef.current = { nodes, edges };
      return;
    }

    const prev = prevSnapshotRef.current;
    if (serializeGraph(prev.nodes, prev.edges) === serializeGraph(nodes, edges)) return;

    if (!inBurstRef.current) {
      historyStore.getState().pushCurrent(prev);
      inBurstRef.current = true;
    }
    prevSnapshotRef.current = { nodes, edges };

    clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => {
      inBurstRef.current = false;
    }, HISTORY_BURST_MS);
  }, [nodes, edges, historyStore]);

  const canUndo = useStore(historyStore, (state) => state.past.length > 0);
  const canRedo = useStore(historyStore, (state) => state.future.length > 0);

  const handleUndo = useCallback(() => {
    const previous = historyStore.getState().undo({ nodes, edges });
    if (!previous) return;
    isRestoringRef.current = true;
    inBurstRef.current = false;
    clearTimeout(burstTimerRef.current);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [historyStore, nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const next = historyStore.getState().redo({ nodes, edges });
    if (!next) return;
    isRestoringRef.current = true;
    inBurstRef.current = false;
    clearTimeout(burstTimerRef.current);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [historyStore, nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditableField =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditableField) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        handleRedo();
      } else if (key === "z") {
        event.preventDefault();
        handleUndo();
      } else if (key === "y") {
        event.preventDefault();
        handleRedo();
      } else if (key === "s") {
        event.preventDefault();
        if (!autosave) void handleManualSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo, handleManualSave, autosave]);

  async function handlePublish() {
    const result = await publishFlow(bot.id);
    if (!result.error) {
      setStatus("LIVE");
      showToast("Flow published");
    }
  }

  return (
    <div>
      <header className="mb-4 flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/app"
            aria-label="Back to dashboard"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line-2 text-muted transition hover:border-orange-2/50 hover:text-text"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </Link>
          <MeoMark size={28} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight">{bot.name}</h1>
            <div className={`text-[11.5px] font-medium ${saveStatusClass(saveStatus)}`}>
              {saveStatusLabel(saveStatus)}
            </div>
          </div>
          <span
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              status === "LIVE"
                ? "border-ok/30 bg-ok/10 text-ok"
                : "border-line-2 bg-card-2 text-muted"
            }`}
          >
            {status === "LIVE" ? "Live" : "Draft"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-[860px]:ml-auto">
          <div className="flex items-center gap-1 rounded-full border border-line-2 bg-card-2 p-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl/Cmd+Z)"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ActionsUndoIcon size={14} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl/Cmd+Shift+Z)"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ActionsRedoIcon size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleAutosave}
            title="Toggle autosave"
            aria-pressed={autosave}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
              autosave
                ? "border-orange-2/50 bg-orange/10 text-text"
                : "border-line-2 bg-card-2 text-muted hover:text-text"
            }`}
          >
            Autosave {autosave ? "on" : "off"}
          </button>

          {!autosave && (
            <button
              type="button"
              onClick={handleManualSave}
              disabled={saveStatus === "saved" || saveStatus === "saving"}
              title="Save (Ctrl/Cmd+S)"
              className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[13px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              <CanvasSaveIcon size={13} />
              Save
            </button>
          )}

          <button
            type="button"
            onClick={() => setEmbedOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-4 py-2 text-[13px] font-semibold text-text transition hover:border-orange-2/50"
          >
            <Share2 size={13} />
            Share
          </button>

          <button
            type="button"
            onClick={() => setTestOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-4 py-2 text-[13px] font-semibold text-text transition hover:border-orange-2/50"
          >
            <CanvasPlayIcon size={12} />
            Test
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={status === "LIVE"}
            className="rounded-full bg-grad-orange px-4 py-2 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] disabled:opacity-50"
          >
            {status === "LIVE" ? "Published" : "Publish"}
          </button>
        </div>
      </header>

      <div
        className="flex h-[calc(100vh-260px)] min-h-[520px] flex-col overflow-hidden rounded-[18px] border border-line-2 min-[1020px]:h-[calc(100vh-200px)] min-[1020px]:flex-row"
      >
        <NodePalette
          dragCallbacks={{
            onDragStart: handlePaletteDragStart,
            onDragMove: handlePaletteDragMove,
            onDragEnd: handlePaletteDragEnd,
          }}
        />

        <div ref={canvasRef} className="studio-flow-canvas relative min-h-[380px] flex-1 bg-[#0C0C0C]">
          {paletteDrag && (
            <div className="pointer-events-none absolute inset-2 z-10 flex items-start justify-center rounded-[14px] border-2 border-dashed border-orange-2/60 bg-orange-2/5 pt-4">
              <span className="rounded-full border border-orange-2/40 bg-[#1c1c1c]/90 px-3 py-1.5 text-[12px] font-semibold text-orange-2 shadow-[0_12px_30px_-10px_rgba(0,0,0,.9)]">
                Drop here to add
              </span>
            </div>
          )}
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <defs>
              <linearGradient id="studio-edge-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FF5C16" />
                <stop offset="1" stopColor="#FF8A3C" />
              </linearGradient>
            </defs>
          </svg>
          <StudioNodeActionsContext.Provider value={nodeActions}>
            <NodeIssuesContext.Provider value={nodeIssueMap}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                isValidConnection={isValidConnection}
                nodeTypes={nodeTypes}
                colorMode="dark"
                fitView
                fitViewOptions={{ maxZoom: 1 }}
                proOptions={{ hideAttribution: true }}
                deleteKeyCode={["Backspace", "Delete"]}
              >
                <Background gap={24} color="rgba(255,255,255,.06)" />
              </ReactFlow>
            </NodeIssuesContext.Provider>
          </StudioNodeActionsContext.Provider>
          <ZoomPill />
          {!bannerDismissed && (
            <ValidationBanner issues={issues} onDismiss={() => setBannerDismissed(true)} />
          )}
          {nodes.length === 1 && nodes[0].type === "start" && (
            <EmptyFlowHint startNode={nodes[0]} />
          )}
          <MobileAddNodeButton onClick={() => setMobilePickerOpen(true)} />
        </div>

        <NodeInspector
          node={detailsNode}
          flowId={flowId}
          onChange={updateNodeData}
          onClose={() => setDetailsNodeId(null)}
          onRequestDelete={() => detailsNodeId && setPendingDeleteId(detailsNodeId)}
        />
      </div>

      {pendingDeleteNode && (
        <ConfirmDeleteModal
          label={pendingDeleteNode.data.label || NODE_KIND_META[pendingDeleteNode.type as FlowNodeKind]?.label || "this node"}
          onConfirm={confirmDeleteNode}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      <MobileNodePickerSheet
        open={mobilePickerOpen}
        onClose={() => setMobilePickerOpen(false)}
        onSelect={handleMobileAddNode}
      />

      {connectionPicker && (
        <ConnectionNodePicker
          x={connectionPicker.x}
          y={connectionPicker.y}
          kinds={connectionPicker.kinds}
          onSelect={handleConnectionPickerSelect}
          onClose={() => setConnectionPicker(null)}
        />
      )}

      <TestDrawer
        open={testOpen}
        onClose={() => setTestOpen(false)}
        graph={{ nodes, edges }}
        flowId={flowId}
      />
      {toastMessage && <Toast message={toastMessage} />}
      {paletteDrag && <DragGhost kind={paletteDrag.kind} x={paletteDrag.x} y={paletteDrag.y} />}
      {embedOpen && (
        <BotSettingsModal
          botId={bot.id}
          botName={bot.name}
          defaultTab="embed"
          onClose={() => setEmbedOpen(false)}
        />
      )}
    </div>
  );
}

export function StudioEditor(props: {
  bot: BotSummary;
  flowId: string;
  initialGraph: FlowGraph;
}) {
  return (
    <ReactFlowProvider>
      <StudioCanvas {...props} />
    </ReactFlowProvider>
  );
}
