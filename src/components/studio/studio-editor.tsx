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

function StudioCanvas({
  bot,
  flowId,
  initialGraph,
}: {
  bot: BotSummary;
  flowId: string;
  initialGraph: FlowGraph;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(initialGraph.edges);
  const [status, setStatus] = useState<BotSummary["status"]>(bot.status);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [testOpen, setTestOpen] = useState(false);
  const { screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const lastSavedRef = useRef(serializeGraph(initialGraph.nodes, initialGraph.edges));

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
      };

      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat({ ...newNode, selected: true }));
    },
    [screenToFlowPosition, setNodes],
  );

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
          className="relative min-h-[380px] flex-1 bg-[#0C0C0C]"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
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
