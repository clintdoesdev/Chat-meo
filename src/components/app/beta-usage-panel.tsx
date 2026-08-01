type BotUsage = { id: string; name: string; messagesThisMonth: number };

function ProgressBar({ value, cap }: { value: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((value / cap) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-2">
      <div className="h-full rounded-full bg-grad-orange" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Purely informational — this is expected beta behavior, not billing enforcement, so
 * deliberately no "Upgrade" CTA and no red/alarm styling even when a bot is at its cap.
 */
export function BetaUsagePanel({
  botCap,
  botCount,
  messageCap,
  bots,
}: {
  botCap: number;
  botCount: number;
  messageCap: number;
  bots: BotUsage[];
}) {
  return (
    <div className="mb-3.5 rounded-2xl border border-line bg-card p-[18px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm font-semibold">Beta usage</b>
        <span className="text-[11.5px] text-muted">
          {botCount} / {botCap} bots
        </span>
      </div>

      {bots.length === 0 ? (
        <p className="text-[12.5px] text-muted">Create a bot to see its monthly usage here.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bots.map((bot) => (
            <div key={bot.id}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate font-medium text-text">{bot.name}</span>
                <span className="flex-shrink-0 text-muted">
                  {bot.messagesThisMonth} messages used this month · Beta cap: {messageCap}
                </span>
              </div>
              <ProgressBar value={bot.messagesThisMonth} cap={messageCap} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
