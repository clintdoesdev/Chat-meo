// Pure, framework-agnostic flow graph + execution types. No @xyflow/react, no Prisma —
// this module knows nothing about the editor or the database, only how to walk a graph.

export type ConditionBranch = {
  id: string;
  label: string;
  value: string;
};

export type LogicRule = {
  id: string;
  label: string;
  triggers: string;
  reply: string;
};

export type ReplyVariant = {
  id: string;
  text: string;
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
  /** provider is a ProviderId (see src/lib/ai/providers.ts) as a plain string, same reasoning
   * as flow-types.ts's FlowNodeData.provider — undefined means "use the deployment default".
   * maxReplies caps the free-form back-and-forth loop this node runs when nothing routes away
   * from it (see the "ai" case in executor.ts) — undefined/0 means unlimited, matching today's
   * behavior. Once the cap is hit, the node behaves as if it *did* have somewhere to go: it
   * follows its plain outgoing edge if one exists; otherwise, if a Logic node is attached (the
   * "logic" source handle), it locks onto that instead of ending — same as logicLocked below —
   * so the Logic node's rules can still fire on later messages (a payment confirmation, etc.)
   * even though the LLM itself is done freelancing. Only silently hands off to a human (same
   * customer-facing behavior as SilentHandoffNode — no announcement, on any channel) when there's
   * neither a plain edge nor a Logic node to fall back on. */
  data: { systemPrompt: string; model: string; temperature: number; provider?: string; maxReplies?: number };
};

/**
 * A drop-in, non-AI alternative to AiNode for the same "chat freely, with a Logic node attached
 * for the parts that actually need to be reliable" slot — same logic-attachment control flow
 * (see runLogicAttachedNode in executor.ts), but the reply is always the author's own fixed
 * `text` rather than something an LLM decided to say, so there's nothing for it to invent or
 * drift on. Unlike AiNode, this node never resends its own fixed text a second time on the same
 * visit — once sent, it locks onto its attached Logic node (if any) or silently hands off,
 * exactly as if maxReplies were fixed at 1 — since repeating identical fixed text adds nothing
 * an AI node's varying free-form replies would. `randomizeWording` is the only place AI enters
 * the picture at all: when on, the fixed text gets lightly reworded (same meaning, different
 * phrasing) before each send, purely so repeated sends don't look like an identical copy-pasted
 * broadcast — the model is never given license to add, remove, or change what's actually being
 * said, and a failed rewording call just falls back to the literal text rather than surfacing an
 * error. `delaySeconds` pauses this node's own send by that many seconds (visitor-message
 * triggered, not a background scheduler — see runLogicAttachedNode's generateReply callback in
 * executor.ts), capped at MAX_REPLY_DELAY_SECONDS; it never delays an attached Logic rule's own
 * reply. `variants` are alternate wordings of `text`, author-written rather than AI-generated —
 * when present, each send randomly picks one of `text` plus these instead of always sending
 * `text`; composes with randomizeWording (the picked variant still gets reworded on top).
 * model/provider are only consulted when randomizeWording is on, or when a Logic node is
 * attached (its semantic-match pass needs something to call) — otherwise this node makes zero
 * LLM calls. `imageDataUri` is an optional attached image (see MAX_IMAGE_CAPTION_LENGTH in
 * executor.ts for how it combines with the message text). */
export type ReplyNode = {
  id: string;
  type: "reply";
  data: {
    text: string;
    randomizeWording?: boolean;
    model?: string;
    temperature?: number;
    provider?: string;
    delaySeconds?: number;
    variants?: ReplyVariant[];
    imageDataUri?: string;
  };
};

export type ConditionNode = {
  id: string;
  type: "condition";
  data: { variable: string; branches: ConditionBranch[] };
};

/** Business rules meant to be attached to an AI node (via an edge from that node's dedicated
 * "logic" source handle) — checked against the visitor's message before the LLM is called, so a
 * matched rule's reply/routing pre-empts the LLM entirely for that turn. Can also be wired
 * directly into the main flow like a Condition node; see the "logic" case in executor.ts. */
