import type { AiNode, FlowGraph } from "@/engine/types";
import { prisma } from "@/lib/prisma";

/** Keeps the combined reference material for one AI node from crowding out the persona guard,
 * conversation history, and reply budget in the same prompt — mirrors the per-doc cap in
 * extract-text.ts but applies to the sum across every doc attached to a single node. */
const MAX_COMBINED_CHARS = 150_000;

/**
 * Mutates `graph` in place, appending each AI node's uploaded knowledge-base documents (see
 * AiNodeDocument / src/lib/actions/ai-documents.ts) onto its systemPrompt. Lives at the
 * orchestration layer rather than inside the pure engine or adapt-graph.ts, for the same reason
 * conversation history merging does (run-turn.ts) — it needs a DB round trip the engine and its
 * adapters are deliberately kept free of.
 */
export async function attachAiNodeDocuments(graph: FlowGraph, flowId: string): Promise<void> {
  const aiNodes = graph.nodes.filter((node): node is AiNode => node.type === "ai");
  if (aiNodes.length === 0) return;

  const docs = await prisma.aiNodeDocument.findMany({
    where: { flowId, nodeId: { in: aiNodes.map((node) => node.id) } },
    select: { nodeId: true, fileName: true, content: true },
    orderBy: { createdAt: "asc" },
  });
  if (docs.length === 0) return;

  const byNode = new Map<string, typeof docs>();
  for (const doc of docs) {
    const existing = byNode.get(doc.nodeId);
    if (existing) existing.push(doc);
    else byNode.set(doc.nodeId, [doc]);
  }

  for (const node of aiNodes) {
    const nodeDocs = byNode.get(node.id);
    if (!nodeDocs || nodeDocs.length === 0) continue;

    let reference = nodeDocs
      .map((doc) => `--- ${doc.fileName} ---\n${doc.content}`)
      .join("\n\n");
    if (reference.length > MAX_COMBINED_CHARS) {
      reference = `${reference.slice(0, MAX_COMBINED_CHARS)}\n\n[…truncated]`;
    }

    node.data.systemPrompt =
      `${node.data.systemPrompt}\n\nReference material — use this to answer, and don't mention ` +
      `that it was provided as documents:\n\n${reference}`;
  }
}
