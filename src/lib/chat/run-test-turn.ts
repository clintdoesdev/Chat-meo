import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { grokLlm } from "@/engine/llm";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineState, Reply } from "@/engine/types";
import { parseFlowGraph } from "@/lib/flow-schema";

export type RunTestTurnParams = {
  graph: unknown;
  state?: unknown;
  message?: string;
  sessionId?: string;
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
  const state = params.state ? parseEngineState(params.state, graph) : createInitialState(graph);

  const output = await step(graph, state, params.message, {
    llm: grokLlm,
    fetch,
    logger: console,
    conversationId: params.sessionId ?? "test-session",
  });

  return { kind: "success", replies: output.replies, state: output.state };
}
