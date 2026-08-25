import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PythonBotEditor } from "@/components/studio/python-bot-editor";
import { prisma } from "@/lib/prisma";

export default async function PythonBotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const bot = await prisma.bot.findUnique({ where: { slug }, select: { id: true, userId: true, name: true, slug: true } });
  if (!bot || bot.userId !== session.user.id) {
    notFound();
  }

  return <PythonBotEditor botId={bot.id} botName={bot.name} botSlug={bot.slug} />;
}
