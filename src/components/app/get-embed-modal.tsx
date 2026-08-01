"use client";

import { Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Toast } from "@/components/studio/toast";
import {
  addAllowedDomain,
  getEmbedConfig,
  removeAllowedDomain,
  updateWidgetSettings,
  type EmbedConfig,
} from "@/lib/actions/embed";
import { buildEmbedSnippet, type WidgetPosition } from "@/lib/embed-snippet";

const SAVE_DEBOUNCE_MS = 700;

export function GetEmbedModal({
  botId,
  botName,
  onClose,
}: {
  botId: string;
  botName: string;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [colorInput, setColorInput] = useState("#FF5C16");
  const [messageInput, setMessageInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getEmbedConfig(botId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setLoadError(result.error);
        return;
      }
      setConfig(result);
      setColorInput(result.primaryColor);
      setMessageInput(result.welcomeMessage ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  function scheduleSave(patch: Parameters<typeof updateWidgetSettings>[1]) {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const result = await updateWidgetSettings(botId, patch);
      if (!result.error) {
        // Keep the embed snippet (and anything else reading `config`) in sync with what was
        // just saved — otherwise it'd keep showing the pre-edit value until the modal is
        // closed and reopened.
        setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
        setPreviewNonce((n) => n + 1);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  async function handleAddDomain() {
    setDomainError(null);
    const result = await addAllowedDomain(botId, domainInput);
    if (result.error) {
      setDomainError(result.error);
      return;
    }
    setDomainInput("");
    setConfig((prev) =>
      prev ? { ...prev, allowedDomains: [...prev.allowedDomains, domainInput.trim().toLowerCase()], testMode: false } : prev,
    );
  }

  async function handleRemoveDomain(domain: string) {
    await removeAllowedDomain(botId, domain);
    setConfig((prev) =>
      prev ? { ...prev, allowedDomains: prev.allowedDomains.filter((d) => d !== domain) } : prev,
    );
  }

  function handleCopy(snippet: string) {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const snippet =
    config &&
    buildEmbedSnippet({
      origin,
      publicKey: config.publicKey,
      primaryColor: config.primaryColor,
      widgetPosition: config.widgetPosition,
    });

  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-[95] bg-black/60" />
      <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Get embed code for ${botName}`}
          className="flex max-h-[88vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-line bg-[#111] shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-[14.5px] font-semibold">Get embed — {botName}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
            >
              <X size={16} />
            </button>
          </div>

          {loadError && <p className="p-5 text-[13px] text-bad">{loadError}</p>}

          {config && (
            <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto min-[720px]:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col gap-5 p-5">
                {config.allowedDomains.length === 0 && !config.testMode && (
                  <div className="rounded-xl border border-bad/30 bg-bad/10 p-3.5 text-[12.5px] text-bad">
                    This bot won&apos;t respond to any embedded widget until you add a domain — no
                    domains are configured and test mode is off.
                  </div>
                )}
                {config.allowedDomains.length === 0 && config.testMode && (
                  <div className="rounded-xl border border-orange-2/30 bg-orange-2/10 p-3.5 text-[12.5px] text-orange-2">
                    Add your domain before going live — until then this bot only responds in test
                    mode (dashboard preview, test-embed.html, or your own local testing).
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted">Embed this script</label>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 overflow-x-auto whitespace-pre rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-text/90">
                      {snippet}
                    </code>
                    <button
                      type="button"
                      onClick={() => snippet && handleCopy(snippet)}
                      aria-label="Copy embed script"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line-2 bg-card-2 text-muted transition hover:border-orange-2/50 hover:text-text"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    Paste this before <code>&lt;/body&gt;</code> on any page you want the chat
                    bubble to appear on.
                  </p>
                </div>

                <div>
                  <label htmlFor="embed-color" className={labelClass()}>
                    Primary color
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="embed-color"
                      type="color"
                      value={colorInput}
                      onChange={(event) => {
                        setColorInput(event.target.value);
                        scheduleSave({ primaryColor: event.target.value });
                      }}
                      className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-line-2 bg-transparent p-0.5"
                    />
                    <input
                      value={colorInput}
                      onChange={(event) => {
                        setColorInput(event.target.value);
                        if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) {
                          scheduleSave({ primaryColor: event.target.value });
                        }
                      }}
                      className="w-28 rounded-[13px] border border-line-2 bg-card-2 px-3 py-2 font-mono text-[12.5px] text-text focus:border-orange-2/60 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="embed-welcome" className={labelClass()}>
                    Welcome message override
                  </label>
                  <textarea
                    id="embed-welcome"
                    value={messageInput}
                    onChange={(event) => {
                      setMessageInput(event.target.value);
                      scheduleSave({ welcomeMessage: event.target.value });
                    }}
                    rows={2}
                    placeholder="Leave blank to use your flow's own opening message"
                    className="w-full resize-y rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass()}>Launcher position</label>
                  <div className="inline-flex rounded-full border border-line-2 bg-card-2 p-1">
                    {(["BOTTOM_LEFT", "BOTTOM_RIGHT"] as WidgetPosition[]).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => {
                          setConfig((prev) => (prev ? { ...prev, widgetPosition: pos } : prev));
                          scheduleSave({ widgetPosition: pos });
                        }}
                        className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                          config.widgetPosition === pos ? "bg-grad-orange text-white" : "text-muted"
                        }`}
                      >
                        {pos === "BOTTOM_LEFT" ? "Bottom left" : "Bottom right"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass()}>Allowed domains</label>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {config.allowedDomains.map((domain) => (
                      <span
                        key={domain}
                        className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 py-1 pl-3 pr-1.5 text-[11.5px] text-text"
                      >
                        {domain}
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(domain)}
                          aria-label={`Remove ${domain}`}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:text-bad"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {config.allowedDomains.length === 0 && (
                      <span className="text-[11.5px] text-muted">None yet.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={domainInput}
                      onChange={(event) => setDomainInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddDomain();
                        }
                      }}
                      placeholder="example.com"
                      className="flex-1 rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddDomain}
                      className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12px] font-semibold text-text transition hover:border-orange-2/50"
                    >
                      Add
                    </button>
                  </div>
                  {domainError && <p className="mt-1.5 text-[11.5px] text-bad">{domainError}</p>}
                </div>
              </div>

              <div className="border-t border-line bg-[#0c0c0c] p-4 min-[720px]:border-l min-[720px]:border-t-0">
                <p className="mb-2.5 text-xs font-semibold text-muted">Live preview</p>
                <div className="overflow-hidden rounded-2xl border border-line-2" style={{ height: 520 }}>
                  <iframe
                    key={previewNonce}
                    title="Widget preview"
                    src={`/widget/${config.publicKey}?v=preview-${botId}&_=${previewNonce}`}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {copied && <Toast message="Copied to clipboard" />}
    </>
  );
}

function labelClass() {
  return "mb-1.5 block text-xs font-semibold text-muted";
}
