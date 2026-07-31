import { usePaletteDragHandle, type PaletteDragCallbacks } from "@/components/studio/use-palette-drag-handle";
import { PALETTE_KINDS } from "@/lib/flow-types";

function PaletteChip({
  meta,
  callbacks,
}: {
  meta: (typeof PALETTE_KINDS)[number];
  callbacks: PaletteDragCallbacks;
}) {
  const handlers = usePaletteDragHandle(meta.kind, callbacks);

  return (
    <div
      {...handlers}
      className="flex shrink-0 cursor-grab touch-pan-x items-center gap-2.5 whitespace-nowrap rounded-[13px]
        border border-line bg-card px-3 py-2.5 text-[13px] font-medium transition select-none
        hover:-translate-x-0 hover:border-orange-2/50 active:cursor-grabbing
        min-[1020px]:mb-2 min-[1020px]:touch-auto min-[1020px]:whitespace-normal min-[1020px]:hover:-translate-x-0.5"
    >
      <i className="h-2 w-2 flex-shrink-0 rounded-[3px]" style={{ background: meta.color }} />
      {meta.label}
    </div>
  );
}

export function NodePalette({ dragCallbacks }: { dragCallbacks: PaletteDragCallbacks }) {
  return (
    <aside
      className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-[#111] p-3
        min-[1020px]:w-[216px] min-[1020px]:flex-col min-[1020px]:gap-0 min-[1020px]:overflow-y-auto
        min-[1020px]:overflow-x-hidden min-[1020px]:border-b-0 min-[1020px]:border-r min-[1020px]:p-3.5"
    >
      <div
        className="hidden shrink-0 self-center text-[11px] font-semibold uppercase tracking-[.14em] text-muted
          min-[1020px]:mb-2.5 min-[1020px]:block min-[1020px]:self-auto"
      >
        Nodes
      </div>
      {PALETTE_KINDS.map((meta) => (
        <PaletteChip key={meta.kind} meta={meta} callbacks={dragCallbacks} />
      ))}
    </aside>
  );
}
