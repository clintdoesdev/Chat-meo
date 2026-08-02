"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActionsCheckIcon, CommsBellIcon, CommsUserIcon } from "@/components/icons";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { timeAgo } from "@/lib/time";

export type NotificationItem = {
  id: string;
  botName: string;
  visitorId: string;
  createdAt: string;
  read: boolean;
};

export function NotificationsMenu({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = items.filter((item) => !item.read).length;

  async function handleMarkAllRead() {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    await markNotificationsRead();
    setMarking(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        data-fx-skip
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line-2 text-muted transition-colors hover:text-text hover:border-orange-2/50"
      >
        <CommsBellIcon size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-orange px-[3px] text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[300px] rounded-2xl border border-line-2 bg-[#161616] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]">
          <div className="flex items-center justify-between border-b border-line px-3 pb-2.5 pt-2">
            <span className="text-[12.5px] font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                data-fx-skip
                onClick={handleMarkAllRead}
                disabled={marking}
                className="flex items-center gap-1 text-[11px] font-semibold text-orange-2 transition hover:text-orange disabled:opacity-50"
              >
                <ActionsCheckIcon size={11} />
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-muted">
              You&apos;re all caught up.
            </p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto py-1">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href="/app/inbox"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-[11px] px-3 py-2.5 transition-colors hover:bg-card-2"
                >
                  <span className="relative mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
                    <CommsUserIcon size={13} />
                    {!item.read && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#161616] bg-orange"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[12.5px] ${item.read ? "text-muted" : "font-medium text-text"}`}
                    >
                      {item.botName} needs a human
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {item.visitorId} · {timeAgo(item.createdAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/app/inbox"
            onClick={() => setOpen(false)}
            className="block rounded-[11px] px-3 py-2.5 text-center text-[12.5px] font-semibold text-orange-2 transition-colors hover:bg-card-2"
          >
            Open Inbox
          </Link>
        </div>
      )}
    </div>
  );
}
