import { StatCard } from "@/components/app/stat-card";
import { MeoMark } from "@/components/meo-mark";

const STATS = [
  { label: "Conversations", value: "1,248", trend: { percent: 18, direction: "up" as const }, spark: [3, 5, 4, 7, 6, 9, 8, 11] },
  { label: "Resolution rate", value: "92%", trend: { percent: 4, direction: "up" as const }, spark: [6, 7, 6, 8, 9, 8, 10, 9] },
  { label: "Leads captured", value: "312", trend: { percent: 9, direction: "down" as const }, spark: [9, 8, 8, 7, 8, 6, 7, 5] },
];

const BOTS = [
  { name: "Website Assistant", detail: "yourbrand.com", status: "Live" as const },
  { name: "Sales Concierge", detail: "shopfront.io", status: "Live" as const },
  { name: "Onboarding Guide", detail: "not published yet", status: "Draft" as const },
];

/** Illustrative, static preview — not wired to real data. The real dashboard lives at /app. */
export function DashboardMockup() {
  return (
    <div className="glass-card relative z-[2] mx-auto mt-11 max-w-[880px] overflow-hidden rounded-[18px]">
      <div className="flex gap-1.5 border-b border-line px-3.5 py-2.5">
        <i className="h-[9px] w-[9px] rounded-full bg-[#3A3A3A]" />
        <i className="h-[9px] w-[9px] rounded-full bg-[#2A2A2A]" />
        <i className="h-[9px] w-[9px] rounded-full bg-[#2A2A2A]" />
      </div>

      <div className="p-4 text-left min-[600px]:p-[18px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <MeoMark size={22} />
          <span className="text-[13px] font-semibold">Website Assistant · Overview</span>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2 min-[480px]:gap-2.5">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} compact />
          ))}
        </div>

        <div className="rounded-xl border border-line bg-card p-3">
          <div className="mb-2 text-[11.5px] font-semibold">Your bots</div>
          {BOTS.map((bot) => (
            <div key={bot.name} className="flex items-center gap-2.5 rounded-lg px-1.5 py-2">
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px]"
                style={{ background: "rgba(255,92,22,.15)" }}
              >
                <MeoMark size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold">{bot.name}</div>
                <div className="truncate text-[10.5px] text-muted">{bot.detail}</div>
              </div>
              <span
                className={`ml-auto flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                  bot.status === "Live"
                    ? "border-ok/30 bg-ok/10 text-ok"
                    : "border-line-2 bg-card-2 text-muted"
                }`}
              >
                {bot.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
