import { Bell } from "lucide-react";
import Link from "next/link";
import { AvatarMenu } from "@/components/app/avatar-menu";
import { NavLinks } from "@/components/app/nav-links";
import { MeoMark } from "@/components/meo-mark";

type TopBarProps = {
  name: string;
  email: string;
};

export function TopBar({ name, email }: TopBarProps) {
  return (
    <>
      <header className="sticky top-0 z-[60] border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-[22px] py-3">
          <Link href="/app" className="flex items-center gap-2 text-[15.5px] font-bold">
            <MeoMark size={24} />
            chatmeo
            <span className="-ml-[3px] mt-1 h-[7px] w-[7px] self-start rounded-full bg-orange" />
          </Link>

          <nav className="mx-auto hidden gap-0.5 min-[760px]:flex">
            <NavLinks variant="top" />
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line-2 text-muted transition-colors hover:text-text hover:border-orange-2/50"
            >
              <Bell size={16} />
            </button>
            <AvatarMenu name={name} email={email} />
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-[70] flex justify-around border-t border-line bg-bg/92 px-2.5 py-2 backdrop-blur-md min-[760px]:hidden"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <NavLinks variant="bottom" />
      </nav>
    </>
  );
}
