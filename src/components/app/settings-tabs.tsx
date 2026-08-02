"use client";

import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

export function SettingsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="min-[760px]:grid min-[760px]:grid-cols-[190px_minmax(0,1fr)] min-[760px]:items-start min-[760px]:gap-8">
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line min-[760px]:mb-0 min-[760px]:flex-col min-[760px]:gap-0.5 min-[760px]:overflow-visible min-[760px]:border-b-0 min-[760px]:border-r min-[760px]:border-line-2 min-[760px]:pr-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-fx-skip
            onClick={() => setActive(tab.id)}
            className={`flex-shrink-0 whitespace-nowrap rounded-t-lg px-4 py-2.5 text-left text-[13px] font-semibold transition min-[760px]:rounded-lg min-[760px]:px-3.5 min-[760px]:py-2.5 ${
              active === tab.id
                ? "border-b-2 border-orange-2 text-text min-[760px]:border-b-0 min-[760px]:bg-card-2 min-[760px]:text-text"
                : "border-b-2 border-transparent text-muted hover:text-text min-[760px]:hover:bg-card-2/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-w-0">{tabs.find((tab) => tab.id === active)?.content}</div>
    </div>
  );
}
