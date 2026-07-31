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
import { ChevronLeft, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MeoMark } from "@/components/meo-mark";
import { createFlowHistoryStore, type FlowSnapshot } from "@/components/studio/flow-history";
import { FlowNodeView } from "@/components/studio/flow-node";
import { NodeInspector } from "@/components/studio/node-inspector";
import { NodePalette } from "@/components/studio/node-palette";
import { TestDrawer } from "@/components/studio/test-drawer";
import { ZoomPill } from "@/components/studio/zoom-pill";
import { publishBot, saveFlowGraph } from "@/lib/actions/flow";
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
  const { screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const lastSavedRef = useRef(serializeGraph(initialGraph.nodes, initialGraph.edges));

  const [historyStore] = useState(() => createFlowHistoryStore());
  const isRestoringRef = useRef(false);
  const inBurstRef = useRef(false);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevSnapshotRef = useRef<FlowSnapshot>({ nodes, edges });

  const selectedNode = useMemo(() => nodes.find((node) => node.selected) ?? null, [nodes]);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
  }, [setNodes]);

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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/chatmeo-node-kind") as FlowNodeKind;
      const meta = NODE_KIND_META[kind];
      if (!meta) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
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
    },
    [screenToFlowPosition, setNodes],
  );

  // Autosave: debounce 1200ms after the graph actually changes.
  useEffect(() => {
    const snapshot = serializeGraph(nodes, edges);
    if (snapshot === lastSavedRef.current) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      await saveFlowGraph(flowId, { nodes, edges });
      lastSavedRef.current = snapshot;
      setSaveStatus("saved");
    }, 1200);
    return () => clearTimeout(timer);
  }, [nodes, edges, flowId]);

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

  async function handlePublish() {
    const result = await publishBot(bot.id);
    if (!result.error) setStatus("LIVE");
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
        <NodePalette />

        <div
          ref={canvasRef}
          className="studio-flow-canvas relative min-h-[380px] flex-1 bg-[#0C0C0C]"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
            <defs>
              <linearGradient id="studio-edge-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FF5C16" />
                <stop offset="1" stopColor="#FF8A3C" />
              </linearGradient>
            </defs>
          </svg>
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
          <ZoomPill />
        </div>

        <NodeInspector node={selectedNode} onChange={updateNodeData} onClose={deselectAll} />
      </div>

      <TestDrawer open={testOpen} onClose={() => setTestOpen(false)} />
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
