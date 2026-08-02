import { NodeInfoButton } from "@/components/studio/node-info-button";
import { NODE_KIND_ICON } from "@/components/studio/node-icons";
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
  const Icon = NODE_KIND_ICON[meta.kind];

  return (
    <div
      {...handlers}
      className="flex shrink-0 cursor-grab touch-pan-x items-center gap-2.5 whitespace-nowrap rounded-[13px]
        border border-line bg-card px-3 py-2.5 text-[13px] font-medium transition select-none
        hover:-translate-x-0 hover:border-orange-2/50 active:cursor-grabbing
        min-[1020px]:mb-2 min-[1020px]:touch-auto min-[1020px]:whitespace-normal min-[1020px]:hover:-translate-x-0.5"
    >
      <span
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[8px]"
        style={{ background: `${meta.color}26`, color: meta.color }}
      >
        <Icon size={13} />
      </span>
      <span className="flex-1">{meta.label}</span>
      <NodeInfoButton label={meta.label} description={meta.description} />
    </div>
  );
}

export function NodePalette({ dragCallbacks }: { dragCallbacks: PaletteDragCallbacks }) {
  return (
    <aside
      className="hidden shrink-0 gap-2 border-b border-line bg-[#111] p-3
        min-[1020px]:flex min-[1020px]:w-[216px] min-[1020px]:flex-col min-[1020px]:gap-0 min-[1020px]:overflow-y-auto
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
