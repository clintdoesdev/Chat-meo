"use client";

import { ChevronDown, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MeoMark } from "@/components/meo-mark";
import type { EngineState } from "@/engine/types";
import type { FlowGraph } from "@/lib/flow-types";

type ChatMessage = { id: string; role: "user" | "bot"; content: string };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postTestTurn(body: {
  graph: FlowGraph;
  state?: EngineState;
  message?: string;
  sessionId: string;
}): Promise<{ replies: { content: string }[]; state: EngineState } | null> {
  const res = await fetch("/api/chat/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

export function TestDrawer({
  open,
  onClose,
  graph,
}: {
  open: boolean;
  onClose: () => void;
  graph: FlowGraph;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [engineState, setEngineState] = useState<EngineState | null>(null);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [debugOpen, setDebugOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => newId());
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function sendTurn(userMessage: string | undefined) {
    setSending(true);
    if (userMessage) {
      setMessages((prev) => [...prev, { id: newId(), role: "user", content: userMessage }]);
    }
    const result = await postTestTurn({
      graph: graphRef.current,
      state: engineState ?? undefined,
      message: userMessage,
      sessionId,
    });
    setSending(false);

    if (!result) {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "bot", content: "Something went wrong running this flow. Try again." },
      ]);
      return;
    }

    setEngineState(result.state);
    if (result.replies.length > 0) {
      setMessages((prev) => [
        ...prev,
        ...result.replies.map((reply) => ({ id: newId(), role: "bot" as const, content: reply.content })),
      ]);
    } else if (result.state.status === "ENDED" && messages.length === 0 && !userMessage) {
      setMessages([
        { id: newId(), role: "bot", content: "This flow doesn't produce any replies yet — add nodes after Start to test it." },
      ]);
    }
  }

  useEffect(() => {
    if (open && messages.length === 0 && !engineState && !sending) {
      void sendTurn(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  function handleRestart() {
    setMessages([]);
    setEngineState(null);
    setInput("");
    setSessionId(newId());
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || ended) return;
    setInput("");
    void sendTurn(trimmed);
  }

  const ended = engineState?.status === "ENDED" || engineState?.status === "HANDOFF";

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[75] bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Test bot"
        className={`fixed inset-y-0 right-0 z-[80] flex w-full max-w-[380px] flex-col border-l border-line bg-[#111] pb-[env(safe-area-inset-bottom)] shadow-[-24px_0_60px_-24px_rgba(0,0,0,.8)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <MeoMark size={22} />
            <h3 className="text-[13.5px] font-semibold">Test bot</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRestart}
              aria-label="Restart"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-2.5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  message.role === "user"
                    ? "self-end rounded-br-md bg-grad-orange text-white"
                    : "self-start rounded-bl-md bg-card-2 text-text"
                }`}
              >
                {message.content}
              </div>
            ))}
            {sending && (
              <div className="flex max-w-[82%] items-center gap-1 self-start rounded-2xl rounded-bl-md bg-card-2 px-3.5 py-3">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2 text-[13px] text-muted transition hover:text-text"
          >
            <span>Debug</span>
            <ChevronDown size={14} className={`transition-transform ${debugOpen ? "rotate-180" : ""}`} />
          </button>
          {debugOpen && (
            <div className="space-y-1 px-4 pb-3 text-[13px] text-muted">
              <p className="truncate">
                Node: <span className="text-text/80">{engineState?.currentNodeId ?? "—"}</span>
              </p>
              <p className="truncate">
                Status: <span className="text-text/80">{engineState?.status ?? "—"}</span>
              </p>
              <p className="break-words">
                Variables:{" "}
                <span className="text-text/80">
                  {engineState && Object.keys(engineState.variables).length > 0
                    ? JSON.stringify(engineState.variables)
                    : "{}"}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSend();
              }}
              disabled={sending || ended}
              placeholder={ended ? "Conversation ended — tap Restart" : "Type a message…"}
              className="w-full bg-transparent text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || ended || !input.trim()}
              aria-label="Send"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-grad-orange text-white transition disabled:opacity-40"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
