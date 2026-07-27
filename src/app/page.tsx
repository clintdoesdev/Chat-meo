import {
  Activity,
  ArrowRight,
  Check,
  Filter,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ChannelMarquee } from "@/components/landing/channel-marquee";
import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { HeroRefraction } from "@/components/landing/hero-refraction";
import { LandingNav } from "@/components/landing/landing-nav";
import { Reveal } from "@/components/reveal";
import { SplitTag } from "@/components/split-tag";

const FEATURES = [
  {
    Icon: Workflow,
    title: "Visual Flow Studio",
    description:
      "Drag nodes, wire branches, and ship the exact conversation you designed. What you see is what runs.",
    wide: true,
  },
  {
    Icon: Sparkles,
    title: "AI-powered replies",
    description: "Drop an AI node into any flow and let Meo handle the messy human parts.",
    wide: false,
  },
  {
    Icon: Target,
    title: "Lead capture",
    description: "Turn conversations into pipeline with built-in forms and CRM webhooks.",
    wide: false,
  },
  {
    Icon: Filter,
    title: "Conversion funnel",
    description: "See exactly where visitors drop off and which node needs work.",
    wide: false,
  },
  {
    Icon: Activity,
    title: "Real-time analytics",
    description: "Conversations, resolution rate, and drop-off — live, per bot, per day.",
    wide: true,
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "0",
    highlight: false,
    features: [
      "1 bot, unlimited flows",
      "200 messages / month",
      "Website widget embed",
      "Community support",
    ],
    cta: { label: "Start building", href: "/signin?mode=up" },
  },
  {
    name: "Growth",
    price: "15k",
    highlight: true,
    features: [
      "5 bots, unlimited flows",
      "10,000 messages / month",
      "AI nodes + webhooks",
      "Remove branding",
      "Lead export (CSV)",
    ],
    cta: { label: "Go Growth", href: "/signin?mode=up" },
  },
  {
    name: "Scale",
    price: "45k",
    highlight: false,
    features: [
      "Unlimited bots",
      "60,000 messages / month",
      "Priority AI throughput",
      "Team seats",
    ],
    cta: { label: "Talk to us", href: "mailto:hello@chatmeo.app?subject=Scale%20plan" },
  },
];

export default function LandingPage() {
  return (
    <div>
      <LandingNav />

      <section className="relative overflow-hidden">
        <HeroRefraction />

        <div className="relative z-[1] mx-auto max-w-[1120px] px-[22px] pt-[74px] text-center">
          <Reveal className="flex justify-center">
            <SplitTag segment="New" label="Visual Flow Studio, now in beta" />
          </Reveal>
          <Reveal delayMs={80}>
            <h1 className="mx-auto mt-[26px] max-w-[15ch] text-[clamp(36px,5.4vw,58px)] font-bold leading-[1.08] tracking-[-0.025em]">
              Intelligent Chatbots. Powered by Meo.
            </h1>
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
              className="inline-flex items-center gap-2 rounded-full bg-grad-orange px-[22px] py-[11px] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110"
            >
              Get started free
            </Link>
            <Link
              href="#features"
              data-fx
              className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-card-2 px-[22px] py-[11px] text-sm font-semibold transition hover:border-orange-2/50"
            >
              See how it works
              <ArrowRight size={14} />
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
            <p className="mb-6 text-[13px] text-muted">
              Works wherever your customers already are
            </p>
          </Reveal>
          <Reveal delayMs={80}>
            <ChannelMarquee />
          </Reveal>
        </section>

        <section id="features" className="scroll-mt-20 py-[84px]">
          <Reveal className="mx-auto mb-11 max-w-[560px] text-center">
            <h2 className="text-[clamp(26px,3.4vw,38px)] font-bold leading-[1.12] tracking-[-0.02em]">
              Everything you need to ship a bot
            </h2>
            <p className="mt-3 text-sm text-muted">
              Build visually, add AI where it counts, and watch every
              conversation convert — all from one dark, calm workspace.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-3.5 min-[640px]:grid-cols-2 min-[1020px]:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal
                key={feature.title}
                delayMs={index * 80}
                className={feature.wide ? "min-[1020px]:col-span-2" : ""}
              >
                <div className="flex h-full flex-col gap-2 rounded-[18px] border border-line bg-card p-5 transition hover:-translate-y-[3px] hover:border-orange-2/40">
                  <feature.Icon size={18} className="text-orange-2" />
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="text-[13px] text-muted">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 py-[84px] pt-5">
          <Reveal className="mx-auto mb-11 max-w-[560px] text-center">
            <h2 className="text-[clamp(26px,3.4vw,38px)] font-bold leading-[1.12] tracking-[-0.02em]">
              Pricing plans for success
            </h2>
            <p className="mt-3 text-sm text-muted">
              Every plan includes the full Flow Studio. You only pay for
              scale — cancel anytime.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 items-stretch gap-3.5 min-[860px]:grid-cols-3">
            {PLANS.map((plan, index) => (
              <Reveal key={plan.name} delayMs={index * 80}>
                <div
                  className={`relative flex h-full flex-col rounded-[18px] border p-[26px] transition hover:-translate-y-[3px] ${
                    plan.highlight
                      ? "border-orange-2/55 bg-[linear-gradient(180deg,rgba(255,92,22,.16),rgba(255,92,22,.05))] shadow-[0_30px_70px_-30px_rgba(255,92,22,.4)]"
                      : "border-line bg-card"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute right-5 top-5 rounded-full bg-grad-orange px-[11px] py-[5px] text-[10.5px] font-bold text-white">
                      Popular
                    </span>
                  )}
                  <div className="text-[13px] font-semibold text-muted">{plan.name}</div>
                  <div className="mb-1 mt-2.5 text-[38px] font-bold tracking-[-0.03em]">
                    <span className="mr-1 tracking-normal">₦</span>
                    {plan.price}
                    <span className="text-[13px] font-medium text-muted"> /month</span>
                  </div>
                  <ul className="my-5 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px] text-[#BDBDBD]">
                        <Check size={13} className="mt-0.5 flex-shrink-0 text-orange-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta.href}
                    data-fx
                    className={
                      plan.highlight
                        ? "inline-flex items-center justify-center rounded-full bg-grad-orange py-[11px] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_-8px_rgba(255,92,22,.6)] transition hover:brightness-110"
                        : "inline-flex items-center justify-center rounded-full border border-line-2 bg-card-2 py-[11px] text-sm font-semibold transition hover:border-orange-2/50"
                    }
                  >
                    {plan.cta.label}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <footer className="mt-14 border-t border-line pt-16">
          <div className="flex flex-wrap justify-between gap-10 pb-12">
            <div>
              <Link href="/" className="flex items-center gap-2 text-[17px] font-bold">
                chatmeo
                <span className="mt-1 h-[7px] w-[7px] self-start rounded-full bg-orange" />
              </Link>
              <p className="mt-2.5 max-w-[30ch] text-[13px] text-muted">
                Bots that feel alive. Built by Nova Pixel Studios.
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
                <Link href="#pricing" className="py-1 text-[13.5px] text-[#B5B5B5] transition-colors hover:text-orange-2">
                  Pricing
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
          <p className="pb-8 text-center text-[12px] text-muted">
            © 2026 Nova Pixel Studios. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
