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
} from "@xyflow/react";
import { ChevronLeft, Code2, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GetEmbedModal } from "@/components/app/get-embed-modal";
import { MeoMark } from "@/components/meo-mark";
import { ConfirmDeleteModal } from "@/components/studio/confirm-delete-modal";
import { DragGhost } from "@/components/studio/drag-ghost";
import { EmptyFlowHint } from "@/components/studio/empty-flow-hint";
import { createFlowHistoryStore, type FlowSnapshot } from "@/components/studio/flow-history";
import { FlowNodeView } from "@/components/studio/flow-node";
import { MobileAddNodeButton, MobileNodePickerSheet } from "@/components/studio/mobile-node-picker";
import { StudioNodeActionsContext } from "@/components/studio/node-actions-context";
import { NodeInspector } from "@/components/studio/node-inspector";
import { NodePalette } from "@/components/studio/node-palette";
import { TestDrawer } from "@/components/studio/test-drawer";
import { Toast } from "@/components/studio/toast";
import type { PaletteDragPoint } from "@/components/studio/use-palette-drag-handle";
import { ValidationBanner } from "@/components/studio/validation-banner";
import { ZoomPill } from "@/components/studio/zoom-pill";
import { publishFlow, saveFlow } from "@/lib/actions/flow";
import {
  NODE_KIND_META,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeKind,
} from "@/lib/flow-types";

const nodeTypes = {
  start: FlowNodeView,
  message: FlowNodeView,
  ai: FlowNodeView,
  condition: FlowNodeView,
  capture: FlowNodeView,
  webhook: FlowNodeView,
  handoff: FlowNodeView,
};

type BotSummary = { id: string; name: string; slug: string; status: "DRAFT" | "LIVE" };

type SaveStatus = "saved" | "saving";

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

/** The start node is the flow's single entry point and can never be removed by the user. */
function withDeletable(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => ({ ...node, deletable: node.type !== "start" }));
}

/** Nodes unreachable from Start (via edges), and AI nodes with no system prompt set. */
function computeFlowIssues(nodes: FlowNode[], edges: FlowEdge[]): string[] {
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

  const orphanCount = nodes.filter((node) => node.type !== "start" && !reachable.has(node.id)).length;
  const emptyPromptCount = nodes.filter(
    (node) => node.type === "ai" && !(node.data.systemPrompt ?? "").trim(),
  ).length;

  const issues: string[] = [];
  if (orphanCount > 0) {
    issues.push(`${orphanCount} node${orphanCount > 1 ? "s" : ""} not connected to Start`);
  }
  if (emptyPromptCount > 0) {
    issues.push(`${emptyPromptCount} AI node${emptyPromptCount > 1 ? "s" : ""} missing a prompt`);
  }
  return issues;
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

  const issues = useMemo(() => computeFlowIssues(nodes, edges), [nodes, edges]);
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

  // Autosave: debounce 1200ms after the graph actually changes.
  useEffect(() => {
    const snapshot = serializeGraph(nodes, edges);
    if (snapshot === lastSavedRef.current) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      await saveFlow(bot.id, flowId, { nodes, edges });
      lastSavedRef.current = snapshot;
      setSaveStatus("saved");
    }, 1200);
    return () => clearTimeout(timer);
  }, [nodes, edges, flowId, bot.id]);

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

  const handleUndo = useCallback(() => {
    const previous = historyStore.getState().popPrevious();
    if (!previous) return;
    isRestoringRef.current = true;
    inBurstRef.current = false;
    clearTimeout(burstTimerRef.current);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [historyStore, setNodes, setEdges]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z";
      if (!isUndo) return;
      const target = event.target as HTMLElement | null;
      const isEditableField =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditableField) return;
      event.preventDefault();
      handleUndo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  async function handlePublish() {
    const result = await publishFlow(bot.id);
    if (!result.error) {
      setStatus("LIVE");
      setToastMessage("Flow published");
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    }
  }

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          aria-label="Back to dashboard"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line-2 text-muted transition hover:border-orange-2/50 hover:text-text"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </Link>
        <MeoMark size={28} />
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-[15px] font-bold leading-tight">{bot.name}</h1>
          <div
            className={`text-[11.5px] font-medium ${saveStatus === "saved" ? "text-ok" : "text-muted"}`}
          >
            {saveStatus === "saved" ? "All changes saved" : "Saving…"}
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
            status === "LIVE"
              ? "border-ok/30 bg-ok/10 text-ok"
              : "border-line-2 bg-card-2 text-muted"
          }`}
        >
          {status === "LIVE" ? "Live" : "Draft"}
        </span>

        <button
          type="button"
          onClick={() => setEmbedOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-4 py-2 text-[13px] font-semibold text-text transition hover:border-orange-2/50"
        >
          <Code2 size={13} />
          Get embed
        </button>

        <button
          type="button"
          onClick={() => setTestOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-4 py-2 text-[13px] font-semibold text-text transition hover:border-orange-2/50"
        >
          <Play size={12} fill="currentColor" strokeWidth={0} />
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
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <defs>
              <linearGradient id="studio-edge-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FF5C16" />
                <stop offset="1" stopColor="#FF8A3C" />
              </linearGradient>
            </defs>
          </svg>
          <StudioNodeActionsContext.Provider value={nodeActions}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              colorMode="dark"
              fitView
              fitViewOptions={{ maxZoom: 1 }}
              proOptions={{ hideAttribution: true }}
              deleteKeyCode={["Backspace", "Delete"]}
            >
              <Background gap={24} color="rgba(255,255,255,.06)" />
            </ReactFlow>
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

      <TestDrawer
        open={testOpen}
        onClose={() => setTestOpen(false)}
        graph={{ nodes, edges }}
        flowId={flowId}
      />
      {toastMessage && <Toast message={toastMessage} />}
      {paletteDrag && <DragGhost kind={paletteDrag.kind} x={paletteDrag.x} y={paletteDrag.y} />}
      {embedOpen && <GetEmbedModal botId={bot.id} botName={bot.name} onClose={() => setEmbedOpen(false)} />}
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
