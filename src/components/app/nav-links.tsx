"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavDashboardIcon, NavFlowsIcon, NavInboxIcon, NavSettingsIcon } from "@/components/icons";

const NAV_ITEMS = [
  { href: "/app", label: "Overview", Icon: NavDashboardIcon },
  { href: "/app/studio", label: "Studio", Icon: NavFlowsIcon },
  { href: "/app/inbox", label: "Inbox", Icon: NavInboxIcon },
  { href: "/app/settings", label: "Settings", Icon: NavSettingsIcon },
];

export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={
              variant === "top"
                ? `flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    active ? "bg-card-2 text-text" : "text-muted hover:text-text"
                  }`
                : `flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium ${
                    active ? "text-orange-2" : "text-muted"
                  }`
            }
          >
            <Icon size={variant === "top" ? 15 : 18} />
            {label}
          </Link>
        );
      })}
    </>
  );
}
