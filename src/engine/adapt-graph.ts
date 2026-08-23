// Bridges the Studio's persisted graph shape (loosely-typed, one flat `data` object shared by
// every node kind — see @/lib/flow-types) into the engine's strict discriminated-union
// FlowGraph. This is the only file in src/engine/ that's allowed to know the Studio's shape;
// types.ts and executor.ts stay framework-agnostic.

import type { FlowGraph as PersistedGraph, FlowNode as PersistedNode } from "@/lib/flow-types";
import type { FlowEdge, FlowGraph, FlowNode } from "./types";

function adaptNode(node: PersistedNode): FlowNode | null {
  const data = node.data;
  switch (node.type) {
    case "start":
      return { id: node.id, type: "start", data: { text: data.text } };
    case "message":
      return { id: node.id, type: "message", data: { text: data.text ?? "" } };
    case "ai":
      return {
        id: node.id,
        type: "ai",
        data: {
          systemPrompt: data.systemPrompt ?? "",
          model: data.model ?? "grok-main",
          temperature: data.temperature ?? 0.35,
          provider: data.provider,
          maxReplies: data.maxReplies,
        },
      };
    case "reply":
      return {
        id: node.id,
        type: "reply",
        data: {
          text: data.text ?? "",
          randomizeWording: data.randomizeWording,
          model: data.model,
          temperature: data.temperature,
          provider: data.provider,
          delaySeconds: data.delaySeconds,
          variants: (data.variants ?? []).map((variant) => ({ id: variant.id, text: variant.text })),
        },
      };
    case "condition":
      return {
        id: node.id,
        type: "condition",
        data: {
          variable: data.variable ?? "",
          branches: (data.branches ?? []).map((branch) => ({
            id: branch.id,
            label: branch.label,
            value: branch.value,
          })),
        },
      };
    case "capture":
      return {
        id: node.id,
        type: "capture",
        data: { question: data.question ?? "", variableName: data.variableName ?? "" },
      };
    case "webhook":
      return {
        id: node.id,
        type: "webhook",
        data: { url: data.url ?? "", method: data.method ?? "POST" },
      };
    case "logic":
      return {
        id: node.id,
        type: "logic",
        data: {
          rules: (data.rules ?? []).map((rule) => ({
            id: rule.id,
            label: rule.label,
            triggers: rule.triggers,
            reply: rule.reply,
          })),
        },
      };
    case "handoff":
      return { id: node.id, type: "handoff", data: { note: data.note } };
    case "silentHandoff":
      return { id: node.id, type: "silentHandoff", data: { note: data.note } };
    case "link":
      return { id: node.id, type: "link", data: { url: data.url ?? "", linkText: data.linkText } };
    default:
      return null;
  }
}

/** Converts a persisted Flow.graph into the shape the executor walks. Nodes of an
 * unrecognized type, and edges pointing to a node that got dropped for any reason, are
 * silently omitted rather than crashing — the executor's own dead-end handling takes it from
 * there. */
export function adaptPersistedGraph(graph: PersistedGraph): FlowGraph {
  const nodes = graph.nodes.map(adaptNode).filter((node): node is FlowNode => node !== null);
  const nodeIds = new Set(nodes.map((node) => node.id));

  const edges: FlowEdge[] = graph.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle }));

  return { nodes, edges };
}
