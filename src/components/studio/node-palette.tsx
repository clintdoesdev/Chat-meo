import { PALETTE_KINDS } from "@/lib/flow-types";

export function NodePalette() {
  return (
    <aside className="overflow-auto border-r border-line bg-[#111] p-3.5">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">
        Nodes
      </div>
      {PALETTE_KINDS.map((meta) => (
        <div
          key={meta.kind}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("application/chatmeo-node-kind", meta.kind);
            event.dataTransfer.effectAllowed = "move";
          }}
          className="mb-2 flex cursor-grab items-center gap-2.5 rounded-[13px] border border-line bg-card px-3 py-2.5 text-[13px] font-medium transition hover:-translate-x-0.5 hover:border-orange-2/50 active:cursor-grabbing"
        >
          <i className="h-2 w-2 flex-shrink-0 rounded-[3px]" style={{ background: meta.color }} />
          {meta.label}
        </div>
      ))}
    </aside>
  );
}
