"use client";

import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

export function SettingsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-line">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-fx-skip
            onClick={() => setActive(tab.id)}
            className={`rounded-t-lg px-4 py-2.5 text-[13px] font-semibold transition ${
              active === tab.id
                ? "border-b-2 border-orange-2 text-text"
                : "border-b-2 border-transparent text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.id === active)?.content}
    </div>
  );
}
