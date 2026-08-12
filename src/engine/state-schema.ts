import { z } from "zod";
import type { FlowGraph } from "./types";
import { createInitialState } from "./executor";

export const EngineStateSchema = z.object({
  currentNodeId: z.string().nullable(),
  variables: z.record(z.string(), z.string()),
  status: z.enum(["RUNNING", "AWAITING_INPUT", "ENDED", "HANDOFF"]),
  lastError: z.string().optional(),
  aiReplyCounts: z.record(z.string(), z.number()).optional(),
});

/** Parses a persisted engineState JSON blob, falling back to a fresh initial state for the
 * given graph when it's empty (`{}`, a brand-new conversation) or malformed. */
export function parseEngineState(value: unknown, graph: FlowGraph) {
  const result = EngineStateSchema.safeParse(value);
  return result.success ? result.data : createInitialState(graph);
}
