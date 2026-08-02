import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ActionsCheckIcon } from "@/components/icons";
import { ChannelMarquee } from "@/components/landing/channel-marquee";
import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { HeroRefraction } from "@/components/landing/hero-refraction";
import { LandingNav } from "@/components/landing/landing-nav";
import { MeoMark } from "@/components/meo-mark";
import { Reveal } from "@/components/reveal";
import { LazyGlassIcon } from "@/components/three/lazy-glass-icon";
import { BETA_BOT_CAP, BETA_MESSAGE_CAP } from "@/lib/beta-limits";

const BETA_INCLUDES = [
  "The full Visual Flow Studio — as many flows as you like",
  "AI replies powered by Grok, no separate API key needed",
  "Embed your bot on any website, unlimited conversations",
  `Up to ${BETA_BOT_CAP} bots, ${BETA_MESSAGE_CAP.toLocaleString()} messages per bot each month`,
];

export default function LandingPage() {
  return (
    <div>
      <LandingNav />

      <section className="relative overflow-hidden">
        <HeroRefraction />

        <div className="relative z-[1] mx-auto max-w-[1060px] px-[22px] pt-[88px] text-center">
          <div className="float-3 pointer-events-none absolute right-[6%] top-[420px] z-10 hidden md:block">
            <LazyGlassIcon icon="bolt" size={100} />
          </div>

          <Reveal className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-card/60 px-4 py-[7px] text-[13px] text-muted">
              Free during beta
              <Link href="#beta" data-fx className="font-semibold text-orange-2">
                What&apos;s included →
              </Link>
            </div>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="relative mx-auto mt-[26px] inline-block">
              <div className="float-1 pointer-events-none absolute -left-[120px] top-[64px] z-10 hidden md:block">
                <MeoMark size={170} excited />
              </div>
              <div className="pointer-events-none absolute -right-[150px] top-[-30px] z-10 hidden md:block">
                <LazyGlassIcon icon="bubble" size={140} />
              </div>

              <h1 className="relative text-[clamp(36px,5.4vw,58px)] font-extrabold leading-[1.08] tracking-[-0.025em]">
                Intelligent Chatbots.
                <br />
                Powered by Meo.
              </h1>
            </div>
          </Reveal>

          <Reveal delayMs={160}>
            <p className="mx-auto mb-7 mt-4 max-w-[44ch] text-[14.5px] text-muted">
              Design conversations visually, drop in AI where it counts, and
              launch a bot your visitors actually want to talk to — no code
              required.
            </p>
          </Reveal>
          <Reveal delayMs={240} className="flex flex-wrap justify-center gap-3">
            <Link
              href="/signin?mode=up"
              data-fx
              className="btn-sheen inline-flex items-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#FF8A3C,#FF5C16)] px-5 py-3 text-sm font-bold text-[#1A0B00] shadow-[0_0_24px_rgba(255,92,22,.35)] transition hover:brightness-110"
            >
              Get started free
            </Link>
            <Link
              href="#features"
              data-fx
              className="inline-flex items-center gap-2 rounded-[12px] border border-line-2 bg-card/70 px-5 py-3 text-sm font-medium transition hover:border-orange-2/50"
            >
              See how it works
            </Link>
          </Reveal>

          <div className="mt-16">
            <Reveal delayMs={320}>
              <DashboardMockup />
            </Reveal>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] px-[22px]">

        <section className="pb-2.5 pt-16 text-center">
          <Reveal>
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">
              Works wherever your customers already are
            </p>
          </Reveal>
          <Reveal delayMs={80}>
            <ChannelMarquee />
          </Reveal>
        </section>

        <section id="features" className="scroll-mt-20 py-[84px]">
          <Reveal className="mx-auto mb-11 max-w-[560px] text-center">
            <h2 className="text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.12] tracking-[-0.02em]">
              Everything you need to ship a bot
            </h2>
            <p className="mt-3 text-sm text-muted">
              Build visually, add AI where it counts, and watch every
              conversation convert — all from one dark, calm workspace.
            </p>
          </Reveal>

          <FeatureGrid />
        </section>

        <section id="beta" className="scroll-mt-20 py-[84px]">
          <Reveal className="mx-auto mb-11 max-w-[560px] text-center">
            <h2 className="text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.12] tracking-[-0.02em]">
              Free during beta
            </h2>
            <p className="mt-3 text-sm text-muted">
              Chatmeo is free while we&apos;re in beta, within the soft limits below. Pricing comes
              later — for now, everyone gets the same access.
            </p>
          </Reveal>

          <Reveal>
            <div className="mx-auto max-w-[560px] rounded-[20px] border border-line bg-card p-7">
              <ul className="flex flex-col gap-3.5">
                {BETA_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-text">
                    <span className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange-2">
                      <ActionsCheckIcon size={11} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 border-t border-line pt-6">
                <Link
                  href="/signin?mode=up"
                  data-fx
                  className="btn-sheen inline-flex items-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#FF8A3C,#FF5C16)] px-5 py-3 text-sm font-bold text-[#1A0B00] shadow-[0_0_24px_rgba(255,92,22,.35)] transition hover:brightness-110"
                >
                  Join the beta — it&apos;s free
                </Link>
                <a
                  href="mailto:hello@chatmeo.app?subject=Higher%20beta%20limits"
                  data-fx
                  className="inline-flex items-center gap-2 rounded-[12px] border border-line-2 bg-card/70 px-5 py-3 text-sm font-medium transition hover:border-orange-2/50"
                >
                  Need higher limits? Email us
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="mt-14 border-t border-line pt-16">
          <div className="flex flex-wrap justify-between gap-10 pb-12">
            <div>
              <Link href="/" className="flex items-center gap-2 text-[17px] font-bold">
                chatmeo
                <span className="mt-1 h-[7px] w-[7px] self-start rounded-full bg-orange" />
              </Link>
              <p className="mt-2.5 max-w-[30ch] text-[13px] text-muted">
                Bots that feel alive.
              </p>
            </div>
            <div>
              <h5 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">
                Product
              </h5>
              <div className="flex flex-col gap-1">
                <Link href="/" className="py-1 text-[13.5px] text-[#B5B5B5] transition-colors hover:text-orange-2">
                  Home
                </Link>
                <Link href="#features" className="py-1 text-[13.5px] text-[#B5B5B5] transition-colors hover:text-orange-2">
                  Features
                </Link>
                <Link href="#beta" className="py-1 text-[13.5px] text-[#B5B5B5] transition-colors hover:text-orange-2">
                  Beta access
                </Link>
                <Link href="/signin" className="py-1 text-[13.5px] text-[#B5B5B5] transition-colors hover:text-orange-2">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          <p
            className="select-none pb-2.5 text-center font-bold leading-[0.9] tracking-[-0.04em] text-transparent"
            style={{
              fontSize: "clamp(70px, 14vw, 180px)",
              backgroundImage: "linear-gradient(180deg, #2A2A2A, #101010)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
            }}
          >
            chatmeo
          </p>
          <div className="flex flex-col items-center gap-1.5 pb-8 text-center text-[12px] text-muted">
            <p>
              created by <span className="font-bold text-text">CLINTDOESDEV.</span>
            </p>
            <p>
              want to work with him?{" "}
              <a
                href="https://clintdoesdev.site/"
                target="_blank"
                rel="noopener noreferrer"
                data-fx
                className="inline-flex items-center gap-1 font-semibold text-orange-2 transition-colors hover:brightness-110"
              >
                check out his portfolio
                <ArrowUpRight size={12} />
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
