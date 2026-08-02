"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionsSearchIcon } from "@/components/icons";
import type { ProviderId } from "@/lib/ai/providers";

const PANEL_WIDTH = 280;
const PANEL_MAX_HEIGHT = 280;
const VIEWPORT_MARGIN = 12;

type ModelOption = { id: string; label?: string };

// One cache per provider, shared across every ModelPicker instance on the page (there can be
// several AI nodes open across a session) — avoids re-fetching the same provider's catalog
// every time a node inspector opens.
const modelsCache = new Map<ProviderId, ModelOption[]>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Real-time, searchable model combobox for the AI node's Model setting — replaces a native
 * <select>/<datalist> (see the standing "no native popups" rule) with a from-scratch portal
 * panel, following the same fixed-position + click-outside pattern as ColorPicker and
 * NodeInfoButton. Fetches the live model catalog for the given provider from
 * /api/ai/models?provider=... on first open, rather than a hardcoded preset list, since which
 * models are actually available depends on the provider's own real-time catalog.
 */
export function ModelPicker({
  id,
  provider,
  value,
  onChange,
}: {
  id?: string;
  provider: ProviderId;
  value: string;
  onChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<ModelOption[]>(() => modelsCache.get(provider) ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const cached = modelsCache.get(provider);
    if (cached) {
      setModels(cached);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    fetch(`/api/ai/models?provider=${provider}`)
      .then(async (response) => {
        const json: { models?: ModelOption[]; error?: string } = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setStatus("error");
          setError(json.error ?? "Failed to load models.");
          return;
        }
        const list = json.models ?? [];
        modelsCache.set(provider, list);
        setModels(list);
        setStatus("idle");
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load models.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, provider]);

  function openPicker() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = clamp(rect.left, VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
      const top = Math.min(rect.bottom + 6, window.innerHeight - PANEL_MAX_HEIGHT - VIEWPORT_MARGIN);
      setCoords({ top, left });
    }
    setQuery("");
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function commit(modelId: string) {
    onChange(modelId);
    setOpen(false);
  }

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? models.filter(
        (model) =>
          model.id.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
          model.label?.toLowerCase().includes(trimmedQuery.toLowerCase()),
      )
    : models;
  const exactMatch = models.some((model) => model.id === trimmedQuery);

  return (
    <div className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        data-fx-skip
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="flex w-full items-center justify-between gap-2 rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5 text-left text-[12px] text-text transition focus:border-orange-2/60 focus:outline-none"
      >
        <span className="truncate font-mono">{value || "Select a model…"}</span>
        <ActionsSearchIcon size={13} className="flex-shrink-0 text-muted" />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-line-2 bg-[#1c1c1c] shadow-[0_30px_60px_-16px_rgba(0,0,0,.9)]"
          >
            <div className="border-b border-line-2 p-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models…"
                spellCheck={false}
                className="w-full rounded-[10px] border border-line-2 bg-card-2 px-2.5 py-2 font-mono text-[12px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
              />
            </div>
            <div className="max-h-[210px] overflow-y-auto p-1.5">
              {status === "loading" && (
                <p className="px-2.5 py-2 text-[11.5px] text-muted">Loading models…</p>
              )}
              {status === "error" && (
                <p className="px-2.5 py-2 text-[11.5px] text-bad">{error}</p>
              )}
              {status !== "loading" &&
                filtered.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => commit(model.id)}
                    className={`block w-full truncate rounded-[10px] px-2.5 py-2 text-left text-[12px] transition ${
                      model.id === value
                        ? "bg-orange/10 text-text"
                        : "text-muted hover:bg-white/[.06] hover:text-text"
                    }`}
                  >
                    <span className="font-mono">{model.id}</span>
                    {model.label && <span className="ml-1.5 text-[11px] text-muted">{model.label}</span>}
                  </button>
                ))}
              {status !== "loading" && trimmedQuery && !exactMatch && (
                <button
                  type="button"
                  onClick={() => commit(trimmedQuery)}
                  className="block w-full truncate rounded-[10px] px-2.5 py-2 text-left text-[12px] text-muted transition hover:bg-white/[.06] hover:text-text"
                >
                  Use &ldquo;<span className="font-mono">{trimmedQuery}</span>&rdquo;
                </button>
              )}
              {status === "idle" && !trimmedQuery && filtered.length === 0 && (
                <p className="px-2.5 py-2 text-[11.5px] text-muted">No models found.</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
