import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudioEditor } from "@/components/studio/studio-editor";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";

export default async function StudioBotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const bot = await prisma.bot.findUnique({
    where: { slug },
    include: { flows: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });

  if (!bot || bot.userId !== session.user.id) {
    notFound();
  }

  let flow = bot.flows[0];
  if (!flow) {
    flow = await prisma.flow.create({
      data: {
        botId: bot.id,
        name: "Main flow",
        graph: defaultFlowGraph() as object,
        isActive: true,
      },
    });
  }

  const graph = parseFlowGraph(flow.graph) ?? defaultFlowGraph();

  return (
    <StudioEditor
      bot={{ id: bot.id, name: bot.name, slug: bot.slug, status: bot.status }}
      flowId={flow.id}
      initialGraph={graph}
    />
  );
}
