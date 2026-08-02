import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/app/sparkline";
import type { Trend } from "@/lib/stats";

type StatCardProps = {
  label: string;
  value: string;
  trend: Trend | null;
  spark: number[];
  compact?: boolean;
  caption?: string;
  icon?: LucideIcon;
};

export function StatCard({ label, value, trend, spark, compact = false, caption, icon: Icon }: StatCardProps) {
  return (
    <div
      className={`min-w-0 rounded-[18px] border border-line bg-card transition hover:border-orange-2/30 ${compact ? "p-3.5" : "p-5"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs leading-snug text-muted">{label}</div>
        {Icon && (
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
            <Icon size={13} />
          </span>
        )}
      </div>
      <div
        className={`mb-1.5 mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-bold tracking-tight ${
          compact ? "text-lg" : "text-2xl"
        }`}
      >
        <span className="whitespace-nowrap">{value}</span>
        {trend && (
          <em
            className={`flex shrink-0 items-center gap-0.5 whitespace-nowrap not-italic text-[11px] font-semibold ${
              trend.direction === "up" ? "text-ok" : "text-bad"
            }`}
          >
            {trend.direction === "up" ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
            {trend.percent}%
          </em>
        )}
      </div>
      <Sparkline values={spark} className="mt-3 h-[30px] w-full" />
      {caption && <div className="mt-2 text-[11px] text-muted">{caption}</div>}
    </div>
  );
}
