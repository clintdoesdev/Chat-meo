"use client";

import "@xyflow/react/dist/style.css";
import {
  addEdge,
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlowNodeView } from "@/components/studio/flow-node";
import { NodeInspector } from "@/components/studio/node-inspector";
import { NodePalette } from "@/components/studio/node-palette";
import { MeoMark } from "@/components/meo-mark";
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

type SaveStatus = "saved" | "pending" | "saving";

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
  const { screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const lastSavedRef = useRef(serializeGraph(initialGraph.nodes, initialGraph.edges));

  const selectedNode = useMemo(() => nodes.find((node) => node.selected) ?? null, [nodes]);

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

    setSaveStatus("pending");
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      await saveFlowGraph(flowId, { nodes, edges });
      lastSavedRef.current = snapshot;
      setSaveStatus("saved");
    }, 800);
    return () => clearTimeout(timer);
  }, [nodes, edges, flowId]);

  async function handlePublish() {
    const result = await publishBot(bot.id);
    if (!result.error) setStatus("LIVE");
  }

  const saveLabel =
    saveStatus === "saved" ? "All changes saved" : saveStatus === "saving" ? "Saving…" : "Unsaved changes";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MeoMark size={30} />
          <div>
            <h1 className="text-[18px] font-bold">{bot.name}</h1>
            <div className={`text-[12px] ${saveStatus === "saved" ? "text-ok" : "text-muted"}`}>
              {saveLabel}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
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
            onClick={handlePublish}
            disabled={status === "LIVE"}
            className="rounded-full bg-grad-orange px-4 py-2 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] disabled:opacity-50"
          >
            {status === "LIVE" ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      <div
        className="grid overflow-hidden rounded-[18px] border border-line-2"
        style={{ gridTemplateColumns: "216px 1fr 260px", height: "calc(100vh - 220px)", minHeight: 520 }}
      >
        <NodePalette />

        <div
          ref={canvasRef}
          className="relative bg-[#0C0C0C]"
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
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <NodeInspector node={selectedNode} onChange={updateNodeData} />
      </div>
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
