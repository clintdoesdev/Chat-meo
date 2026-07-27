"use client";

import { Trash2 } from "lucide-react";
import { deleteBot } from "@/lib/actions/bots";

export function DeleteBotForm({ botId, botName }: { botId: string; botName: string }) {
  return (
    <form
      action={deleteBot}
      onSubmit={(event) => {
        if (!confirm(`Delete "${botName}"? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="botId" value={botId} />
      <button
        type="submit"
        aria-label={`Delete ${botName}`}
        data-fx-skip
        className="flex-shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-card-2 hover:text-bad"
      >
        <Trash2 size={15} />
      </button>
    </form>
  );
}
