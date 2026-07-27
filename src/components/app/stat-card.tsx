import { ArrowDown, ArrowUp } from "lucide-react";
import { Sparkline } from "@/components/app/sparkline";
import type { Trend } from "@/lib/stats";

type StatCardProps = {
  label: string;
  value: string;
  trend: Trend | null;
  spark: number[];
};

export function StatCard({ label, value, trend, spark }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-card px-[18px] pb-3 pt-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mb-0.5 mt-1 flex items-baseline gap-2 text-2xl font-bold tracking-tight">
        {value}
        {trend && (
          <em
            className={`flex items-center gap-0.5 not-italic text-[11px] font-semibold ${
              trend.direction === "up" ? "text-ok" : "text-bad"
            }`}
          >
            {trend.direction === "up" ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
            {trend.percent}%
          </em>
        )}
      </div>
      <Sparkline values={spark} className="mt-1 h-[30px] w-full" />
    </div>
  );
}
