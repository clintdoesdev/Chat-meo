import { FlowGraphSchema, parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph, type FlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";

export type GetFlowResult = { error: string; flowId?: undefined; graph?: undefined } | { error: null; flowId: string; graph: FlowGraph };

/** Loads (or lazily creates) the one Flow row a bot has — same convention as the web Studio
 * page's own bot+flow load (src/app/(main)/app/studio/[slug]/page.tsx), extracted here so the
 * mobile REST API can reuse it without duplicating the ownership check or the "no flow yet"
 * bootstrap. Returns an error result rather than throwing when the bot doesn't exist or isn't
 * owned by this user, so a route handler can turn that straight into a 404. */
export async function getOrCreateFlowForUser(userId: string, botId: string): Promise<GetFlowResult> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { flows: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  if (!bot || bot.userId !== userId) return { error: "Bot not found." };

  let flow = bot.flows[0];
  if (!flow) {
    flow = await prisma.flow.create({
      data: { botId: bot.id, name: "Main flow", graph: defaultFlowGraph() as object, isActive: true },
    });
  }

  return { error: null, flowId: flow.id, graph: parseFlowGraph(flow.graph) ?? defaultFlowGraph() };
}

/** Validates and saves a flow graph for a bot this user owns — the same validation the web
 * Studio editor's saveFlow Server Action uses (src/lib/actions/flow.ts, now a thin wrapper over
 * this), reused here so the mobile REST API's PATCH route doesn't duplicate the ownership check
 * or the schema validation. */
export async function saveFlowForUser(
  userId: string,
  botId: string,
  flowId: string,
  graph: unknown,
): Promise<{ error: string | null }> {
  const parsed = FlowGraphSchema.safeParse(graph);
  if (!parsed.success) return { error: "Invalid flow data." };

  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { botId: true, bot: { select: { userId: true } } },
  });
  if (!flow || flow.botId !== botId || flow.bot.userId !== userId) {
    return { error: "Flow not found." };
  }

  await prisma.flow.update({ where: { id: flowId }, data: { graph: parsed.data as object } });
  return { error: null };
}
