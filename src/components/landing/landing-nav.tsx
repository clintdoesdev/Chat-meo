"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MeoMark } from "@/components/meo-mark";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-[60] border-b border-line bg-bg/82 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-[22px] py-3.5">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold">
          <MeoMark size={26} />
          chatmeo
          <span className="-ml-[3px] mt-1 h-[7px] w-[7px] self-start rounded-full bg-orange" />
        </Link>

        <div className="hidden items-center gap-0.5 min-[760px]:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[13.5px] font-medium text-muted transition-colors hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/signin"
            className="hidden rounded-full border border-line-2 bg-card-2 px-[18px] py-[9px] text-[13px] font-semibold transition hover:border-orange-2/50 min-[760px]:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signin?mode=up"
            className="hidden items-center gap-2 rounded-full bg-grad-orange px-[18px] py-[9px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110 min-[760px]:inline-flex"
          >
            Get started free
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line-2 min-[760px]:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line px-[14px] pb-4 pt-2 min-[760px]:hidden">
          <div className="flex flex-col gap-1 rounded-[20px] border border-line-2 bg-[#131313] p-2.5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-[13px] px-4 py-3 text-[14px] font-medium transition-colors hover:bg-card-2"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signin"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-full border border-line-2 bg-card-2 px-4 py-2.5 text-center text-[13px] font-semibold"
            >
              Sign in
            </Link>
            <Link
              href="/signin?mode=up"
              onClick={() => setOpen(false)}
              className="rounded-full bg-grad-orange px-4 py-2.5 text-center text-[13px] font-semibold text-white"
            >
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
