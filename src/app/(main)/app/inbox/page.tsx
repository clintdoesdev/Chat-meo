import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InboxView } from "@/components/app/inbox-view";
import { listConversations, listFolders } from "@/lib/actions/inbox";
import { prisma } from "@/lib/prisma";
import { LazyGlassIcon } from "@/components/three/lazy-glass-icon";

export const metadata: Metadata = {
  title: "Inbox — Chatmeo",
};

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const botCount = await prisma.bot.count({ where: { userId: session.user.id } });

  if (botCount === 0) {
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

  const [summaries, folders] = await Promise.all([listConversations(), listFolders()]);
  const activeCount = summaries.filter((s) => !s.archived).length;

  return (
    <div>
      <div className="mb-[22px]">
        <h1 className="text-[22px] font-bold tracking-tight">Inbox</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {activeCount} {activeCount === 1 ? "conversation" : "conversations"} across{" "}
          {botCount} {botCount === 1 ? "bot" : "bots"}
        </p>
      </div>

      <InboxView conversations={summaries} folders={folders} />
    </div>
  );
}
