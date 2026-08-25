"use client";

import { ChevronLeft, Terminal } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatedSpinnerIcon, CanvasPlayIcon, CanvasSaveIcon, CommsSendIcon } from "@/components/icons";
import { MeoMark } from "@/components/meo-mark";
import {
  getPythonBotConfig,
  savePythonBotCode,
  setPythonBotEnabled,
  testPythonBotCode,
  type TestPythonBotResult,
} from "@/lib/actions/python-bot";
import type { PythonBotMessage } from "@/lib/python-bot/types";

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PythonBotEditor({ botId, botName, botSlug }: { botId: string; botName: string; botSlug: string }) {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [sandboxConfigured, setSandboxConfigured] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [enablePending, setEnablePending] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

  const [testMessage, setTestMessage] = useState("");
  const [testTranscript, setTestTranscript] = useState<PythonBotMessage[]>([]);
  const [testState, setTestState] = useState<Record<string, unknown>>({});
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestPythonBotResult | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPythonBotConfig(botId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setLoadStatus("error");
        setLoadError(result.error);
        return;
      }
      setCode(result.code);
      setSavedCode(result.code);
      setEnabled(result.enabled);
      setSandboxConfigured(result.sandboxConfigured);
      setLastError(result.lastError);
      setLastRunAt(result.lastRunAt);
      setLoadStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [testTranscript, testResult]);

  const dirty = code !== savedCode;

  async function handleSave() {
    setSaveStatus("saving");
    const result = await savePythonBotCode(botId, code);
    if (result.error) {
      setSaveStatus("error");
      return;
    }
    setSavedCode(code);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus((current) => (current === "saved" ? "idle" : current)), 2000);
  }

  async function handleToggleEnabled() {
    setEnablePending(true);
    setEnableError(null);
    const next = !enabled;
    const result = await setPythonBotEnabled(botId, next);
    if (result.error) {
      setEnableError(result.error);
    } else {
      setEnabled(next);
    }
    setEnablePending(false);
  }

  async function handleRunTest() {
    if (!testMessage.trim() || testRunning) return;
    const message = testMessage;
    setTestMessage("");
    setTestRunning(true);
    const result = await testPythonBotCode(botId, code, message, testTranscript, testState);
    setTestRunning(false);

    if ("error" in result) {
      setTestResult({ kind: "error", message: result.error, stdout: "", stderr: "" });
      return;
    }
    setTestResult(result);
    if (result.kind === "success") {
      setTestState(result.state);
      const assistantContent = result.replies.length > 0 ? result.replies.join("\n\n") : "(no reply)";
      setTestTranscript((prev) => [
        ...prev,
        { role: "user", content: message },
        { role: "assistant", content: assistantContent },
      ]);
    }
  }

  function handleResetTest() {
    setTestTranscript([]);
    setTestState({});
    setTestResult(null);
  }

  if (loadStatus === "loading") {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted">
        <AnimatedSpinnerIcon size={24} />
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <MeoMark size={40} />
        <h1 className="text-lg font-bold">Couldn&apos;t load Python Bot</h1>
        <p className="max-w-[36ch] text-sm text-muted">{loadError}</p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-4 flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/app/studio/${botSlug}`}
            aria-label="Back to Studio"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line-2 text-muted transition hover:border-orange-2/50 hover:text-text"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </Link>
          <MeoMark size={28} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight">{botName} · Python Bot</h1>
            <div className="text-[11.5px] font-medium text-muted">
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Couldn't save — try again"}
              {saveStatus === "idle" && (dirty ? "Unsaved changes" : "All changes saved")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-[860px]:ml-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saveStatus === "saving"}
            className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[13px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
          >
            <CanvasSaveIcon size={13} />
            Save
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Python Bot bypass mode"
            onClick={handleToggleEnabled}
            disabled={enablePending || (!enabled && !sandboxConfigured)}
            title={!sandboxConfigured ? "Not configured on this deployment (missing E2B_API_KEY)" : undefined}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${
              enabled
                ? "bg-grad-orange text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)]"
                : "border border-line-2 bg-card-2 text-muted hover:text-text"
            }`}
          >
            {enabled ? "Bypass mode: ON" : "Bypass mode: OFF"}
          </button>
        </div>
      </header>

      {!sandboxConfigured && (
        <p className="mb-4 rounded-lg border border-line-2 bg-card-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
          This deployment hasn&apos;t configured Python Bot execution yet (E2B_API_KEY isn&apos;t
          set), so it can&apos;t be turned on. You can still write and test code below once
          it&apos;s configured.
        </p>
      )}
      {enableError && (
        <p className="mb-4 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[11.5px] text-bad">{enableError}</p>
      )}
      {enabled && (
        <p className="mb-4 rounded-lg border border-orange-2/30 bg-orange/10 px-3 py-2 text-[11.5px] leading-relaxed text-text">
          Every incoming message (widget and WhatsApp) is now handed straight to this script —
          the Flow Studio graph is skipped entirely for this bot.
        </p>
      )}
      {lastError && (
        <p className="mb-4 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[11.5px] leading-relaxed text-bad">
          Last live run failed{lastRunAt ? ` (${new Date(lastRunAt).toLocaleString()})` : ""}: {lastError}
        </p>
      )}

      <div className="mb-4 rounded-lg border border-line-2 bg-card-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
        Runs once per incoming message, in an isolated sandbox. Read{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">chatmeo_input</code> (a dict with{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">message</code>,{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">history</code>, and{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">state</code>), then set{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">chatmeo_reply</code> (or{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">chatmeo_replies</code> for more than
        one message) before the script ends. Optionally set{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">chatmeo_state</code> (persisted and
        handed back next turn) or <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">chatmeo_handoff = True</code>{" "}
        to escalate to a human instead of replying.
      </div>

      <div className="flex h-[calc(100vh-320px)] min-h-[480px] flex-col gap-4 min-[1020px]:flex-row">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-line-2 bg-[#0C0C0C]">
          <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2 text-[11.5px] font-semibold text-muted">
            <Terminal size={13} />
            bot.py
          </div>
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            className="min-h-[240px] flex-1 resize-none bg-transparent p-4 font-mono text-[12.5px] leading-relaxed text-text outline-none"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-line-2 min-[1020px]:max-w-[420px]">
          <div className="flex items-center justify-between border-b border-line-2 bg-card-2 px-3 py-2">
            <div className="flex items-center gap-2 text-[11.5px] font-semibold text-muted">
              <CanvasPlayIcon size={12} />
              Test
            </div>
            <button
              type="button"
              onClick={handleResetTest}
              className="text-[11px] font-semibold text-muted transition hover:text-text"
            >
              Reset
            </button>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3">
            {testTranscript.length === 0 && !testResult && (
              <p className="text-[12px] text-muted">Send a message below to try this script.</p>
            )}
            <div className="flex flex-col gap-2">
              {testTranscript.map((entry, index) => (
                <div
                  key={index}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                    entry.role === "user"
                      ? "self-end bg-grad-orange text-white"
                      : "self-start border border-line-2 bg-card-2 text-text"
                  }`}
                >
                  {entry.content}
                </div>
              ))}
            </div>

            {testResult?.kind === "error" && (
              <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] text-bad">
                {testResult.message}
              </div>
            )}
            {testResult?.kind === "success" && testResult.handoff && (
              <div className="mt-2 rounded-xl border border-orange-2/30 bg-orange/10 px-3 py-2 text-[11.5px] text-text">
                This turn set chatmeo_handoff — a real conversation would be handed off to a human here.
              </div>
            )}
            {testResult && (testResult.stdout || testResult.stderr) && (
              <details className="mt-2 rounded-xl border border-line-2 bg-card-2 px-3 py-2 text-[11px] text-muted">
                <summary className="cursor-pointer select-none font-semibold">stdout / stderr</summary>
                {testResult.stdout && (
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">{testResult.stdout}</pre>
                )}
                {testResult.stderr && (
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-bad">{testResult.stderr}</pre>
                )}
              </details>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleRunTest();
            }}
            className="flex items-center gap-2 border-t border-line-2 p-3"
          >
            <input
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              placeholder="Type a message…"
              disabled={testRunning}
              className="flex-1 rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] text-text outline-none focus:border-orange-2/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={testRunning || !testMessage.trim()}
              aria-label="Send test message"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-grad-orange text-white disabled:opacity-50"
            >
              {testRunning ? <AnimatedSpinnerIcon size={16} /> : <CommsSendIcon size={14} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
