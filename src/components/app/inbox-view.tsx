"use client";

import { Loader2, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { linkify } from "@/components/linkify";
import { MeoMark } from "@/components/meo-mark";
import { getConversationMessages, type ConversationDetail } from "@/lib/actions/inbox";
import { timeAgo } from "@/lib/time";

export type ConversationSummary = {
  id: string;
  botName: string;
  botSlug: string;
  status: "OPEN" | "RESOLVED" | "HANDOFF";
  visitorId: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageRole: "BOT" | "USER" | "AGENT" | null;
};

type Filter = "all" | "HANDOFF" | "OPEN" | "RESOLVED";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "HANDOFF", label: "Needs a human" },
  { value: "OPEN", label: "Active" },
  { value: "RESOLVED", label: "Resolved" },
];

function StatusBadge({ status }: { status: ConversationSummary["status"] }) {
  const config = {
    OPEN: { label: "Active", className: "border-ok/30 bg-ok/10 text-ok" },
    HANDOFF: { label: "Needs a human", className: "border-orange-2/40 bg-orange/10 text-orange-2" },
    RESOLVED: { label: "Resolved", className: "border-line-2 bg-card-2 text-muted" },
  }[status];

  return (
    <span
      className={`flex-shrink-0 rounded-full border px-[11px] py-1 text-[11px] font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function InboxView({ conversations }: { conversations: ConversationSummary[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filtered = filter === "all" ? conversations : conversations.filter((c) => c.status === filter);

  async function openConversation(id: string) {
    setActiveId(id);
    setDetail(null);
    setLoadingDetail(true);
    const result = await getConversationMessages(id);
    setLoadingDetail(false);
    setDetail(result);
  }

  function close() {
    setActiveId(null);
    setDetail(null);
  }

  if (conversations.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-card p-8 text-center">
        <MeoMark size={36} />
        <h2 className="text-[15px] font-bold">No conversations yet</h2>
        <p className="max-w-[36ch] text-[13px] text-muted">
          Once a visitor chats with one of your bots, their conversation will show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            data-fx-skip
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
              filter === f.value
                ? "border-orange-2/50 bg-orange/10 text-orange-2"
                : "border-line-2 bg-card-2 text-muted hover:text-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card p-8 text-center">
          <p className="text-[13px] text-muted">No conversations match this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              data-fx-skip
              onClick={() => openConversation(conversation.id)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-3 text-left transition hover:border-orange-2/40 hover:bg-card-2"
            >
              <span
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(255,92,22,.15)" }}
              >
                <MessageCircle size={17} className="text-orange-2" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 shrink truncate text-[13.5px] font-semibold">
                    {conversation.botName}
                  </span>
                  <span className="flex-shrink-0 text-[11px] text-muted">·</span>
                  <span className="min-w-0 shrink truncate text-[11px] text-muted">
                    {conversation.visitorId}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-muted">
                  {conversation.lastMessageRole === "USER" && (
                    <span className="text-text/70">Visitor: </span>
                  )}
                  {conversation.lastMessagePreview}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <StatusBadge status={conversation.status} />
                <span className="text-[11px] text-muted">{timeAgo(conversation.lastMessageAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-[75] bg-black/50 transition-opacity duration-200 ${
          activeId ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Conversation"
        className={`fixed inset-y-0 right-0 z-[80] flex w-full max-w-[420px] flex-col border-l border-line bg-[#111] pb-[env(safe-area-inset-bottom)] shadow-[-24px_0_60px_-24px_rgba(0,0,0,.8)] transition-transform duration-300 ease-out ${
          activeId ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-[13.5px] font-semibold">{detail?.botName ?? "Conversation"}</h3>
            {detail && <p className="truncate text-[11px] text-muted">{detail.visitorId}</p>}
          </div>
          <button
            type="button"
            data-fx-skip
            onClick={close}
            aria-label="Close"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        {detail && (
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <StatusBadge status={detail.status} />
            <span className="text-[11px] text-muted">Started {timeAgo(detail.createdAt)}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {loadingDetail && (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          )}
          {!loadingDetail && detail && detail.messages.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted">No messages in this conversation.</p>
          )}
          {!loadingDetail && detail && (
            <div className="flex flex-col gap-3.5">
              {detail.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${message.role === "USER" ? "flex-row-reverse" : ""}`}
                >
                  {message.role !== "USER" && (
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-card-2">
                      {message.role === "AGENT" ? (
                        <span className="text-[9px] font-bold text-orange-2">A</span>
                      ) : (
                        <MeoMark size={14} />
                      )}
                    </span>
                  )}
                  <div
                    className={`max-w-[76%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      message.role === "USER"
                        ? "rounded-br-md bg-grad-orange text-white"
                        : "rounded-bl-md bg-card-2 text-text"
                    }`}
                  >
                    {linkify(
                      message.content,
                      "underline decoration-1 underline-offset-2 opacity-90 hover:opacity-100",
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loadingDetail && !detail && (
            <p className="py-8 text-center text-[13px] text-muted">Couldn&apos;t load this conversation.</p>
          )}
        </div>
      </aside>
    </>
  );
}
