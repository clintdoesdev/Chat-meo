"use client";

import { Bell, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/time";

export type NotificationItem = {
  id: string;
  botName: string;
  visitorId: string;
  createdAt: string;
};

export function NotificationsMenu({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const count = notifications.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={count > 0 ? `Notifications (${count} need a human)` : "Notifications"}
        data-fx-skip
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line-2 text-muted transition-colors hover:text-text hover:border-orange-2/50"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-orange px-[3px] text-[9px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[300px] rounded-2xl border border-line-2 bg-[#161616] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]">
          <div className="border-b border-line px-3 pb-2.5 pt-2 text-[12.5px] font-semibold">
            Notifications
          </div>
          {count === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-muted">
              You&apos;re all caught up.
            </p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto py-1">
              {notifications.map((item) => (
                <Link
                  key={item.id}
                  href="/app/inbox"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-[11px] px-3 py-2.5 transition-colors hover:bg-card-2"
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange-2">
                    <UserRound size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">
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
