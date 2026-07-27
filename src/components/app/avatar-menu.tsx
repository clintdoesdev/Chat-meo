"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/lib/actions/auth";

type AvatarMenuProps = {
  name: string;
  email: string;
};

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AvatarMenu({ name, email }: AvatarMenuProps) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-grad-orange text-[13px] font-bold text-white"
      >
        {initialsFor(name, email)}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[80] w-52 rounded-2xl border border-line-2 bg-[#161616] p-1.5 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]">
          <div className="mb-1 border-b border-line px-3 pb-2.5 pt-2">
            <div className="truncate text-[13.5px] font-semibold">{name}</div>
            <div className="truncate text-[11.5px] text-muted">{email}</div>
          </div>
          <Link
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="block rounded-[11px] px-3 py-2.5 text-[13px] transition-colors hover:bg-card-2"
          >
            Settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-[11px] px-3 py-2.5 text-left text-[13px] text-bad transition-colors hover:bg-card-2"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
