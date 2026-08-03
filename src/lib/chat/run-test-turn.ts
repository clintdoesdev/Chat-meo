import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { providerLlm } from "@/engine/llm";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineState, LlmChatMessage, LlmDep, Reply } from "@/engine/types";
import { attachAiNodeDocuments } from "@/lib/chat/attach-ai-documents";
import { parseFlowGraph } from "@/lib/flow-schema";

// Mirrors src/lib/chat/run-turn.ts's constant of the same name — that one trims what it loads
// from the Message table, this one trims the transcript the Test drawer replays with each call.
const MAX_HISTORY_MESSAGES = 12;

export type RunTestTurnParams = {
  graph: unknown;
  state?: unknown;
  message?: string;
  sessionId?: string;
  /** So the Test drawer can preview an AI node's uploaded knowledge-base docs even though the
   * graph it's testing is the unsaved in-editor one — docs are keyed by flowId, not by the graph
   * blob itself. Omitted (e.g. no flow yet) simply means no documents get attached. */
  flowId?: string;
  /** The Test drawer's session isn't backed by a Conversation row the way a real chat is (see
   * runChatTurn), so it has no Message table to reload — the caller replays its own client-side
   * transcript here instead. Without this, an AI node that keeps a conversation going across
   * several turns (see executor.ts) would have no memory of anything before the current turn. */
  priorHistory?: LlmChatMessage[];
};

export type RunTestTurnResult =
  | { kind: "invalid_graph" }
  | { kind: "success"; replies: Reply[]; state: EngineState };

/**
 * The Studio Test drawer's counterpart to runChatTurn — same engine, but the graph is
 * whatever's currently in the editor (not what's persisted) and nothing is written to the
 * database. State round-trips through the caller instead of a Conversation row.
 */
export async function runTestTurn(params: RunTestTurnParams): Promise<RunTestTurnResult> {
  const persistedGraph = parseFlowGraph(params.graph);
  if (!persistedGraph) return { kind: "invalid_graph" };

  const graph = adaptPersistedGraph(persistedGraph);
  if (params.flowId) await attachAiNodeDocuments(graph, params.flowId);
  const state = params.state ? parseEngineState(params.state, graph) : createInitialState(graph);

  const priorHistory = params.priorHistory ?? [];
  const llm: LlmDep = (args) =>
    providerLlm({ ...args, history: [...priorHistory, ...args.history].slice(-MAX_HISTORY_MESSAGES) });

  const output = await step(graph, state, params.message, {
    llm,
    fetch,
    logger: console,
    conversationId: params.sessionId ?? "test-session",
    channel: "web",
  });

  return { kind: "success", replies: output.replies, state: output.state };
}
