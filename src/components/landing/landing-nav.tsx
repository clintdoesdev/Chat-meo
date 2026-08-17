import Link from "next/link";
import { MeoMark } from "@/components/meo-mark";

export function LandingNav() {
  return (
    <nav className="border-b border-line bg-bg/82 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-[22px] py-3.5">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold">
          <MeoMark size={26} />
          chatmeo
          <span className="-ml-[3px] mt-1 h-[7px] w-[7px] self-start rounded-full bg-orange" />
        </Link>

        <Link
          href="/signin"
          data-fx
          className="rounded-full border border-line-2 bg-card-2 px-[18px] py-[9px] text-[13px] font-semibold transition hover:border-orange-2/50"
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}
