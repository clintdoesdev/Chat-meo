import { Plus } from "lucide-react";
import { DeleteBotForm } from "@/components/app/delete-bot-form";
import { MeoMark } from "@/components/meo-mark";
import { createBot } from "@/lib/actions/bots";

type BotSummary = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "LIVE";
  conversationCount: number;
};

export function BotsPanel({ bots }: { bots: BotSummary[] }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-[18px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <b className="text-sm font-semibold">Your bots</b>
        <form action={createBot} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="New bot name"
            className="w-40 rounded-full border border-line-2 bg-card-2 px-3.5 py-1.5 text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none sm:w-52"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-grad-orange px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)]"
          >
            <Plus size={13} />
            New bot
          </button>
        </form>
      </div>

      {bots.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">
          No bots yet — create your first one above.
        </p>
      ) : (
        <div className="flex flex-col">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-card-2"
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
                  {bot.slug} · {bot.conversationCount}{" "}
                  {bot.conversationCount === 1 ? "chat" : "chats"}
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
              <DeleteBotForm botId={bot.id} botName={bot.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
