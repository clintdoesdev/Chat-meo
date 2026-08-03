import type { Edge, Node } from "@xyflow/react";

export type FlowNodeKind =
  | "start"
  | "message"
  | "ai"
  | "condition"
  | "capture"
  | "webhook"
  | "handoff"
  | "link"
  | "logic";

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

export type LogicRule = {
  id: string;
  label: string;
  // Comma-separated keywords/phrases matched (case-insensitively, contains-match) against the
  // visitor's message that triggered this turn. Empty means "anything else" — a catch-all,
  // same convention as ConditionBranch's empty value.
  triggers: string;
  // Sent verbatim (after {{variable}} interpolation) when this rule fires — supports markdown
  // links, e.g. "Here's the link: [Pay now](https://...)". Empty means "route only, no reply".
  reply: string;
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
  // logic
  rules?: LogicRule[];
  // capture
  question?: string;
  variableName?: string;
  // webhook / link
  url?: string;
  method?: WebhookMethod;
  // link — the label shown above the URL, e.g. "Book a call" or "View pricing"
  linkText?: string;
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
      "Lets the AI write a reply based on a system prompt you set, the conversation so far, and any " +
      "documents you upload for it to reference. Drag from its bottom dot to attach a Logic node for " +
      "hard rules the AI should always follow.",
  },
  {
    kind: "logic",
    label: "Logic",
    color: "#B98CFF",
    defaultData: {
      label: "Logic",
      rules: [
        {
          id: "rule-1",
          label: "Asks for a payment link",
          triggers: "payment, invoice, pay now, checkout",
          reply: "Sure — here's your payment link: [Pay now](https://example.com/pay)",
        },
        { id: "rule-2", label: "Anything else", triggers: "", reply: "" },
      ],
    },
    inPalette: true,
    description:
      "Drag this off an AI node's bottom dot to give it hard rules to check before it replies — " +
      "\"if they ask for a payment link, send this\", \"if they say X, route to Y instead.\" A rule " +
      "can send a canned reply, jump the conversation to another node, or both. Anything that " +
      "doesn't match falls through to the AI as normal.",
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
    kind: "link",
    label: "Send link",
    color: "#4EC5D8",
    defaultData: { label: "Send link", linkText: "Learn more", url: "https://" },
    inPalette: true,
    description:
      "Shares a clickable link — pricing pages, booking pages, docs, anything visitors need to click through to.",
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

