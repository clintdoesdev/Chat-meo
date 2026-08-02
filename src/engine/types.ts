// Pure, framework-agnostic flow graph + execution types. No @xyflow/react, no Prisma —
// this module knows nothing about the editor or the database, only how to walk a graph.

export type ConditionBranch = {
  id: string;
  label: string;
  value: string;
};

export type StartNode = {
  id: string;
  type: "start";
  data: { text?: string };
};

export type MessageNode = {
  id: string;
  type: "message";
  data: { text: string };
};

export type AiNode = {
  id: string;
  type: "ai";
  data: { systemPrompt: string; model: string; temperature: number };
};

export type ConditionNode = {
  id: string;
  type: "condition";
  data: { variable: string; branches: ConditionBranch[] };
};

export type CaptureNode = {
  id: string;
  type: "capture";
  data: { question: string; variableName: string };
};

export type WebhookNode = {
  id: string;
  type: "webhook";
  data: { url: string; method: string };
};

export type HandoffNode = {
  id: string;
  type: "handoff";
  /** `note` is an internal note for your team about why this handoff happened — it's never
   * shown to the customer, who always sees the fixed handoff message (see executor.ts). */
  data: { note?: string };
};

export type FlowNode =
  | StartNode
  | MessageNode
  | AiNode
  | ConditionNode
  | CaptureNode
  | WebhookNode
  | HandoffNode;

export type FlowNodeKind = FlowNode["type"];

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  /** Set for edges leaving a condition node's branch-specific handle; absent otherwise. */
  sourceHandle?: string | null;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type EngineStatus = "RUNNING" | "AWAITING_INPUT" | "ENDED" | "HANDOFF";

export type EngineState = {
  currentNodeId: string | null;
  variables: Record<string, string>;
  status: EngineStatus;
  /** The most recent AI-node LLM failure's message, if the last step() call hit one — reset on
   * every call, so it only ever reflects that turn's outcome. Diagnostic only (never shown to
   * end visitors); the Studio Test drawer's Debug panel is what actually surfaces it. */
  lastError?: string;
};

export type Reply = { content: string };

export type EngineOutput = {
  replies: Reply[];
  state: EngineState;
};

export type LlmChatMessage = { role: "user" | "assistant"; content: string };

export type LlmDep = (args: {
  systemPrompt: string;
  history: LlmChatMessage[];
  temperature: number;
  model: string;
}) => Promise<string>;

export type LoggerDep = {
  error: (message: string, meta?: unknown) => void;
  info?: (message: string, meta?: unknown) => void;
};

/** Where this turn is running. The handoff node's customer-facing message only makes sense on
 * our own hosted widget — webhook-delivered channels (e.g. WhatsApp) handle their own
 * agent-handoff UX, so the engine stays silent there and just flips the conversation status.
 * Missing/omitted defaults to "web" for callers (and existing tests) that predate channels. */
export type EngineChannel = "web" | "webhook";

export type EngineDeps = {
  llm: LlmDep;
  fetch: typeof fetch;
  logger: LoggerDep;
  /** Passed through to webhook node payloads; not otherwise used by the engine. */
  conversationId: string;
  channel?: EngineChannel;
};
