"use client";

import { Code2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { GetEmbedModal } from "@/components/app/get-embed-modal";
import { LongPressMenu } from "@/components/app/long-press-menu";
import { MeoMark } from "@/components/meo-mark";
import { deleteBot } from "@/lib/actions/bots";

export function BotRow({
  bot,
}: {
  bot: {
    id: string;
    name: string;
    slug: string;
    status: "DRAFT" | "LIVE";
    conversationCount: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [embedOpen, setEmbedOpen] = useState(false);

  function handleDelete() {
    if (!confirm(`Delete "${bot.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("botId", bot.id);
      await deleteBot(formData);
    });
  }

  return (
    <>
      <LongPressMenu itemLabel={bot.name} onDelete={handleDelete}>
        <div className="flex items-center gap-1">
          <Link
            href={`/app/studio/${bot.slug}`}
            aria-busy={pending}
            className={`flex flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-card-2 ${
              pending ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <span
              className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: "rgba(255,92,22,.15)" }}
            >
              <MeoMark size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold">{bot.name}</div>
              <div className="truncate text-[11.5px] text-muted">
                {bot.slug} · {bot.conversationCount} {bot.conversationCount === 1 ? "chat" : "chats"}
              </div>
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
          <button
            type="button"
            data-fx-skip
            onClick={() => setEmbedOpen(true)}
            aria-label={`Get embed code for ${bot.name}`}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-card-2 hover:text-text"
          >
            <Code2 size={15} />
          </button>
        </div>
      </LongPressMenu>
      {embedOpen && <GetEmbedModal botId={bot.id} botName={bot.name} onClose={() => setEmbedOpen(false)} />}
    </>
  );
}
