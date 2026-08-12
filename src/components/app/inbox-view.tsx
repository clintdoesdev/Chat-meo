"use client";

import {
  ActionsArchiveIcon,
  ActionsCheckIcon,
  ActionsCloseIcon,
  ActionsFolderIcon,
  ActionsMoreIcon,
  ActionsPlusIcon,
  ActionsRestartIcon,
  ActionsTrashIcon,
  AnimatedSpinnerIcon,
  CommsSendIcon,
  NodesMessageIcon,
  StatusWarningIcon,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { formatMessage } from "@/components/format-message";
import { MeoMark } from "@/components/meo-mark";
import {
  assignConversationToFolder,
  createFolder,
  deleteConversation,
  deleteFolder,
  getConversationMessages,
  resolveConversation,
  restartBotForConversation,
  sendAgentReply,
  setConversationArchived,
  type ConversationDetail,
  type FolderSummary,
} from "@/lib/actions/inbox";
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
  archived: boolean;
  folderId: string | null;
};

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
  // Set right before opening the "new folder" modal — null means it was opened from the general
  // folder-management chip row, an id means it was opened from a specific conversation's "Move
  // to folder" menu, so the new folder gets assigned to that conversation immediately on create.
  const [newFolderTarget, setNewFolderTarget] = useState<string | null | "closed">("closed");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const filtered = conversations.filter((c) => {
    if (filter === "ARCHIVED") return c.archived;
    if (filter.startsWith("folder:")) return !c.archived && c.folderId === filter.slice("folder:".length);
    if (c.archived) return false;
    return filter === "all" || c.status === filter;
  });

  function patchConversation(id: string, patch: Partial<ConversationSummary>) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setDetail(null);
    setReplyText("");
    setReplyError(null);
    setLoadingDetail(true);
    const result = await getConversationMessages(id);
    setLoadingDetail(false);
    setDetail(result);
  }

  function close() {
    setActiveId(null);
    setDetail(null);
  }

  async function handleSendReply() {
    const trimmed = replyText.trim();
    if (!trimmed || !activeId) return;
    setSendingReply(true);
    setReplyError(null);
    const result = await sendAgentReply(activeId, trimmed);
    setSendingReply(false);
    if (result.error) {
      setReplyError(result.error);
      return;
    }
    setReplyText("");
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
                <NodesMessageIcon size={17} className="text-orange-2" />
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
            <ActionsCloseIcon size={16} />
          </button>
        </div>

        {detail && (
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="text-[11px] text-muted">Started {timeAgo(detail.createdAt)}</span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
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
                restarting={restarting}
                archiving={archiving}
                onRestart={handleRestart}
                onArchiveToggle={handleArchiveToggle}
                onDelete={() => setShowDeleteConfirm(true)}
                onMoveToFolder={handleMoveToFolder}
                onNewFolder={() => setNewFolderTarget(activeId)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {loadingDetail && (
            <div className="flex h-full items-center justify-center">
              <AnimatedSpinnerIcon size={20} className="text-muted" />
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
                    {formatMessage(
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

        {detail && (
          <div className="flex-shrink-0 border-t border-line px-4 py-3">
            {replyError && <p className="mb-2 text-[11.5px] text-bad">{replyError}</p>}
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

function ConversationMenu({
  folders,
  currentFolderId,
  archived,
  restarting,
  archiving,
  onRestart,
  onArchiveToggle,
  onDelete,
  onMoveToFolder,
  onNewFolder,
}: {
  folders: FolderSummary[];
  currentFolderId: string | null;
  archived: boolean;
  restarting: boolean;
  archiving: boolean;
  onRestart: () => void;
  onArchiveToggle: () => void;
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
