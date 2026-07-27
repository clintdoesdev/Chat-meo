export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-white/3 p-1 pr-3.5 text-[12.5px] text-[#CFCFCF]">
        <i className="not-italic rounded-full bg-grad-orange px-2.5 py-1 text-[12px] font-semibold text-white">
          Phase 1
        </i>
        Foundation is live
      </span>
      <h1 className="max-w-[15ch] text-[clamp(32px,5.4vw,52px)] font-bold leading-tight tracking-[-0.025em]">
        Intelligent Chatbots. Powered by Meo.
      </h1>
      <p className="max-w-[42ch] text-sm text-muted">
        The Chatmeo landing experience ships in Phase 1, Step 5. This page
        confirms the stack, fonts, and design tokens are wired up.
      </p>
    </main>
  );
}
