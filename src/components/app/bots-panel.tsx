import { BotRow } from "@/components/app/bot-row";
import { CreateBotButton } from "@/components/app/create-bot-modal";
import { LazyGlassIcon } from "@/components/three/lazy-glass-icon";

type BotSummary = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "LIVE";
  avatarUrl: string | null;
  conversationCount: number;
};

export function BotsPanel({ bots }: { bots: BotSummary[] }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-[18px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <b className="text-sm font-semibold">Your bots</b>
        <CreateBotButton />
      </div>

      {bots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <LazyGlassIcon icon="bubble" size={56} />
          <p className="text-center text-[13px] text-muted">No bots yet — create your first one above.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {bots.map((bot) => (
            <BotRow key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
