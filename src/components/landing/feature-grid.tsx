import { Sparkles, User } from "lucide-react";
import { Reveal } from "@/components/reveal";

const CARD =
  "rounded-[18px] border border-line bg-card p-6 transition hover:-translate-y-[3px] hover:border-orange-2/40";

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-[18px] flex h-[46px] w-[46px] items-center justify-center rounded-[13px] border border-line-2 bg-card-2">
      {children}
    </span>
  );
}

function FlowDiagram() {
  return (
    <svg width="100%" height="140" viewBox="0 0 560 150" className="mb-4 block" aria-hidden="true">
      <path d="M96 40 C 160 40 160 84 224 84" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
      <path d="M96 40 C 170 40 170 118 244 118" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
      <path d="M320 84 C 380 84 380 52 440 52" stroke="rgba(255,138,60,0.5)" strokeWidth="1.5" fill="none" />

      <rect x="16" y="22" width="80" height="36" rx="10" fill="#1B1B1B" stroke="rgba(255,255,255,0.12)" />
      <circle cx="34" cy="40" r="5" fill="#FF5C16" />
      <rect x="46" y="36" width="36" height="7" rx="3.5" fill="#3A3A3A" />

      <rect x="224" y="66" width="96" height="36" rx="10" fill="#1B1B1B" stroke="rgba(255,138,60,0.6)" />
      <circle cx="242" cy="84" r="5" fill="#FF8A3C" />
      <rect x="254" y="80" width="52" height="7" rx="3.5" fill="#4A4A4A" />

      <rect x="244" y="104" width="80" height="28" rx="9" fill="#1B1B1B" stroke="rgba(255,255,255,0.12)" />
      <rect x="258" y="114" width="52" height="7" rx="3.5" fill="#3A3A3A" />

      <rect x="440" y="34" width="88" height="36" rx="10" fill="#1B1B1B" stroke="rgba(255,255,255,0.12)" />
      <circle cx="458" cy="52" r="5" fill="#4ED88E" />
      <rect x="470" y="48" width="44" height="7" rx="3.5" fill="#3A3A3A" />
    </svg>
  );
}

const ANALYTICS_BARS = [
  { x: 8, y: 66, h: 46 },
  { x: 38, y: 52, h: 60 },
  { x: 68, y: 74, h: 38 },
  { x: 98, y: 46, h: 66 },
  { x: 128, y: 60, h: 52 },
  { x: 158, y: 36, h: 76, active: true },
  { x: 188, y: 48, h: 64 },
  { x: 218, y: 28, h: 84 },
];

function AnalyticsChart() {
  return (
    <svg width="100%" height="120" viewBox="0 0 240 120" aria-hidden="true">
      {ANALYTICS_BARS.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="18"
          height={bar.h}
          rx="4"
          fill={bar.active ? "rgba(255,92,22,0.55)" : "rgba(255,255,255,0.1)"}
        />
      ))}
      <polyline
        points="8,64 38,52 68,58 98,40 128,44 158,28 188,32 218,16"
        fill="none"
        stroke="#FF8A3C"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FUNNEL_STAGES = [
  { label: "Visited", height: 100, opacity: 0.85 },
  { label: "Engaged", height: 72, opacity: 0.55 },
  { label: "Qualified", height: 44, opacity: 0.32 },
  { label: "Converted", height: 26, opacity: 0.18 },
];

function FunnelBars() {
  return (
    <div className="flex h-[110px] items-end gap-2.5">
      {FUNNEL_STAGES.map((stage) => (
        <div key={stage.label} className="flex h-full flex-1 flex-col justify-end gap-2">
          <div
            className="rounded-lg"
            style={{ height: `${stage.height}%`, background: `rgba(255,138,60,${stage.opacity})` }}
          />
          <div className="text-center text-[11.5px] text-muted">{stage.label}</div>
        </div>
      ))}
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className="mt-14 grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1020px]:grid-cols-3">
      <Reveal className="min-[1020px]:col-span-2">
        <div className={`${CARD} relative overflow-hidden`}>
          <FlowDiagram />
          <h3 className="text-[19px] font-bold">Visual Flow Studio</h3>
          <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">
            Drag nodes, wire branches, and ship the exact conversation you designed. What you see is what runs.
          </p>
        </div>
      </Reveal>

      <Reveal delayMs={80}>
        <div className={CARD}>
          <IconBox>
            <Sparkles size={22} className="text-orange-2" strokeWidth={1.8} />
          </IconBox>
          <h3 className="text-[17px] font-bold">AI-powered replies</h3>
          <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">
            Drop an AI node into any flow and let Meo handle the messy human parts.
          </p>
        </div>
      </Reveal>

      <Reveal delayMs={160}>
        <div className={CARD}>
          <IconBox>
            <User size={22} className="text-orange-2" strokeWidth={1.8} />
          </IconBox>
          <h3 className="text-[17px] font-bold">Lead capture</h3>
          <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">
            Turn conversations into pipeline with built-in forms and CRM webhooks.
          </p>
        </div>
      </Reveal>

      <Reveal delayMs={240} className="min-[1020px]:col-span-2">
        <div className={`${CARD} grid grid-cols-1 items-center gap-5 min-[500px]:grid-cols-2`}>
          <div>
            <h3 className="text-[19px] font-bold">Real-time analytics</h3>
            <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">
              Conversations, resolution rate, and drop-off — live, per bot, per day.
            </p>
          </div>
          <AnalyticsChart />
        </div>
      </Reveal>

      <Reveal delayMs={320} className="min-[1020px]:col-span-3">
        <div className={`${CARD} grid grid-cols-1 items-center gap-8 min-[640px]:grid-cols-[280px_1fr]`}>
          <div>
            <h3 className="text-[19px] font-bold">Conversion funnel</h3>
            <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">
              See exactly where visitors drop off and which node needs work.
            </p>
          </div>
          <FunnelBars />
        </div>
      </Reveal>
    </div>
  );
}
