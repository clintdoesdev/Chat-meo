"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavDashboardIcon, NavFlowsIcon, NavInboxIcon } from "@/components/icons";
import { ToolsMenu } from "@/components/app/tools-menu";

// Settings used to be a 4th entry here, duplicating what the avatar menu (top-bar.tsx) already
// links to — the avatar/profile icon is visible at every breakpoint (it's outside the
// min-[760px]-gated nav pills), so dropping it here just removes the redundant second path
// instead of removing access to Settings.
const NAV_ITEMS = [
  { href: "/app", label: "Overview", Icon: NavDashboardIcon },
  { href: "/app/studio", label: "Studio", Icon: NavFlowsIcon },
  { href: "/app/inbox", label: "Inbox", Icon: NavInboxIcon },
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
      <ToolsMenu variant={variant} />
    </>
  );
}
