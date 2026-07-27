import type { Edge, Node } from "@xyflow/react";

export type FlowNodeKind =
  | "start"
  | "message"
  | "ai"
  | "condition"
  | "capture"
  | "webhook"
  | "handoff";

export type FlowNodeData = {
  label: string;
  text?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  condition?: string;
  variableName?: string;
  prompt?: string;
  url?: string;
  note?: string;
};

export type FlowNode = Node<FlowNodeData, FlowNodeKind>;
export type FlowEdge = Edge;

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type NodeKindMeta = {
  kind: FlowNodeKind;
  label: string;
  color: string;
  defaultData: FlowNodeData;
  inPalette: boolean;
};

export const NODE_KINDS: NodeKindMeta[] = [
  {
    kind: "start",
    label: "Start",
    color: "#FF5C16",
    defaultData: { label: "Greeting", text: "Hey, I'm Meo. What can I help with?" },
    inPalette: false,
  },
  {
    kind: "message",
    label: "Send message",
    color: "#FF5C16",
    defaultData: { label: "Send message", text: "Write what Meo should say…" },
    inPalette: true,
  },
  {
    kind: "ai",
    label: "AI response",
    color: "#FF8A3C",
    defaultData: {
      label: "AI response",
      systemPrompt: "You are Meo, a friendly assistant. Be warm, brief, and helpful.",
      model: "claude-sonnet",
      temperature: 0.35,
    },
    inPalette: true,
  },
  {
    kind: "condition",
    label: "Condition",
    color: "#6EA8FF",
    defaultData: { label: "Condition", condition: "reply contains \"pricing\"" },
    inPalette: true,
  },
  {
    kind: "capture",
    label: "Capture input",
    color: "#4ED88E",
    defaultData: { label: "Capture input", variableName: "email", prompt: "What's your email?" },
    inPalette: true,
  },
  {
    kind: "webhook",
    label: "Webhook",
    color: "#C58BFF",
    defaultData: { label: "Webhook", url: "https://" },
    inPalette: true,
  },
  {
    kind: "handoff",
    label: "Handoff",
    color: "#FF5757",
    defaultData: { label: "Handoff", note: "Route to a human teammate." },
    inPalette: true,
  },
];

export const NODE_KIND_META: Record<FlowNodeKind, NodeKindMeta> = Object.fromEntries(
  NODE_KINDS.map((meta) => [meta.kind, meta]),
) as Record<FlowNodeKind, NodeKindMeta>;

export const PALETTE_KINDS: NodeKindMeta[] = NODE_KINDS.filter((meta) => meta.inPalette);

export function defaultFlowGraph(): FlowGraph {
  return {
    nodes: [
      {
        id: "start-1",
        type: "start",
        position: { x: 60, y: 120 },
        data: { label: "Greeting", text: "Hey, I'm Meo. What can I help with?" },
      },
    ],
    edges: [],
  };
}

export function isFlowGraph(value: unknown): value is FlowGraph {
  if (!value || typeof value !== "object") return false;
  const graph = value as Record<string, unknown>;
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges);
}