export type LogicNode = {
  id: string;
  type: "logic";
  data: { rules: LogicRule[] };
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

export type LinkNode = {
  id: string;
  type: "link";
  /** `linkText` is the label shown above the URL (e.g. "Book a call") — optional, since a bare
   * URL is still a valid reply. */
  data: { url: string; linkText?: string };
};

export type HandoffNode = {
  id: string;
  type: "handoff";
  /** `note` is an internal note for your team about why this handoff happened — it's never
   * shown to the customer, who always sees the fixed handoff message (see executor.ts). */
  data: { note?: string };
};

/** Same effect as HandoffNode (ends the bot's automated replies, marks the conversation as
 * needing a human) but never shows the customer anything, on any channel — useful right after a
 * Logic rule already said what needed saying (e.g. sent a payment link) and the flow author
 * wants a human to take it from there without the bot announcing a handoff on top of it. */
export type SilentHandoffNode = {
  id: string;
  type: "silentHandoff";
  data: { note?: string };
};

export type FlowNode =
  | StartNode
  | MessageNode
  | AiNode
  | ReplyNode
  | ConditionNode
  | CaptureNode
  | WebhookNode
  | HandoffNode
  | SilentHandoffNode
  | LinkNode
  | LogicNode;

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
  /** The most recent AiNode LLM failure's message, if the last step() call hit one — reset on
   * every call, so it only ever reflects that turn's outcome. Diagnostic only (never shown to
   * end visitors); the Studio Test drawer's Debug panel is what actually surfaces it. A ReplyNode
   * never sets this — its rewording pass (see ReplyNode.data.randomizeWording) fails silently
   * into the fixed text instead, since that fallback is always correct. */
  lastError?: string;
  /** Consecutive-loop reply counts, keyed by node id, for enforcing AiNode.data.maxReplies — see
   * runLogicAttachedNode in executor.ts. Cleared for a node the moment it's actually left (routed
   * away from), so re-entering it later starts a fresh count rather than resuming an old one. */
  aiReplyCounts?: Record<string, number>;
  /** Keyed by node id (AiNode or ReplyNode): set once an attached Logic rule has actually replied
   * while the conversation stayed on that node, or (ReplyNode only) once the node's own fixed
   * text has been sent once (see runLogicAttachedNode in executor.ts) — the flow author has moved
   * this conversation into a rules-only phase (e.g. "send payment link, then only listen for a
   * confirmation"), so the node must not jump back in with its own reply on something a rule
   * already handled, or (ReplyNode) resend its own fixed text a second time. Once set, a visitor
   * message that matches no rule gets no reply at all rather than falling through to the node's
   * own content. Cleared the moment the node is actually left (routed away from), same as
   * aiReplyCounts, so returning to it later starts fresh. */
  logicLocked?: Record<string, boolean>;
};

export type Reply = {
  content: string;
  /** "IMAGE" only ever comes from a ReplyNode with an attached image (see
   * ReplyNode.data.imageDataUri) — `content` is then the image's `data:` URI itself, not text.
   * Omitted (the default, same as Message.contentType's) means plain text. */
  contentType?: "TEXT" | "IMAGE";
  /** Only meaningful alongside contentType: "IMAGE" — the caption to show under the image, when
   * the node's message was short enough to fit as one; see MAX_IMAGE_CAPTION_LENGTH in
   * executor.ts. A message too long for a caption is sent as its own separate (TEXT) Reply
   * instead, so this is never a truncated version of that overflow case. */
  caption?: string;
  /** Only set for replies produced by an LLM call that reported usage — an "ai" node always,
   * a "reply" node only when its rewording pass actually ran (see ReplyNode.data.randomizeWording).
   * Message nodes, condition nodes, etc. never have these. */
  promptTokens?: number;
  completionTokens?: number;
};

export type EngineOutput = {
  replies: Reply[];
  state: EngineState;
};

export type LlmChatMessage = { role: "user" | "assistant"; content: string };

export type LlmUsage = { promptTokens: number; completionTokens: number };

export type LlmResult = { content: string; usage?: LlmUsage };

export type LlmDep = (args: {
  systemPrompt: string;
  history: LlmChatMessage[];
  temperature: number;
  model: string;
  /** A ProviderId as a plain string (see AiNode.data.provider above). Unrecognized or
   * undefined falls back to whichever provider the deployment resolves as active by default. */
  provider?: string;
}) => Promise<LlmResult>;

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
  /** A separate, non-conversational LLM call used to decide whether the visitor's message
   * matches a Logic rule *by meaning* rather than by literal keyword — see matchLogicRule's
   * keyword pass in executor.ts, which this only runs after. Deliberately not the same
   * dependency as `llm`: that one always gets the bot persona's instructions appended (see
   * PERSONA_GUARD in engine/llm.ts), which would corrupt a classification prompt that needs a
   * bare rule id back, not a conversational reply. */
  classify: LlmDep;
  fetch: typeof fetch;
  logger: LoggerDep;
  /** Passed through to webhook node payloads; not otherwise used by the engine. */
  conversationId: string;
  channel?: EngineChannel;
};
