/** Mirrors src/lib/flow-types.ts's node/edge/graph shapes (same convention as
 * lib/api/types.ts's doc comment: extra fields the backend adds later are simply ignored by
 * TypeScript's structural typing). FlowNode/FlowEdge are redeclared here as plain object types
 * instead of extending @xyflow/react's Node<>/Edge generics, since that package is a web-only
 * Studio-canvas dependency not installed in the mobile app's own node_modules — the web file only
 * imports it as a type (erased at compile time there), which doesn't help a separate package. */

export type FlowNodeKind =
  | "start"
  | "message"
  | "ai"
  | "reply"
  | "condition"
  | "capture"
  | "webhook"
  | "handoff"
  | "silentHandoff"
  | "link"
  | "logic";

export type AiModel = string;
export type WebhookMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ConditionBranch = {
  id: string;
  label: string;
  value: string;
};

export type ReplyVariant = {
  id: string;
  text: string;
};

export type LogicRule = {
  id: string;
  label: string;
  triggers: string;
  reply: string;
};

export type FlowNodeData = {
  label: string;
  text?: string;
  systemPrompt?: string;
  provider?: string;
  model?: AiModel;
  temperature?: number;
  maxReplies?: number;
  randomizeWording?: boolean;
  delaySeconds?: number;
  variants?: ReplyVariant[];
  imageDataUri?: string;
  variable?: string;
  branches?: ConditionBranch[];
  rules?: LogicRule[];
  question?: string;
  variableName?: string;
  url?: string;
  method?: WebhookMethod;
  linkText?: string;
  note?: string;
};

export type FlowNode = {
  id: string;
  type: FlowNodeKind;
  position: { x: number; y: number };
  data: FlowNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

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
  description: string;
};

// Same kinds, labels, colors and defaults as NODE_KINDS in src/lib/flow-types.ts — kept in sync
// by hand for now since the two files can't share a module across the web/mobile package
// boundary.
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
    kind: "reply",
    label: "Reply",
    color: "#FFB454",
    defaultData: { label: "Reply", text: "Thanks for reaching out! Someone will follow up shortly." },
    inPalette: true,
    description:
      "Sends a fixed reply, word for word — like Send message, but it stays in the conversation " +
      "and can have a Logic node attached for hard rules to check on later messages.",
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
      "Drag this off an AI or Reply node's bottom dot to give it hard rules to check before it replies.",
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
    description: "Branches the flow based on a variable's value — connect each branch to a different next step.",
  },
  {
    kind: "capture",
    label: "Capture input",
    color: "#4ED88E",
    defaultData: { label: "Capture input", variableName: "email", question: "What's your email?" },
    inPalette: true,
    description: "Asks the visitor a question and saves their reply to a variable you can reuse later in the flow.",
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
    description: "Shares a clickable link — pricing pages, booking pages, docs, anything visitors need to click through to.",
  },
  {
    kind: "handoff",
    label: "Handoff",
    color: "#FF5757",
    defaultData: { label: "Handoff", note: "Route to a human teammate." },
    inPalette: true,
    description: "Ends the bot's automated replies and marks the conversation as needing a human.",
  },
  {
    kind: "silentHandoff",
    label: "Silent handoff",
    color: "#C24848",
    defaultData: { label: "Silent handoff", note: "Route to a human teammate without announcing it." },
    inPalette: true,
    description: "Same as Handoff, but the customer isn't told — the bot just stops replying.",
  },
];

export const NODE_KIND_META: Record<FlowNodeKind, NodeKindMeta> = Object.fromEntries(
  NODE_KINDS.map((meta) => [meta.kind, meta]),
) as Record<FlowNodeKind, NodeKindMeta>;
