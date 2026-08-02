import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InboxView, type ConversationSummary } from "@/components/app/inbox-view";
import { prisma } from "@/lib/prisma";
import { LazyGlassIcon } from "@/components/three/lazy-glass-icon";

export const metadata: Metadata = {
  title: "Inbox — Chatmeo",
};

const MAX_CONVERSATIONS = 200;

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const bots = await prisma.bot.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, slug: true },
  });

  if (bots.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <LazyGlassIcon icon="bubble" size={64} />
        <h1 className="text-lg font-bold">No bots yet</h1>
        <p className="max-w-[36ch] text-sm text-muted">
          Conversations will show up here once visitors start chatting with a bot you&apos;ve created.
        </p>
        <Link
          href="/app"
          className="mt-2 rounded-full bg-grad-orange px-5 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)]"
        >
          Go to Overview
        </Link>
      </div>
    );
  }

  const botById = new Map(bots.map((bot) => [bot.id, bot]));

  const conversations = await prisma.conversation.findMany({
    where: { botId: { in: bots.map((bot) => bot.id) } },
    orderBy: { createdAt: "desc" },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      botId: true,
      status: true,
      visitorId: true,
      createdAt: true,
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  const summaries: ConversationSummary[] = conversations
    .map((conversation) => {
      const bot = botById.get(conversation.botId);
      const lastMessage = conversation.messages[0] ?? null;
      return {
        id: conversation.id,
        botName: bot?.name ?? "Unknown bot",
        botSlug: bot?.slug ?? "",
        status: conversation.status,
        visitorId: conversation.visitorId,
        messageCount: conversation._count.messages,
        lastMessageAt: (lastMessage?.createdAt ?? conversation.createdAt).toISOString(),
        lastMessagePreview: lastMessage?.content ?? "No messages yet",
        lastMessageRole: lastMessage?.role ?? null,
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return (
    <div>
      <div className="mb-[22px]">
        <h1 className="text-[22px] font-bold tracking-tight">Inbox</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {summaries.length} {summaries.length === 1 ? "conversation" : "conversations"} across{" "}
          {bots.length} {bots.length === 1 ? "bot" : "bots"}
        </p>
      </div>

      <InboxView conversations={summaries} />
    </div>
  );
}
