import { TriangleAlert, X } from "lucide-react";

export function ValidationBanner({ issues, onDismiss }: { issues: string[]; onDismiss: () => void }) {
  if (issues.length === 0) return null;

  return (
    <div className="absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-start gap-2.5 rounded-[13px] border border-orange-2/30 bg-[#1A1108]/95 px-3.5 py-2.5 text-[12px] text-[#F2C89B] shadow-[0_16px_40px_-18px_rgba(0,0,0,.9)] backdrop-blur">
      <TriangleAlert size={15} className="mt-0.5 flex-shrink-0 text-orange-2" />
      <p className="leading-snug">{issues.join(" · ")}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[#F2C89B]/70 transition hover:bg-white/[.08] hover:text-[#F2C89B]"
      >
        <X size={13} />
      </button>
    </div>
  );
}
