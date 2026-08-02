import type { Edge, Node } from "@xyflow/react";

export type FlowNodeKind =
  | "start"
  | "message"
  | "ai"
  | "condition"
  | "capture"
  | "webhook"
  | "handoff";

// Deliberately a plain string rather than a fixed union: which model ids are valid depends on
// which AI provider is active (see src/lib/ai/providers.ts) — xAI's are a small fixed set, but
// OpenRouter alone hosts hundreds of them. "grok-main"/"grok-fast" remain recognized as legacy
// aliases for backward compatibility (see XAI_MODEL_MAP in src/engine/llm.ts); any other value
// is passed through to the provider as-is.
export type AiModel = string;
export type WebhookMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ConditionBranch = {
  id: string;
  label: string;
  value: string;
};

export type FlowNodeData = {
  label: string;
  // start / message
  text?: string;
  // ai
  systemPrompt?: string;
  // A ProviderId ("xai" | "openrouter") from src/lib/ai/providers.ts, kept as a plain string
  // here for the same reason model is: this file stays free of a hard dependency on that
  // module's types. Unset means "use the deployment's default provider" (see
  // src/lib/ai/providers.ts's env-based fallback).
  provider?: string;
  model?: AiModel;
  temperature?: number;
  // condition
  variable?: string;
  branches?: ConditionBranch[];
  // capture
  question?: string;
  variableName?: string;
  // webhook
  url?: string;
  method?: WebhookMethod;
  // handoff
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
  /** Plain-language explanation shown behind the (i) info icon next to this node kind. */
  description: string;
};

export const NODE_KINDS: NodeKindMeta[] = [
  {
    kind: "start",
    label: "Start",
    color: "#FF5C16",
    defaultData: { label: "Greeting", text: "Hey, I'm Meo. What can I help with?" },
    inPalette: false,
    description: "Where every conversation begins. Every bot has exactly one — it can't be deleted.",
  },
  {
    kind: "message",
    label: "Send message",
    color: "#FF5C16",
    defaultData: { label: "Send message", text: "Write what Meo should say…" },
    inPalette: true,
    description: "Sends a fixed piece of text to the visitor, word for word — no AI involved.",
  },
  {
    kind: "ai",
    label: "AI response",
    color: "#FF8A3C",
    defaultData: {
      label: "AI response",
      systemPrompt: "You are Meo, a friendly assistant. Be warm, brief, and helpful.",
      model: "grok-main",
      temperature: 0.35,
    },
    inPalette: true,
    description:
      "Lets the AI write a reply based on a system prompt you set, the conversation so far, and any documents you upload for it to reference.",
  },
  {
    kind: "condition",
    label: "Condition",
    color: "#6EA8FF",
    defaultData: {
      label: "Condition",
      variable: "last_message",
      branches: [
        { id: "branch-1", label: "Contains \"pricing\"", value: "pricing" },
        { id: "branch-2", label: "Else", value: "" },
      ],
    },
    inPalette: true,
    description:
      "Branches the flow based on a variable's value — connect each branch to a different next step.",
  },
  {
    kind: "capture",
    label: "Capture input",
    color: "#4ED88E",
    defaultData: { label: "Capture input", variableName: "email", question: "What's your email?" },
    inPalette: true,
    description:
      "Asks the visitor a question and saves their reply to a variable you can reuse later in the flow.",
  },
  {
    kind: "webhook",
    label: "Webhook",
    color: "#C58BFF",
    defaultData: { label: "Webhook", url: "https://", method: "POST" },
    inPalette: true,
    description: "Calls an external URL (your own API, Zapier, etc.) while the conversation is running.",
  },
  {
    kind: "handoff",
    label: "Handoff",
    color: "#FF5757",
    defaultData: { label: "Handoff", note: "Route to a human teammate." },
    inPalette: true,
    description:
      "Ends the bot's automated replies and marks the conversation as needing a human — it'll show up in your Inbox.",
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

