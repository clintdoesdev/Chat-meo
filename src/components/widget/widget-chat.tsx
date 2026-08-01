"use client";

import { useEffect, useRef, useState } from "react";
import { linkify } from "@/components/linkify";

type ChatMessage = { id: string; role: "user" | "bot"; content: string };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type HistoryResponse = {
  found: boolean;
  messages: { role: "USER" | "BOT" | "AGENT"; content: string }[];
  ended: boolean;
};

type ChatResponse = { replies: { content: string }[]; status: string };

function toChatMessage(role: "USER" | "BOT" | "AGENT", content: string): ChatMessage {
  return { id: newId(), role: role === "USER" ? "user" : "bot", content };
}

/** The browser sets document.referrer to the parent page's URL when we're loaded in an
 * iframe — this is what actually tells the server which site embedded us, since our own
 * fetch() calls below are same-origin to this app regardless of who framed the iframe (see
 * resolveEmbedHostname's doc comment in src/lib/chat/origin-check.ts for the full story). */
function embedHostHeader(): Record<string, string> {
  try {
    const hostname = document.referrer ? new URL(document.referrer).hostname : "";
    return hostname ? { "X-Embed-Host": hostname } : {};
  } catch {
    return {};
  }
}

/**
 * The widget iframe's actual chat UI. Talks to the same public /api/chat (Phase 3) and
 * /api/chat/history endpoints a headless integration would use — this component is just one
 * client of them, same as the Studio Test drawer is for the session-gated test endpoint.
 */
export function WidgetChat({
  botPublicKey,
  visitorId,
  welcomeMessage,
}: {
  botPublicKey: string;
  visitorId: string;
  welcomeMessage: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [ended, setEnded] = useState(false);
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;

    (async () => {
      const leadIn: ChatMessage[] = welcomeMessage ? [toChatMessage("BOT", welcomeMessage)] : [];

      try {
        const res = await fetch(
          `/api/chat/history?botPublicKey=${encodeURIComponent(botPublicKey)}&visitorId=${encodeURIComponent(visitorId)}`,
          { headers: embedHostHeader() },
        );
        const data: HistoryResponse = await res.json();

        if (res.ok && data.found) {
          setMessages([...leadIn, ...data.messages.map((m) => toChatMessage(m.role, m.content))]);
          setEnded(data.ended);
          setReady(true);
          return;
        }
      } catch {
        // fall through to starting a fresh conversation below
      }

      setMessages(leadIn);
      setReady(true);
      await sendTurn(undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendTurn(userMessage: string | undefined) {
    setSending(true);
    if (userMessage) {
      setMessages((prev) => [...prev, { id: newId(), role: "user", content: userMessage }]);
    }

    try {
      const res = await fetch("/api/chat?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...embedHostHeader() },
        body: JSON.stringify({ botPublicKey, visitorId, message: userMessage }),
      });

      // Rejections (bot not found, origin not allowed, rate limited) are decided before the
      // route ever starts streaming, so they come back as plain JSON — only a 200 with an
      // event-stream body is the real SSE path.
      const isStream = res.headers.get("content-type")?.includes("text/event-stream");
      if (!isStream || !res.body) {
        const fallback: ChatResponse | null = await res.json().catch(() => null);
        if (fallback?.replies?.length) {
          setMessages((prev) => [...prev, ...fallback.replies.map((r) => toChatMessage("BOT", r.content))]);
          setEnded(fallback.status === "ENDED" || fallback.status === "HANDOFF");
        } else {
          setMessages((prev) => [
            ...prev,
            toChatMessage("BOT", "Sorry, something went wrong. Please try again in a moment."),
          ]);
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim());

          if (payload.type === "done") {
            const replies: { content: string }[] = payload.replies ?? [];
            setMessages((prev) => [...prev, ...replies.map((r) => toChatMessage("BOT", r.content))]);
            setEnded(payload.status === "ENDED" || payload.status === "HANDOFF");
            finished = true;
          } else if (payload.type === "error") {
            setMessages((prev) => [...prev, toChatMessage("BOT", payload.error || "Something went wrong.")]);
            finished = true;
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        toChatMessage("BOT", "Sorry, something went wrong. Please try again in a moment."),
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || ended) return;
    setInput("");
    void sendTurn(trimmed);
  }

  return (
    <>
      <div ref={listRef} className="cm-log">
        {messages.map((message) => (
          <div key={message.id} className={`cm-row ${message.role === "user" ? "cm-user" : ""}`}>
            {message.role === "bot" && (
              <span className="cm-avatar" aria-hidden="true">
                <MeoDot />
              </span>
            )}
            <div className={`cm-bubble cm-${message.role}`}>{linkify(message.content, "cm-link")}</div>
          </div>
        ))}
        {sending && (
          <div className="cm-row">
            <span className="cm-avatar" aria-hidden="true">
              <MeoDot />
            </span>
            <div className="cm-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="cm-inputbar">
        <div className="cm-inputrow">
          <input
            className="cm-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            disabled={!ready || sending || ended}
            placeholder={ended ? "Conversation ended" : "Type a message…"}
            aria-label="Message"
          />
          <button
            type="button"
            className="cm-send"
            onClick={handleSend}
            disabled={!ready || sending || ended || !input.trim()}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  );
}

function MeoDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="24" cy="30" r="4.4" fill="var(--cm-primary)" />
      <circle cx="40" cy="30" r="4.4" fill="var(--cm-primary)" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11.5L20.5 3 12 20.5l-2.2-7-6.8-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
