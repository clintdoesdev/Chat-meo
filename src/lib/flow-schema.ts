import { z } from "zod";
import type { FlowGraph } from "@/lib/flow-types";

const ConditionBranchSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  value: z.string(),
});

const ReplyVariantSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});

const LogicRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  triggers: z.string(),
  reply: z.string(),
});

const FlowNodeDataSchema = z.object({
  label: z.string(),
  text: z.string().optional(),
  systemPrompt: z.string().optional(),
  // Same "permissive plain string" reasoning as model below — see AiNode.data.provider in
  // flow-types.ts.
  provider: z.string().optional(),
  // Deliberately a plain string, not an enum of today's model ids: the Studio's inspector UI
  // is what constrains which values get *written* going forward (see AiModel in flow-types.ts).
  // Keeping this permissive means graphs saved under an older or future model roster still
  // validate — adapt-graph.ts/llm.ts already fall back gracefully for any unrecognized value.
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxReplies: z.number().int().min(1).max(50).optional(),
  randomizeWording: z.boolean().optional(),
  // Seconds, capped to MAX_REPLY_DELAY_SECONDS in engine/executor.ts (120) — kept slightly
  // looser here since the executor is the source of truth for the actual cap.
  delaySeconds: z.number().min(0).max(120).optional(),
  variants: z.array(ReplyVariantSchema).max(20).optional(),
  // A base64 `data:` URI — sized generously above a 200KB source image (see MAX_IMAGE_BYTES in
  // node-inspector.tsx) to account for base64's ~33% overhead plus the "data:image/...;base64,"
  // prefix, without leaving the cap effectively unbounded.
  imageDataUri: z.string().max(300_000).optional(),
  variable: z.string().optional(),
  branches: z.array(ConditionBranchSchema).optional(),
  rules: z.array(LogicRuleSchema).optional(),
  question: z.string().optional(),
  variableName: z.string().optional(),
  url: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  linkText: z.string().optional(),
  note: z.string().optional(),
});

const FlowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "start",
    "message",
    "ai",
    "reply",
    "condition",
    "capture",
    "webhook",
    "handoff",
    "silentHandoff",
    "link",
    "logic",
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: FlowNodeDataSchema,
  deletable: z.boolean().optional(),
  selected: z.boolean().optional(),
});

const FlowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  selected: z.boolean().optional(),
});

export const FlowGraphSchema = z.object({
  nodes: z.array(FlowNodeSchema).max(500),
  edges: z.array(FlowEdgeSchema).max(1000),
});

export function parseFlowGraph(value: unknown): FlowGraph | null {
  const result = FlowGraphSchema.safeParse(value);
  return result.success ? (result.data as FlowGraph) : null;
}
