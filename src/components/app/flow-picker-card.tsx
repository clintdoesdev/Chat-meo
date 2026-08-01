"use client";

import Link from "next/link";
import { useTransition } from "react";
import { LongPressMenu } from "@/components/app/long-press-menu";
import { MeoMark } from "@/components/meo-mark";
import { deleteBot } from "@/lib/actions/bots";

export function FlowPickerCard({
  bot,
}: {
  bot: { id: string; name: string; slug: string; status: "DRAFT" | "LIVE" };
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${bot.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("botId", bot.id);
      await deleteBot(formData);
    });
  }

  return (
    <LongPressMenu itemLabel={bot.name} onDelete={handleDelete}>
      <Link
        href={`/app/studio/${bot.slug}`}
        aria-busy={pending}
        className={`flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition hover:-translate-y-[2px] hover:border-orange-2/40 ${
          pending ? "pointer-events-none opacity-50" : ""
        }`}
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
    </LongPressMenu>
  );
}
