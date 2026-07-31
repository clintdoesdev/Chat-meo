import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export function PillSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none rounded-full border border-line-2 bg-card-2 py-2 pl-4 pr-9 text-[12.5px] font-semibold text-text transition focus:border-orange-2/60 focus:outline-none ${className ?? ""}`}
      />
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
