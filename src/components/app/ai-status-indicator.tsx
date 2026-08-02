"use client";

import { useEffect, useState } from "react";

type AiStatus = {
  provider: string;
  model: string;
  keyPresent: boolean;
  reachable: { ok: true } | { ok: false; error: string };
};

/** Small pill in the dashboard header showing which AI provider is active and whether it's
 * actually reachable right now — fetched once on mount from /api/ai/status. Fails quiet (renders
 * nothing) if the check itself can't be reached, rather than showing a broken-looking pill. */
export function AiStatusIndicator() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((res) => res.json())
      .then((data: AiStatus) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Nothing to show — status stays null and the pill just doesn't render.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  const ok = status.keyPresent && status.reachable.ok;
  const title = status.reachable.ok ? undefined : status.reachable.error;

  return (
    <div
      title={title}
      className="hidden max-w-[220px] items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-3 py-1.5 text-[11.5px] font-medium text-muted min-[900px]:flex"
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${ok ? "bg-ok" : "bg-bad"}`} />
      <span className="flex-shrink-0 text-text">{status.provider}</span>
      <span className="flex-shrink-0 text-muted/60">·</span>
      <span className="truncate font-mono text-[10.5px] text-muted">{status.model}</span>
    </div>
  );
}
