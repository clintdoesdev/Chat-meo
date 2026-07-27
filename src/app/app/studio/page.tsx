import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MeoMark } from "@/components/meo-mark";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Studio — Chatmeo",
};

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const bots = await prisma.bot.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, status: true },
  });

  if (bots.length === 1) {
    redirect(`/app/studio/${bots[0].slug}`);
  }

  if (bots.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <MeoMark size={40} />
        <h1 className="text-lg font-bold">No bots yet</h1>
        <p className="max-w-[36ch] text-sm text-muted">
          Create a bot from the Overview page before opening the Flow Studio.
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

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold tracking-tight">Studio</h1>
      <p className="mb-6 text-[12.5px] text-muted">Pick a bot to open its flow.</p>
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
        {bots.map((bot) => (
          <Link
            key={bot.id}
            href={`/app/studio/${bot.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition hover:-translate-y-[2px] hover:border-orange-2/40"
          >
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "rgba(255,92,22,.15)" }}
            >
              <MeoMark size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{bot.name}</div>
              <div className="truncate text-[11.5px] text-muted">{bot.slug}</div>
            </div>
            <span
              className={`ml-auto flex-shrink-0 rounded-full border px-[11px] py-1 text-[11px] font-semibold ${
                bot.status === "LIVE"
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : "border-line-2 bg-card-2 text-muted"
              }`}
            >
              {bot.status === "LIVE" ? "Live" : "Draft"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
