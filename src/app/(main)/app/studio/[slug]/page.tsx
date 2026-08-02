import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ErrorBoundary } from "@/components/error-boundary";
import { MeoMark } from "@/components/meo-mark";
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
    <ErrorBoundary
      label="Studio canvas"
      wrapperClassName="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"
      retryButtonClassName="mt-2 rounded-full bg-grad-orange px-5 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)]"
      fallback={
        <>
          <MeoMark size={40} />
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="max-w-[36ch] text-sm text-muted">
            The Studio hit a snag rendering this flow. Your saved changes are safe — try
            refreshing.
          </p>
        </>
      }
    >
      <StudioEditor
        bot={{
          id: bot.id,
          name: bot.name,
          slug: bot.slug,
          status: bot.status,
          studioAutosave: bot.studioAutosave,
        }}
        flowId={flow.id}
        initialGraph={graph}
      />
    </ErrorBoundary>
  );
}
