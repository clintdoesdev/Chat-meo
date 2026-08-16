"use client";

import { useEffect, useState } from "react";
import { ActionsDuplicateIcon, ActionsLinkIcon, ActionsPlusIcon, ActionsTrashIcon, AnimatedSpinnerIcon } from "@/components/icons";
import {
  createWhatsAppShortLink,
  deleteWhatsAppShortLink,
  listWhatsAppShortLinks,
  type WhatsAppShortLinkInfo,
} from "@/lib/actions/whatsapp-short-links";

/** Click-to-chat short links for this bot's connected WhatsApp number — create a link with a
 * pre-filled message, share it anywhere, see how many times it's been opened. Only ever rendered
 * while WhatsAppConnectPanel shows a live (non-DISCONNECTED) connection, since a link needs a
 * number to snapshot at creation time. */
export function WhatsAppShortLinksPanel({ botId }: { botId: string }) {
  const [links, setLinks] = useState<WhatsAppShortLinkInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    let cancelled = false;
    listWhatsAppShortLinks(botId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setLoadError(result.error);
        return;
      }
      setLinks(result.links);
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  async function handleDelete(linkId: string) {
    setLinks((prev) => prev?.filter((link) => link.id !== linkId) ?? prev);
    await deleteWhatsAppShortLink(botId, linkId);
  }

  function handleCopy(slug: string) {
    navigator.clipboard.writeText(`${origin}/l/${slug}`).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="mt-3.5 rounded-xl border border-line-2 bg-card-2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[12.5px] font-semibold text-text">Click-to-chat links</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Short links that open WhatsApp with a message already typed in, ready to send —
            paste them into ads, bios, or posts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line-2 bg-[#111] px-3 py-2 text-[12px] font-semibold text-text transition hover:border-orange-2/50"
        >
          <ActionsPlusIcon size={13} />
          New link
        </button>
      </div>

      {showForm && (
        <NewShortLinkForm
          botId={botId}
          onCreated={(link) => {
            setLinks((prev) => (prev ? [link, ...prev] : [link]));
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loadError && <p className="mt-2.5 text-[11px] text-bad">{loadError}</p>}

      {links && links.length === 0 && !showForm && (
        <p className="mt-3 text-[11.5px] text-muted">No links yet — create one to get a shareable URL.</p>
      )}

      {links && links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-2 rounded-[13px] border border-line-2 bg-[#111] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-text">{link.label}</p>
                <p className="truncate text-[11px] text-muted">{`${origin}/l/${link.slug}`}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-line-2 bg-card-2 px-2.5 py-1 text-[10.5px] font-semibold text-muted">
                  {link.clickCount} {link.clickCount === 1 ? "click" : "clicks"}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(link.slug)}
                  aria-label="Copy link"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-line-2 bg-card-2 text-muted transition hover:border-orange-2/50 hover:text-text"
                >
                  <ActionsDuplicateIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(link.id)}
                  aria-label="Delete link"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-line-2 bg-card-2 text-muted transition hover:border-bad/50 hover:text-bad"
                >
                  <ActionsTrashIcon size={12} />
                </button>
              </div>
              {copied === link.slug && <span className="text-[10.5px] text-ok">Copied</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewShortLinkForm({
  botId,
  onCreated,
  onCancel,
}: {
  botId: string;
  onCreated: (link: WhatsAppShortLinkInfo) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setPending(true);
    const result = await createWhatsAppShortLink(botId, { label, message });
    setPending(false);
    if (result.error || !result.link) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    onCreated(result.link);
  }

  return (
    <div className="mt-3 rounded-[13px] border border-line-2 bg-[#111] p-3">
      <label htmlFor="short-link-label" className="mb-1.5 block text-[11px] font-semibold text-muted">
        Name (for you — never shown to whoever clicks it)
      </label>
      <input
        id="short-link-label"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="e.g. Instagram bio"
        maxLength={60}
        className="w-full rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[12.5px] text-text focus:border-orange-2/60 focus:outline-none"
      />
      <label htmlFor="short-link-message" className="mb-1.5 mt-2.5 block text-[11px] font-semibold text-muted">
        Pre-filled message
      </label>
      <textarea
        id="short-link-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Hi! I'd like to know more…"
        rows={2}
        maxLength={1000}
        className="w-full resize-none rounded-[13px] border border-line-2 bg-card-2 px-3.5 py-2.5 text-[12.5px] text-text focus:border-orange-2/60 focus:outline-none"
      />
      {error && <p className="mt-1.5 text-[11px] text-bad">{error}</p>}
      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-full border border-line-2 bg-card-2 px-3.5 py-2 text-[12px] font-semibold text-text transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={pending || !label.trim() || !message.trim()}
          className="flex items-center gap-1.5 rounded-full bg-grad-orange px-3.5 py-2 text-[12px] font-semibold text-white transition disabled:opacity-50"
        >
          {pending ? <AnimatedSpinnerIcon size={13} /> : <ActionsLinkIcon size={13} />}
          {pending ? "Creating…" : "Create link"}
        </button>
      </div>
    </div>
  );
}
