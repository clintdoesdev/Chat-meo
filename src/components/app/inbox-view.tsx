"use client";

import {
  ActionsArchiveIcon,
  ActionsBlockIcon,
  ActionsCheckIcon,
  ActionsCloseIcon,
  ActionsDownloadIcon,
  ActionsDuplicateIcon,
  ActionsFolderIcon,
  ActionsMoreIcon,
  ActionsPlusIcon,
  ActionsRestartIcon,
  ActionsSearchIcon,
  ActionsStarIcon,
  ActionsTrashIcon,
  ActionsUndoIcon,
  AnimatedSpinnerIcon,
  ChannelsWhatsappIcon,
  ChannelsWidgetIcon,
  CommsSendIcon,
  CommsUserIcon,
  StatusWarningIcon,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { formatMessage } from "@/components/format-message";
import { MeoMark } from "@/components/meo-mark";
import {
  assignConversationToFolder,
  createFolder,
  deleteConversation,
  deleteConversations,
  deleteFolder,
  deleteMessage,
  exportConversationsAsText,
  forwardMessage,
  getConversationMessages,
  listConversations,
  resolveConversation,
  restartBotForConversation,
  sendAgentReply,
  setConversationArchived,
  setConversationBlocked,
  setMessageReaction,
  toggleMessageStar,
  type ConversationDetail,
  type ConversationSummary,
  type FolderSummary,
} from "@/lib/actions/inbox";
import { getLinkPreview, type LinkPreviewData } from "@/lib/actions/link-preview";
import { timeAgo } from "@/lib/time";

// WhatsApp's own quick-reaction set — matches what its picker offers, so the seller's reaction
// options look native rather than invented.
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const FIRST_URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const TRAILING_URL_PUNCTUATION = /[.,!?;:'")\]]+$/;

/** The first http(s) URL in a plain-text message, if any — trimmed of trailing punctuation a
 * sentence would naturally end the URL with (a period, a closing paren, ...) so that doesn't get
 * fetched as part of the address. Used to decide whether to show a link preview card. */
function extractFirstUrl(text: string): string | null {
  const match = FIRST_URL_PATTERN.exec(text);
  return match ? match[0].replace(TRAILING_URL_PUNCTUATION, "") : null;
}

type DetailMessage = ConversationDetail["messages"][number];

export type { ConversationSummary };

// How often the conversation list and an open conversation's transcript re-fetch from the
// server, so an incoming message shows up without the seller having to reload — plain polling
// rather than a websocket/SSE channel, consistent with the rest of this app's beta-scale "keep
// it simple" approach (see run-whatsapp-turn.ts's own no-queue reasoning). Skipped while the tab
// is hidden (see the `document.hidden` checks below) so a backgrounded Inbox tab doesn't spend a
// request every few seconds for nothing.
const LIST_POLL_MS = 6000;
const DETAIL_POLL_MS = 3000;
const BASE_TITLE = "Inbox — Chatmeo";
// Scroll container is considered "at the bottom" within this many px — new messages keep
// auto-scrolling if the seller is basically already there, but not if they've scrolled up to
// read history (matches how every mainstream messaging app behaves).
const NEAR_BOTTOM_PX = 80;
// How far (px) a touch-swipe on a message has to travel before releasing it counts as "reply to
// this", rather than snapping back — matches WhatsApp's own swipe-to-reply gesture. Capped at
// SWIPE_MAX_PX so the row can't be dragged further than the reply icon needs to fully reveal.
const SWIPE_REPLY_THRESHOLD_PX = 44;
const SWIPE_MAX_PX = 64;

function dayDividerLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

// Short, sender-labeled preview of a quoted message — used both for the compose box's "replying
// to" bar and the inline quote rendered inside a reply bubble. Mirrors ConversationSummary's own
// image-preview convention (📷 Photo) rather than showing a raw data: URI.
function quotePreviewText(message: { role: "BOT" | "USER" | "AGENT"; content: string; contentType: "TEXT" | "IMAGE"; caption: string | null }): string {
  if (message.contentType === "IMAGE") return message.caption ? `📷 ${message.caption}` : "📷 Photo";
  return message.content;
}

function quotePreviewLabel(role: "BOT" | "USER" | "AGENT", visitorId: string): string {
  if (role === "USER") return visitorId;
  if (role === "AGENT") return "You";
  return "Bot";
}

type RenderItem = { kind: "divider"; key: string; label: string } | { kind: "message"; message: DetailMessage };

// Groups a flat message list into day-divider + message render items — a fresh list every call
// rather than memoized, matching this file's existing "just recompute it" style for derived view
// state (see `filtered` in InboxView below).
function buildRenderItems(messages: DetailMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let lastDay: string | null = null;
  for (const message of messages) {
    const day = new Date(message.createdAt).toDateString();
    if (day !== lastDay) {
      items.push({ kind: "divider", key: `divider-${message.id}`, label: dayDividerLabel(message.createdAt) });
      lastDay = day;
    }
    items.push({ kind: "message", message });
  }
  return items;
}

// Triggers a browser download of `text` as a local file — no server round trip beyond the
// exportConversationsAsText call that already produced it. The object URL is revoked right after
// the click since the browser has already grabbed what it needs by then.
function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// "all" | "HANDOFF" | "OPEN" | "RESOLVED" | "ARCHIVED" | `folder:${id}` — kept as plain string
// rather than a template-literal union since it's compared, never pattern-matched.
type Filter = string;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "HANDOFF", label: "Needs a human" },
  { value: "OPEN", label: "Active" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ARCHIVED", label: "Archived" },
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

// Distinguishes a live WhatsApp conversation from a widget "web preview" one — both land in the
// same Inbox, so without this the visitorId alone (a phone number vs. a "preview-…" test id) was
// the only tell, easy to miss at a glance.
function ChannelBadge({ channel }: { channel: ConversationSummary["channel"] }) {
  const isWhatsApp = channel === "WHATSAPP";
  return (
    <span
      className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10.5px] font-semibold ${
        isWhatsApp ? "border-ok/30 bg-ok/10 text-ok" : "border-line-2 bg-card-2 text-muted"
      }`}
    >
      {isWhatsApp ? <ChannelsWhatsappIcon size={10} /> : <ChannelsWidgetIcon size={10} />}
      {isWhatsApp ? "WhatsApp" : "Web preview"}
    </span>
  );
}

export function InboxView({
  conversations: initialConversations,
  folders: initialFolders,
}: {
  conversations: ConversationSummary[];
  folders: FolderSummary[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [folders, setFolders] = useState(initialFolders);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  // Set right before opening the "new folder" modal — null means it was opened from the general
  // folder-management chip row, an id means it was opened from a specific conversation's "Move
  // to folder" menu, so the new folder gets assigned to that conversation immediately on create.
  const [newFolderTarget, setNewFolderTarget] = useState<string | null | "closed">("closed");
  const [creatingFolder, setCreatingFolder] = useState(false);
  // Session-only "have I looked at this conversation's latest message" tracking, keyed by
  // conversation id → the lastMessageAt it had the moment it was last opened. Not persisted (no
  // schema for it) — resets on reload, which is an acceptable trade for something this cheap.
  const [lastSeenAt, setLastSeenAt] = useState<Record<string, string>>({});
  // The message currently being swiped/hover-replied-to, quoted above the compose box until sent
  // or cancelled. A lightweight snapshot rather than a live message reference, since the original
  // could scroll out, get starred/deleted, etc. while this is pending.
  const [replyingTo, setReplyingTo] = useState<DetailMessage | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);
  const [starringId, setStarringId] = useState<string | null>(null);
  const [messagePendingDeleteId, setMessagePendingDeleteId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  // Briefly highlighted after jumping to a message (clicking a quote, or an in-chat search
  // match) so the seller's eye actually catches which one it landed on.
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  // In-progress touch swipe on one message row — dx is the live horizontal drag offset in px.
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [forwardPending, setForwardPending] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingConversationId, setExportingConversationId] = useState<string | null>(null);

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const sendingReplyRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = conversations
    .filter((c) => {
      if (filter === "ARCHIVED") return c.archived;
      if (filter.startsWith("folder:")) return !c.archived && c.folderId === filter.slice("folder:".length);
      if (c.archived) return false;
      return filter === "all" || c.status === filter;
    })
    .filter((c) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        c.visitorId.toLowerCase().includes(query) ||
        c.botName.toLowerCase().includes(query) ||
        c.lastMessagePreview.toLowerCase().includes(query)
      );
    });

  function isUnread(c: ConversationSummary): boolean {
    if (c.lastMessageRole !== "USER") return false;
    const seenAt = lastSeenAt[c.id];
    return !seenAt || c.lastMessageAt > seenAt;
  }

  // Backgrounded-tab affordance, same idea as an unread email count in a browser tab — only
  // counts what's actually visible under the current filter/search so it matches what a click on
  // the tab would show, not every unread conversation buried behind a different filter.
  useEffect(() => {
    const unreadCount = filtered.filter(isUnread).length;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `filtered` is a fresh array every render; its length/roles are what actually matter here, not identity
  }, [conversations, lastSeenAt, filter, search]);

  // List refresh — catches a new conversation, or an existing one's new message, without a
  // manual reload. Skipped while a conversation is open (its own faster poll below covers that
  // row's own change) only in the sense that both run; this one still needs to run regardless so
  // *other* rows update too.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      const result = await listConversations();
      setConversations(result);
    }, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Open-conversation transcript refresh — this is the one that actually shows an incoming
  // message live while the seller is looking at that conversation. Paused mid-send (see
  // sendingReplyRef) so a poll can't land between the optimistic append in handleSendReply and
  // that call's own response and make the just-sent message flicker away and back.
  useEffect(() => {
    if (!activeId) return;
    const interval = setInterval(async () => {
      if (document.hidden || sendingReplyRef.current) return;
      const result = await getConversationMessages(activeId);
      if (!result || activeIdRef.current !== activeId) return;
      setDetail((prev) =>
        prev && prev.messages.length === result.messages.length && prev.status === result.status ? prev : result,
      );
    }, DETAIL_POLL_MS);
    return () => clearInterval(interval);
  }, [activeId]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  // Auto-scroll to the newest message — always on first opening a conversation (nearBottomRef
  // starts true), otherwise only if the seller was already near the bottom, so a poll-driven
  // update never yanks them away from history they scrolled up to read.
  useEffect(() => {
    if (!detail) return;
    const el = scrollRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on message *count*, not `detail` itself, so an in-place status/folder patch doesn't re-trigger a scroll
  }, [detail?.messages.length, activeId]);

  // Escape closes the conversation panel, same as clicking the backdrop — a small but
  // near-universal messaging-app convention.
  useEffect(() => {
    if (!activeId) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeId]);

  function patchConversation(id: string, patch: Partial<ConversationSummary>) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setDetail(null);
    setReplyText("");
    setReplyError(null);
    setReplyingTo(null);
    setStarredOnly(false);
    setSearchOpen(false);
    setMessageQuery("");
    nearBottomRef.current = true;
    setLoadingDetail(true);
    const result = await getConversationMessages(id);
    setLoadingDetail(false);
    setDetail(result);
    const summary = conversations.find((c) => c.id === id);
    if (summary) setLastSeenAt((prev) => ({ ...prev, [id]: summary.lastMessageAt }));
  }

  function close() {
    setActiveId(null);
    setDetail(null);
    setReplyingTo(null);
  }

  function jumpToMessage(id: string) {
    const el = messageRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedMessageId(id);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 1400);
  }

  async function handleToggleStar(message: DetailMessage) {
    const next = !message.starred;
    setStarringId(message.id);
    setDetail((prev) =>
      prev ? { ...prev, messages: prev.messages.map((m) => (m.id === message.id ? { ...m, starred: next } : m)) } : prev,
    );
    const result = await toggleMessageStar(message.id, next);
    setStarringId(null);
    if (result.error) {
      // Roll back — a failed toggle shouldn't silently leave the UI showing the wrong state.
      setDetail((prev) =>
        prev ? { ...prev, messages: prev.messages.map((m) => (m.id === message.id ? { ...m, starred: !next } : m)) } : prev,
      );
      setReplyError(result.error);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    setDeletingMessageId(messageId);
    const result = await deleteMessage(messageId);
    setDeletingMessageId(null);
    setMessagePendingDeleteId(null);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            messages: prev.messages
              .filter((m) => m.id !== messageId)
              // A message that quoted the one just deleted loses its quote (matches the FK's
              // SetNull) rather than pointing at nothing.
              .map((m) => (m.replyToId === messageId ? { ...m, replyToId: null, replyTo: null } : m)),
          }
        : prev,
    );
    if (replyingTo?.id === messageId) setReplyingTo(null);
  }

  async function handleCopyMessage(message: DetailMessage) {
    const text = message.contentType === "IMAGE" ? (message.caption ?? "") : message.content;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) — nothing useful to do
      // beyond not crashing; the seller can still select-and-copy manually.
    }
  }

  // Touch-only (see the pointerType guard in the row's handlers below) swipe-to-reply — desktop
  // gets the hover action row instead, matching how WhatsApp Web itself splits the two.
  function handleSwipeMove(message: DetailMessage, clientX: number) {
    if (swipeStartRef.current?.id !== message.id) return;
    const dx = Math.max(0, Math.min(SWIPE_MAX_PX, clientX - swipeStartRef.current.x));
    setSwipe({ id: message.id, dx });
  }

  function handleSwipeEnd(message: DetailMessage) {
    if (swipeStartRef.current?.id !== message.id) return;
    swipeStartRef.current = null;
    if (swipe && swipe.id === message.id && swipe.dx >= SWIPE_REPLY_THRESHOLD_PX) {
      setReplyingTo(message);
    }
    setSwipe(null);
  }

  function searchMatchesFor(query: string): DetailMessage[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || !detail) return [];
    return detail.messages.filter((m) =>
      (m.contentType === "IMAGE" ? (m.caption ?? "") : m.content).toLowerCase().includes(trimmed),
    );
  }

  function handleSearchStep(direction: 1 | -1) {
    const matches = searchMatchesFor(messageQuery);
    if (matches.length === 0) return;
    const next = (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(next);
    jumpToMessage(matches[next].id);
  }

  async function handleSendReply() {
    const trimmed = replyText.trim();
    if (!trimmed || !activeId) return;

    const quoting = replyingTo;

    // Optimistic: shows up instantly instead of waiting on the round trip (WhatsApp send +
    // DB write) — rolled back below if the send actually fails.
    const optimisticId = `optimistic-${Date.now()}`;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: optimisticId,
                role: "AGENT",
                content: trimmed,
                contentType: "TEXT",
                caption: null,
                createdAt: new Date().toISOString(),
                starred: false,
                replyToId: quoting?.id ?? null,
                replyTo: quoting
                  ? { id: quoting.id, role: quoting.role, content: quoting.content, contentType: quoting.contentType, caption: quoting.caption }
                  : null,
                customerReaction: null,
                agentReaction: null,
                deliveryStatus: null,
                forwarded: false,
              },
            ],
          }
        : prev,
    );
    setReplyText("");
    setReplyingTo(null);
    setSendingReply(true);
    sendingReplyRef.current = true;
    setReplyError(null);
    const result = await sendAgentReply(activeId, trimmed, quoting?.id);
    setSendingReply(false);
    sendingReplyRef.current = false;
    if (result.error) {
      setReplyError(result.error);
      setDetail((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticId) } : prev));
      setReplyText(trimmed);
      setReplyingTo(quoting);
      return;
    }
    setDetail(await getConversationMessages(activeId));
    patchConversation(activeId, { status: "HANDOFF" });
  }

  async function handleResolve() {
    if (!activeId) return;
    setResolving(true);
    const result = await resolveConversation(activeId);
    setResolving(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setDetail((prev) => (prev ? { ...prev, status: "RESOLVED" } : prev));
    patchConversation(activeId, { status: "RESOLVED" });
  }

  async function handleRestart() {
    if (!activeId) return;
    setRestarting(true);
    const result = await restartBotForConversation(activeId);
    setRestarting(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setDetail((prev) => (prev ? { ...prev, status: "OPEN" } : prev));
    patchConversation(activeId, { status: "OPEN" });
  }

  async function handleArchiveToggle() {
    if (!activeId || !detail) return;
    const next = !detail.archived;
    setArchiving(true);
    const result = await setConversationArchived(activeId, next);
    setArchiving(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setDetail((prev) => (prev ? { ...prev, archived: next } : prev));
    patchConversation(activeId, { archived: next });
  }

  async function handleBlockToggle() {
    if (!activeId || !detail) return;
    const next = !detail.blocked;
    setBlocking(true);
    const result = await setConversationBlocked(activeId, next);
    setBlocking(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setDetail((prev) => (prev ? { ...prev, blocked: next } : prev));
    patchConversation(activeId, { blocked: next });
  }

  async function handleSetReaction(message: DetailMessage, emoji: string) {
    const next = message.agentReaction === emoji ? null : emoji;
    setReactingId(message.id);
    setDetail((prev) =>
      prev ? { ...prev, messages: prev.messages.map((m) => (m.id === message.id ? { ...m, agentReaction: next } : m)) } : prev,
    );
    const result = await setMessageReaction(message.id, next);
    setReactingId(null);
    if (result.error) {
      setDetail((prev) =>
        prev
          ? { ...prev, messages: prev.messages.map((m) => (m.id === message.id ? { ...m, agentReaction: message.agentReaction } : m)) }
          : prev,
      );
      setReplyError(result.error);
    }
  }

  async function handleForward(targetConversationId: string) {
    if (!forwardingMessageId) return;
    setForwardPending(true);
    setForwardError(null);
    const result = await forwardMessage(forwardingMessageId, targetConversationId);
    setForwardPending(false);
    if (result.error) {
      setForwardError(result.error);
      return;
    }
    setForwardingMessageId(null);
    if (activeId === targetConversationId) setDetail(await getConversationMessages(targetConversationId));
    patchConversation(targetConversationId, { status: "HANDOFF" });
  }

  async function handleExportAll() {
    setExportingAll(true);
    const result = await exportConversationsAsText();
    setExportingAll(false);
    if (result.error || !result.text) {
      setReplyError(result.error ?? "Nothing to export.");
      return;
    }
    downloadTextFile(`chatmeo-export-${new Date().toISOString().slice(0, 10)}.txt`, result.text);
  }

  async function handleExportConversation(conversationId: string, visitorId: string) {
    setExportingConversationId(conversationId);
    const result = await exportConversationsAsText([conversationId]);
    setExportingConversationId(null);
    if (result.error || !result.text) {
      setReplyError(result.error ?? "Nothing to export.");
      return;
    }
    downloadTextFile(`chatmeo-${visitorId}-${new Date().toISOString().slice(0, 10)}.txt`, result.text);
  }

  async function handleDelete() {
    if (!activeId) return;
    setDeleting(true);
    const result = await deleteConversation(activeId);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== activeId));
    close();
  }

  // Deletes every conversation matching the current filter/search/folder — same "everything
  // currently shown" scope as `filtered` below, snapshotted at confirm time so a poll landing
  // mid-request can't change which ids actually get deleted out from under the user.
  async function handleDeleteAll() {
    const idsToDelete = filtered.map((c) => c.id);
    if (idsToDelete.length === 0) {
      setShowDeleteAllConfirm(false);
      return;
    }
    setDeletingAll(true);
    const result = await deleteConversations(idsToDelete);
    setDeletingAll(false);
    setShowDeleteAllConfirm(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    const deletedIds = new Set(idsToDelete);
    setConversations((prev) => prev.filter((c) => !deletedIds.has(c.id)));
    if (activeId && deletedIds.has(activeId)) close();
  }

  async function handleMoveToFolder(folderId: string | null) {
    if (!activeId) return;
    const result = await assignConversationToFolder(activeId, folderId);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setDetail((prev) => (prev ? { ...prev, folderId } : prev));
    patchConversation(activeId, { folderId });
  }

  async function handleCreateFolder(name: string) {
    setCreatingFolder(true);
    const result = await createFolder(name);
    setCreatingFolder(false);
    if (result.error || !result.folder) return result.error ?? "Couldn't create folder.";

    const folder = result.folder;
    setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
    if (typeof newFolderTarget === "string") {
      const conversationId = newFolderTarget;
      const assign = await assignConversationToFolder(conversationId, folder.id);
      if (!assign.error) {
        setDetail((prev) => (prev && prev.id === conversationId ? { ...prev, folderId: folder.id } : prev));
        patchConversation(conversationId, { folderId: folder.id });
      }
    }
    setNewFolderTarget("closed");
    return null;
  }

  async function handleDeleteFolder(folderId: string) {
    const result = await deleteFolder(folderId);
    if (result.error) return;
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setConversations((prev) => prev.map((c) => (c.folderId === folderId ? { ...c, folderId: null } : c)));
    if (detail?.folderId === folderId) setDetail((prev) => (prev ? { ...prev, folderId: null } : prev));
    if (filter === `folder:${folderId}`) setFilter("all");
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
      <div className="relative mb-3">
        <ActionsSearchIcon size={13} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by visitor, bot, or message…"
          aria-label="Search conversations"
          className="w-full rounded-full border border-line-2 bg-card-2 py-2 pl-9 pr-3.5 text-[12.5px] text-text placeholder:text-muted focus:border-orange-2/50 focus:outline-none"
        />
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
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

      <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-[12px] font-semibold transition ${
              filter === `folder:${folder.id}`
                ? "border-orange-2/50 bg-orange/10 text-orange-2"
                : "border-line-2 bg-card-2 text-muted"
            }`}
          >
            <button
              type="button"
              data-fx-skip
              onClick={() => setFilter(`folder:${folder.id}`)}
              className="flex items-center gap-1.5 hover:text-text"
            >
              <ActionsFolderIcon size={11} />
              {folder.name}
            </button>
            <button
              type="button"
              data-fx-skip
              onClick={() => handleDeleteFolder(folder.id)}
              aria-label={`Delete folder ${folder.name}`}
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-muted/70 transition hover:bg-white/10 hover:text-bad"
            >
              <ActionsCloseIcon size={9} />
            </button>
          </div>
        ))}
        <button
          type="button"
          data-fx-skip
          onClick={() => setNewFolderTarget(null)}
          className="flex items-center gap-1 rounded-full border border-dashed border-line-2 px-3 py-1 text-[12px] font-semibold text-muted transition hover:border-orange-2/40 hover:text-text"
        >
          <ActionsPlusIcon size={10} />
          New folder
        </button>
      </div>

      <div className="mb-3.5 flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-muted">
          {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-fx-skip
            onClick={handleExportAll}
            disabled={exportingAll}
            className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-3 py-1.5 text-[11.5px] font-semibold text-muted transition hover:border-orange-2/40 hover:text-text disabled:opacity-50"
          >
            {exportingAll ? <AnimatedSpinnerIcon size={11} /> : <ActionsDownloadIcon size={11} />}
            Export all chats
          </button>
          {filtered.length > 0 && (
            <button
              type="button"
              data-fx-skip
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-3 py-1.5 text-[11.5px] font-semibold text-muted transition hover:border-bad/40 hover:text-bad"
            >
              <ActionsTrashIcon size={11} />
              Delete all shown
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card p-8 text-center">
          <p className="text-[13px] text-muted">
            {search.trim() ? "No conversations match your search." : "No conversations match this filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((conversation) => {
            const unread = isUnread(conversation);
            return (
            <button
              key={conversation.id}
              type="button"
              data-fx-skip
              onClick={() => openConversation(conversation.id)}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition hover:border-orange-2/40 hover:bg-card-2 ${
                unread ? "border-orange-2/30 bg-card-2" : "border-line bg-card"
              }`}
            >
              <span
                className="relative flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  background: conversation.channel === "WHATSAPP" ? "rgba(78,216,142,.15)" : "rgba(255,92,22,.15)",
                }}
              >
                {conversation.channel === "WHATSAPP" ? (
                  <ChannelsWhatsappIcon size={17} className="text-ok" />
                ) : (
                  <ChannelsWidgetIcon size={17} className="text-orange-2" />
                )}
                {unread && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange-2" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`min-w-0 shrink truncate text-[13.5px] ${unread ? "font-bold text-text" : "font-semibold"}`}
                  >
                    {conversation.botName}
                  </span>
                  <span className="flex-shrink-0 text-[11px] text-muted">·</span>
                  <span className="min-w-0 shrink truncate text-[11px] text-muted">
                    {conversation.visitorId}
                  </span>
                </div>
                <p className={`mt-0.5 truncate text-[12.5px] ${unread ? "font-medium text-text/90" : "text-muted"}`}>
                  {conversation.lastMessageRole === "USER" && (
                    <span className="text-text/70">Visitor: </span>
                  )}
                  {conversation.lastMessagePreview}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <ChannelBadge channel={conversation.channel} />
                  <StatusBadge status={conversation.status} />
                </div>
                <span className="text-[11px] text-muted">{timeAgo(conversation.lastMessageAt)}</span>
              </div>
            </button>
            );
          })}
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
            <ActionsCloseIcon size={16} />
          </button>
        </div>

        {detail && (
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <ChannelBadge channel={detail.channel} />
              <StatusBadge status={detail.status} />
              {detail.blocked && (
                <span className="flex-shrink-0 rounded-full border border-bad/30 bg-bad/10 px-[11px] py-1 text-[11px] font-semibold text-bad">
                  Blocked
                </span>
              )}
              <span className="text-[11px] text-muted">Started {timeAgo(detail.createdAt)}</span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                data-fx-skip
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setMessageQuery("");
                }}
                aria-label={searchOpen ? "Close search" : "Search in conversation"}
                aria-pressed={searchOpen}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                  searchOpen ? "bg-orange/10 text-orange-2" : "text-muted hover:bg-white/[.06] hover:text-text"
                }`}
              >
                <ActionsSearchIcon size={12} />
              </button>
              <button
                type="button"
                data-fx-skip
                onClick={() => setStarredOnly((v) => !v)}
                aria-label={starredOnly ? "Show all messages" : "Show starred messages"}
                aria-pressed={starredOnly}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                  starredOnly ? "bg-orange/10 text-orange-2" : "text-muted hover:bg-white/[.06] hover:text-text"
                }`}
              >
                <ActionsStarIcon size={12} filled={starredOnly} />
              </button>
              {detail.status !== "RESOLVED" && (
                <button
                  type="button"
                  data-fx-skip
                  onClick={handleResolve}
                  disabled={resolving}
                  className="flex items-center gap-1 rounded-full border border-line-2 bg-card-2 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-orange-2/40 hover:text-text disabled:opacity-50"
                >
                  {resolving ? <AnimatedSpinnerIcon size={11} /> : <ActionsCheckIcon size={11} />}
                  Mark resolved
                </button>
              )}
              <ConversationMenu
                folders={folders}
                currentFolderId={detail.folderId}
                archived={detail.archived}
                blocked={detail.blocked}
                restarting={restarting}
                archiving={archiving}
                blocking={blocking}
                exporting={exportingConversationId === activeId}
                onRestart={handleRestart}
                onArchiveToggle={handleArchiveToggle}
                onBlockToggle={handleBlockToggle}
                onExport={() => activeId && handleExportConversation(activeId, detail.visitorId)}
                onDelete={() => setShowDeleteConfirm(true)}
                onMoveToFolder={handleMoveToFolder}
                onNewFolder={() => setNewFolderTarget(activeId)}
              />
            </div>
          </div>
        )}

        {detail && searchOpen && (
          <div className="flex items-center gap-2 border-b border-line bg-card-2/50 px-4 py-2">
            <ActionsSearchIcon size={12} className="flex-shrink-0 text-muted" />
            <input
              autoFocus
              value={messageQuery}
              onChange={(event) => {
                setMessageQuery(event.target.value);
                setMatchIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearchStep(event.shiftKey ? -1 : 1);
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Search this conversation…"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text placeholder:text-muted focus:outline-none"
            />
            {messageQuery.trim() && (
              <span className="flex-shrink-0 text-[11px] text-muted">
                {searchMatchesFor(messageQuery).length > 0 ? `${matchIndex + 1}/${searchMatchesFor(messageQuery).length}` : "0/0"}
              </span>
            )}
            <button
              type="button"
              data-fx-skip
              onClick={() => handleSearchStep(-1)}
              aria-label="Previous match"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
            >
              <ActionsUndoIcon size={11} className="rotate-90" />
            </button>
            <button
              type="button"
              data-fx-skip
              onClick={() => handleSearchStep(1)}
              aria-label="Next match"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
            >
              <ActionsUndoIcon size={11} className="-rotate-90" />
            </button>
          </div>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-5">
          {loadingDetail && (
            <div className="flex h-full items-center justify-center">
              <AnimatedSpinnerIcon size={20} className="text-muted" />
            </div>
          )}
          {!loadingDetail && detail && detail.messages.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted">No messages in this conversation.</p>
          )}
          {!loadingDetail && detail && detail.messages.length > 0 && starredOnly && !detail.messages.some((m) => m.starred) && (
            <p className="py-8 text-center text-[13px] text-muted">No starred messages yet.</p>
          )}
          {!loadingDetail && detail && (
            <div className="flex flex-col gap-3.5">
              {buildRenderItems(starredOnly ? detail.messages.filter((m) => m.starred) : detail.messages).map((item) =>
                item.kind === "divider" ? (
                  <div key={item.key} className="my-1 flex items-center justify-center">
                    <span className="rounded-full bg-card-2 px-3 py-1 text-[10.5px] font-semibold text-muted">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <MessageRow
                    key={item.message.id}
                    message={item.message}
                    isMine={item.message.role !== "USER"}
                    visitorId={detail.visitorId}
                    channel={detail.channel}
                    starring={starringId === item.message.id}
                    deleting={deletingMessageId === item.message.id}
                    reacting={reactingId === item.message.id}
                    highlighted={highlightedMessageId === item.message.id}
                    swipeDx={swipe?.id === item.message.id ? swipe.dx : 0}
                    registerRef={(el) => {
                      if (el) messageRefs.current.set(item.message.id, el);
                      else messageRefs.current.delete(item.message.id);
                    }}
                    onReply={() => setReplyingTo(item.message)}
                    onStar={() => handleToggleStar(item.message)}
                    onCopy={() => handleCopyMessage(item.message)}
                    onReact={(emoji) => handleSetReaction(item.message, emoji)}
                    onForward={() => setForwardingMessageId(item.message.id)}
                    onDeleteRequest={() => setMessagePendingDeleteId(item.message.id)}
                    onJumpToQuote={item.message.replyTo ? () => jumpToMessage(item.message.replyTo!.id) : undefined}
                    onSwipeStart={(x) => {
                      swipeStartRef.current = { id: item.message.id, x };
                    }}
                    onSwipeMove={(x) => handleSwipeMove(item.message, x)}
                    onSwipeEnd={() => handleSwipeEnd(item.message)}
                  />
                ),
              )}
            </div>
          )}
          {!loadingDetail && !detail && (
            <p className="py-8 text-center text-[13px] text-muted">Couldn&apos;t load this conversation.</p>
          )}
        </div>

        {detail && (
          <div className="flex-shrink-0 border-t border-line px-4 py-3">
            {replyError && <p className="mb-2 text-[11.5px] text-bad">{replyError}</p>}
            {replyingTo && (
              <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-orange-2 bg-card-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-orange-2">
                    {quotePreviewLabel(replyingTo.role, detail.visitorId)}
                  </p>
                  <p className="truncate text-[12px] text-muted">{quotePreviewText(replyingTo)}</p>
                </div>
                <button
                  type="button"
                  data-fx-skip
                  onClick={() => setReplyingTo(null)}
                  aria-label="Cancel reply"
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/[.08] hover:text-text"
                >
                  <ActionsCloseIcon size={11} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendReply();
                  }
                }}
                placeholder="Reply as yourself…"
                className="max-h-28 min-h-[38px] flex-1 resize-none rounded-2xl border border-line-2 bg-card-2 px-3.5 py-2.5 text-[13px] text-text placeholder:text-muted focus:border-orange-2/50 focus:outline-none"
              />
              <button
                type="button"
                data-fx-skip
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                aria-label="Send reply"
                className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-grad-orange text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)] transition disabled:opacity-50"
              >
                {sendingReply ? <AnimatedSpinnerIcon size={15} /> : <CommsSendIcon size={15} />}
              </button>
            </div>
          </div>
        )}
      </aside>

      {showDeleteConfirm && detail && (
        <DeleteConversationConfirmModal
          visitorId={detail.visitorId}
          pending={deleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      {messagePendingDeleteId && (
        <DeleteMessageConfirmModal
          pending={deletingMessageId === messagePendingDeleteId}
          onCancel={() => setMessagePendingDeleteId(null)}
          onConfirm={() => handleDeleteMessage(messagePendingDeleteId)}
        />
      )}

      {forwardingMessageId && (
        <ForwardMessageModal
          conversations={conversations.filter((c) => c.id !== activeId)}
          pending={forwardPending}
          error={forwardError}
          onCancel={() => {
            setForwardingMessageId(null);
            setForwardError(null);
          }}
          onForward={handleForward}
        />
      )}

      {showDeleteAllConfirm && (
        <DeleteAllConfirmModal
          count={filtered.length}
          scopeLabel={
            filter === "all" && !search.trim()
              ? "every conversation in your Inbox"
              : "every conversation currently shown (matching your active filter/search)"
          }
          pending={deletingAll}
          onCancel={() => setShowDeleteAllConfirm(false)}
          onConfirm={handleDeleteAll}
        />
      )}

      {newFolderTarget !== "closed" && (
        <NewFolderModal
          pending={creatingFolder}
          onCancel={() => setNewFolderTarget("closed")}
          onCreate={handleCreateFolder}
        />
      )}
    </>
  );
}

// Tick glyphs for MessageTicks below — a plain check for sent/delivered, a slightly bolder pair
// for delivered, and the same pair in blue for read, matching WhatsApp Web's own convention
// closely enough to read instantly to anyone who's used WhatsApp.
function MessageTicks({ status }: { status: DetailMessage["deliveryStatus"] }) {
  if (!status || status === "FAILED") {
    return status === "FAILED" ? <span className="text-[10px] text-bad">Not delivered</span> : null;
  }
  const doubled = status === "DELIVERED" || status === "READ";
  const colorClass = status === "READ" ? "text-[#53bdeb]" : "text-white/60";
  return (
    <span className={`inline-flex items-center ${colorClass}`} aria-label={status.toLowerCase()}>
      <ActionsCheckIcon size={11} />
      {doubled && <ActionsCheckIcon size={11} className="-ml-[7px]" />}
    </span>
  );
}

// One message bubble, plus its swipe-to-reply gesture (touch) and hover action row (Reply, React,
// Star, Copy, Forward, Delete — desktop's equivalent of a right-click/long-press context menu).
// `isMine` covers both AGENT and BOT — from the seller's point of view in their own Inbox, the
// bot speaks for the business the same way a typed agent reply does, so both sit on "our" side,
// opposite the customer (USER).
function MessageRow({
  message,
  isMine,
  visitorId,
  channel,
  starring,
  deleting,
  reacting,
  highlighted,
  swipeDx,
  registerRef,
  onReply,
  onStar,
  onCopy,
  onReact,
  onForward,
  onDeleteRequest,
  onJumpToQuote,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
}: {
  message: DetailMessage;
  isMine: boolean;
  visitorId: string;
  channel: "WHATSAPP" | "WEB";
  starring: boolean;
  deleting: boolean;
  reacting: boolean;
  highlighted: boolean;
  swipeDx: number;
  registerRef: (el: HTMLDivElement | null) => void;
  onReply: () => void;
  onStar: () => void;
  onCopy: () => void;
  onReact: (emoji: string) => void;
  onForward: () => void;
  onDeleteRequest: () => void;
  onJumpToQuote?: () => void;
  onSwipeStart: (clientX: number) => void;
  onSwipeMove: (clientX: number) => void;
  onSwipeEnd: () => void;
}) {
  const canCopy = message.contentType === "TEXT" || Boolean(message.caption);
  const linkPreviewUrl = message.contentType === "TEXT" ? extractFirstUrl(message.content) : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  return (
    <div
      ref={registerRef}
      data-message-id={message.id}
      className={`group flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}
    >
      {!isMine && (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-card-2 text-muted">
          <CommsUserIcon size={12} />
        </span>
      )}
      <div className="relative max-w-[76%]">
        {swipeDx > 0 && (
          <span
            className="absolute left-[-32px] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-card-2 text-orange-2"
            style={{ opacity: Math.min(1, swipeDx / SWIPE_REPLY_THRESHOLD_PX) }}
            aria-hidden="true"
          >
            <ActionsUndoIcon size={12} />
          </span>
        )}
        <div
          onPointerDown={(event) => {
            if (event.pointerType === "touch") onSwipeStart(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "touch") onSwipeMove(event.clientX);
          }}
          onPointerUp={(event) => {
            if (event.pointerType === "touch") onSwipeEnd();
          }}
          onPointerCancel={() => onSwipeEnd()}
          className={`relative overflow-hidden rounded-2xl text-[13px] leading-relaxed ${
            isMine ? "rounded-br-md bg-grad-orange text-white" : "rounded-bl-md bg-card-2 text-text"
          } ${highlighted ? "ring-2 ring-orange-2 ring-offset-2 ring-offset-[#111]" : ""}`}
          style={{
            transform: swipeDx ? `translateX(${swipeDx}px)` : undefined,
            transition: swipeDx ? "none" : "transform 150ms ease-out",
          }}
        >
          {message.forwarded && (
            <p className={`px-3 pt-2 text-[10.5px] italic ${isMine ? "text-white/70" : "text-muted"}`}>Forwarded</p>
          )}
          {message.replyTo && (
            <button
              type="button"
              data-fx-skip
              onClick={onJumpToQuote}
              className={`block w-full border-l-2 border-orange-2/70 px-3 py-1.5 text-left text-[11.5px] transition hover:brightness-110 ${
                isMine ? "bg-black/10" : "bg-white/5"
              }`}
            >
              <span className="block font-semibold text-orange-2">
                {quotePreviewLabel(message.replyTo.role, visitorId)}
              </span>
              <span className="block truncate opacity-80">{quotePreviewText(message.replyTo)}</span>
            </button>
          )}

          {message.contentType === "IMAGE" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize it */}
              <img src={message.content} alt={message.caption ?? "Photo"} className="block max-h-72 w-full object-cover" />
              {message.caption && (
                <p className="whitespace-pre-wrap break-words px-3.5 py-2.5">{message.caption}</p>
              )}
            </>
          ) : (
            <div className="whitespace-pre-wrap break-words px-3.5 py-2.5">
              {formatMessage(
                message.content,
                "underline decoration-1 underline-offset-2 opacity-90 hover:opacity-100",
              )}
              {linkPreviewUrl && <MessageLinkPreview url={linkPreviewUrl} />}
            </div>
          )}

          {isMine && channel === "WHATSAPP" && message.deliveryStatus && (
            <div className="flex justify-end px-3.5 pb-1.5">
              <MessageTicks status={message.deliveryStatus} />
            </div>
          )}

          {message.starred && (
            <span className="absolute -top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#161616]">
              <ActionsStarIcon size={9} filled className="text-orange-2" />
            </span>
          )}
          {(message.customerReaction || message.agentReaction) && (
            <span
              className={`absolute -bottom-2 flex items-center gap-0.5 rounded-full border border-line-2 bg-[#161616] px-1 py-0.5 text-[10px] ${
                isMine ? "left-1.5" : "right-1.5"
              }`}
            >
              {message.customerReaction && <span>{message.customerReaction}</span>}
              {message.agentReaction && <span>{message.agentReaction}</span>}
            </span>
          )}
        </div>

        <div
          className={`absolute top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-full border border-line-2 bg-[#161616] p-0.5 opacity-0 shadow-[0_8px_20px_-8px_rgba(0,0,0,.6)] transition-opacity group-hover:opacity-100 min-[640px]:flex ${
            isMine ? "right-full mr-1.5" : "left-full ml-1.5"
          }`}
        >
          <button
            type="button"
            data-fx-skip
            onClick={onReply}
            aria-label="Reply"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[.08] hover:text-text"
          >
            <ActionsUndoIcon size={11} />
          </button>
          <div ref={pickerRef} className="relative">
            <button
              type="button"
              data-fx-skip
              onClick={() => setPickerOpen((v) => !v)}
              disabled={reacting}
              aria-label="React"
              aria-pressed={pickerOpen}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] leading-none transition hover:bg-white/[.08] disabled:opacity-50"
            >
              {reacting ? <AnimatedSpinnerIcon size={10} className="text-muted" /> : "🙂"}
            </button>
            {pickerOpen && (
              <div
                className={`absolute top-[calc(100%+6px)] z-[90] flex items-center gap-0.5 rounded-full border border-line-2 bg-[#161616] p-1 shadow-[0_20px_50px_-16px_rgba(0,0,0,.9)] ${
                  isMine ? "right-0" : "left-0"
                }`}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    data-fx-skip
                    onClick={() => {
                      onReact(emoji);
                      setPickerOpen(false);
                    }}
                    aria-label={`React with ${emoji}`}
                    aria-pressed={message.agentReaction === emoji}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] transition hover:bg-white/[.1] ${
                      message.agentReaction === emoji ? "bg-orange/15" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            data-fx-skip
            onClick={onStar}
            disabled={starring}
            aria-label={message.starred ? "Unstar" : "Star"}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[.08] hover:text-text disabled:opacity-50"
          >
            {starring ? (
              <AnimatedSpinnerIcon size={10} />
            ) : (
              <ActionsStarIcon size={11} filled={message.starred} className={message.starred ? "text-orange-2" : undefined} />
            )}
          </button>
          {canCopy && (
            <button
              type="button"
              data-fx-skip
              onClick={onCopy}
              aria-label="Copy"
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[.08] hover:text-text"
            >
              <ActionsDuplicateIcon size={11} />
            </button>
          )}
          <button
            type="button"
            data-fx-skip
            onClick={onForward}
            aria-label="Forward"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[.08] hover:text-text"
          >
            <ActionsUndoIcon size={11} className="-scale-x-100" />
          </button>
          <button
            type="button"
            data-fx-skip
            onClick={onDeleteRequest}
            disabled={deleting}
            aria-label="Delete message"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-bad/15 hover:text-bad disabled:opacity-50"
          >
            {deleting ? <AnimatedSpinnerIcon size={10} /> : <ActionsTrashIcon size={11} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fetches (once per url, via getLinkPreview's session-gated, SSRF-guarded server action — see
// src/lib/actions/link-preview.ts) and renders an OpenGraph-style card for a link found in a
// TEXT message. Renders nothing while loading or if no preview could be built — a missing card
// just means the plain text (already shown above it) is all there is, never an error state.
function MessageLinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreviewData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setPreview(undefined);
    getLinkPreview(url).then((data) => {
      if (!cancelled) setPreview(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      data-fx-skip
      className="mt-1.5 flex gap-2 overflow-hidden rounded-xl border border-white/10 bg-black/10 no-underline transition hover:brightness-110"
    >
      {preview.image && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URL, next/image can't optimize it
        <img src={preview.image} alt="" className="h-16 w-16 flex-shrink-0 object-cover" />
      )}
      <span className="min-w-0 flex-1 py-1.5 pr-2">
        <span className="block truncate text-[10px] uppercase tracking-wide opacity-60">{preview.siteName}</span>
        {preview.title && <span className="block truncate text-[12px] font-semibold">{preview.title}</span>}
        {preview.description && <span className="line-clamp-2 block text-[11px] opacity-75">{preview.description}</span>}
      </span>
    </a>
  );
}

function ConversationMenu({
  folders,
  currentFolderId,
  archived,
  blocked,
  restarting,
  archiving,
  blocking,
  exporting,
  onRestart,
  onArchiveToggle,
  onBlockToggle,
  onExport,
  onDelete,
  onMoveToFolder,
  onNewFolder,
}: {
  folders: FolderSummary[];
  currentFolderId: string | null;
  archived: boolean;
  blocked: boolean;
  restarting: boolean;
  archiving: boolean;
  blocking: boolean;
  exporting: boolean;
  onRestart: () => void;
  onArchiveToggle: () => void;
  onBlockToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onNewFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const itemClass =
    "flex w-full items-center gap-2 rounded-[11px] px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-card-2 disabled:opacity-50";
  const checkSlot = (selected: boolean) => (
    <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
      {selected && <ActionsCheckIcon size={11} className="text-orange-2" />}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-fx-skip
        onClick={() => setOpen((v) => !v)}
        aria-label="Conversation actions"
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
      >
        <ActionsMoreIcon size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[90] w-56 rounded-2xl border border-line-2 bg-[#161616] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]">
          <button
            type="button"
            data-fx-skip
            disabled={restarting}
            onClick={() => {
              onRestart();
              setOpen(false);
            }}
            className={itemClass}
          >
            {restarting ? <AnimatedSpinnerIcon size={13} /> : <ActionsRestartIcon size={13} />}
            Restart bot
          </button>

          <div className="my-1 border-t border-line" />
          <div className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            Folder
          </div>
          <button
            type="button"
            data-fx-skip
            onClick={() => {
              onMoveToFolder(null);
              setOpen(false);
            }}
            className={itemClass}
          >
            {checkSlot(currentFolderId === null)}
            No folder
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              data-fx-skip
              onClick={() => {
                onMoveToFolder(folder.id);
                setOpen(false);
              }}
              className={itemClass}
            >
              {checkSlot(currentFolderId === folder.id)}
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
          <button
            type="button"
            data-fx-skip
            onClick={() => {
              onNewFolder();
              setOpen(false);
            }}
            className={`${itemClass} text-orange-2`}
          >
            <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
              <ActionsPlusIcon size={10} />
            </span>
            New folder…
          </button>

          <div className="my-1 border-t border-line" />
          <button
            type="button"
            data-fx-skip
            disabled={archiving}
            onClick={() => {
              onArchiveToggle();
              setOpen(false);
            }}
            className={itemClass}
          >
            {archiving ? <AnimatedSpinnerIcon size={13} /> : <ActionsArchiveIcon size={13} />}
            {archived ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            data-fx-skip
            disabled={exporting}
            onClick={() => {
              onExport();
              setOpen(false);
            }}
            className={itemClass}
          >
            {exporting ? <AnimatedSpinnerIcon size={13} /> : <ActionsDownloadIcon size={13} />}
            Export chat
          </button>
          <button
            type="button"
            data-fx-skip
            disabled={blocking}
            onClick={() => {
              onBlockToggle();
              setOpen(false);
            }}
            className={`${itemClass} ${blocked ? "" : "text-bad"}`}
          >
            {blocking ? <AnimatedSpinnerIcon size={13} /> : <ActionsBlockIcon size={13} />}
            {blocked ? "Unblock" : "Block"}
          </button>
          <button
            type="button"
            data-fx-skip
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            className={`${itemClass} text-bad`}
          >
            <ActionsTrashIcon size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteConversationConfirmModal({
  visitorId,
  pending,
  onCancel,
  onConfirm,
}: {
  visitorId: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div onClick={pending ? undefined : onCancel} aria-hidden="true" className="fixed inset-0 z-[105] bg-black/60" />
      <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Delete conversation"
          className="w-full max-w-[380px] rounded-2xl border border-line bg-[#111] p-5 shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-bad/30 bg-bad/10 text-bad">
              <StatusWarningIcon size={16} />
            </span>
            <h3 className="text-[14px] font-semibold">Delete conversation?</h3>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            This permanently deletes the full transcript with{" "}
            <strong className="text-text">{visitorId}</strong>. Unlike archiving, this can&apos;t be undone —
            consider archiving instead if you just want it out of the way.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="rounded-full bg-bad px-3.5 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DeleteMessageConfirmModal({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div onClick={pending ? undefined : onCancel} aria-hidden="true" className="fixed inset-0 z-[105] bg-black/60" />
      <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Delete message"
          className="w-full max-w-[380px] rounded-2xl border border-line bg-[#111] p-5 shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-bad/30 bg-bad/10 text-bad">
              <StatusWarningIcon size={16} />
            </span>
            <h3 className="text-[14px] font-semibold">Delete this message?</h3>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            This removes it from the transcript here. It doesn&apos;t un-send anything already
            delivered to the customer.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="rounded-full bg-bad px-3.5 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ForwardMessageModal({
  conversations,
  pending,
  error,
  onCancel,
  onForward,
}: {
  conversations: ConversationSummary[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onForward: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const matches = trimmed
    ? conversations.filter(
        (c) => c.visitorId.toLowerCase().includes(trimmed) || c.botName.toLowerCase().includes(trimmed),
      )
    : conversations;

  return (
    <>
      <div onClick={pending ? undefined : onCancel} aria-hidden="true" className="fixed inset-0 z-[105] bg-black/60" />
      <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Forward message"
          className="flex max-h-[70vh] w-full max-w-[380px] flex-col rounded-2xl border border-line bg-[#111] p-5 shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <h3 className="text-[14px] font-semibold">Forward to…</h3>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by visitor or bot"
            className="mt-3 w-full rounded-xl border border-line-2 bg-card-2 px-3.5 py-2.5 text-[13px] text-text placeholder:text-muted focus:border-orange-2/50 focus:outline-none"
          />
          {error && <p className="mt-2 text-[11.5px] text-bad">{error}</p>}
          <div className="mt-3 flex-1 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted">No conversations match.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-fx-skip
                    disabled={pending}
                    onClick={() => onForward(c.id)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-card-2 disabled:opacity-50"
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ background: c.channel === "WHATSAPP" ? "rgba(78,216,142,.15)" : "rgba(255,92,22,.15)" }}
                    >
                      {c.channel === "WHATSAPP" ? (
                        <ChannelsWhatsappIcon size={14} className="text-ok" />
                      ) : (
                        <ChannelsWidgetIcon size={14} className="text-orange-2" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-text">{c.botName}</span>
                      <span className="block truncate text-[11px] text-muted">{c.visitorId}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DeleteAllConfirmModal({
  count,
  scopeLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  count: number;
  scopeLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div onClick={pending ? undefined : onCancel} aria-hidden="true" className="fixed inset-0 z-[105] bg-black/60" />
      <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Delete all conversations"
          className="w-full max-w-[380px] rounded-2xl border border-line bg-[#111] p-5 shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-bad/30 bg-bad/10 text-bad">
              <StatusWarningIcon size={16} />
            </span>
            <h3 className="text-[14px] font-semibold">
              Delete {count} conversation{count === 1 ? "" : "s"}?
            </h3>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            This permanently deletes the full transcripts for {scopeLabel}. Unlike archiving, this
            can&apos;t be undone — consider narrowing the filter first, or archiving instead if you
            just want them out of the way.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="rounded-full bg-bad px-3.5 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? "Deleting…" : `Delete all ${count}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function NewFolderModal({
  pending,
  onCancel,
  onCreate,
}: {
  pending: boolean;
  onCancel: () => void;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) return;
    const result = await onCreate(name);
    if (result) setError(result);
  }

  return (
    <>
      <div onClick={pending ? undefined : onCancel} aria-hidden="true" className="fixed inset-0 z-[105] bg-black/60" />
      <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New folder"
          className="w-full max-w-[380px] rounded-2xl border border-line bg-[#111] p-5 shadow-[0_24px_80px_-16px_rgba(0,0,0,.7)]"
        >
          <h3 className="text-[14px] font-semibold">New folder</h3>
          <input
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSubmit();
            }}
            placeholder="Folder name"
            className="mt-3 w-full rounded-xl border border-line-2 bg-card-2 px-3.5 py-2.5 text-[13px] text-text placeholder:text-muted focus:border-orange-2/50 focus:outline-none"
          />
          {error && <p className="mt-2 text-[11.5px] text-bad">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12.5px] font-semibold text-text transition hover:border-orange-2/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !name.trim()}
              className="rounded-full bg-grad-orange px-3.5 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
