import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { MeoMark } from "@/components/meo-mark";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav />

      <section className="flex flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <MeoMark size={56} excited />
        <h1 className="mt-5 max-w-[20ch] text-[clamp(28px,5vw,42px)] font-extrabold leading-[1.15] tracking-[-0.02em]">
          Chatbots for your website, powered by Meo.
        </h1>
        <p className="mt-3 max-w-[42ch] text-[14px] text-muted">
          Chatmeo is currently in closed beta. If you already have an account, sign in below.
        </p>
        <Link
          href="/signin"
          data-fx
          className="mt-7 inline-flex items-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#FF8A3C,#FF5C16)] px-6 py-3 text-sm font-bold text-[#1A0B00] shadow-[0_0_24px_rgba(255,92,22,.35)] transition hover:brightness-110"
        >
          Sign in
        </Link>
      </section>

      <footer className="border-t border-line py-6 text-center text-[12px] text-muted">
        <Link href="/privacy" className="transition-colors hover:text-orange-2">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
