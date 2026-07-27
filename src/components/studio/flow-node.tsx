import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_KIND_META, type FlowNode, type FlowNodeData, type FlowNodeKind } from "@/lib/flow-types";

function previewText(data: FlowNodeData, kind?: FlowNodeKind): string {
  switch (kind) {
    case "start":
    case "message":
      return data.text || "No message set";
    case "ai":
      return data.systemPrompt || "No system prompt set";
    case "condition":
      return data.condition || "No condition set";
    case "capture":
      return data.prompt || "No prompt set";
    case "webhook":
      return data.url || "No URL set";
    case "handoff":
      return data.note || "No note set";
    default:
      return "";
  }
}

export function FlowNodeView({ data, selected, type }: NodeProps<FlowNode>) {
  const meta = type ? NODE_KIND_META[type] : undefined;
  const color = meta?.color ?? "#FF5C16";

  return (
    <div
      className="w-[186px] rounded-[14px] border bg-[#161616] p-3 text-[12px] shadow-[0_16px_40px_-18px_rgba(0,0,0,.9)]"
      style={{
        borderColor: selected ? "#FF8A3C" : "rgba(255,255,255,.12)",
        boxShadow: selected
          ? "0 0 0 3px rgba(255,110,40,.18), 0 16px 40px -18px rgba(0,0,0,.9)"
          : undefined,
      }}
    >
      {type !== "start" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-[9px] !w-[9px] !border-2 !border-[#0C0C0C]"
          style={{ background: color }}
        />
      )}
      <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold">
        <i className="h-2 w-2 flex-shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="truncate">{data.label || meta?.label}</span>
      </div>
      <p className="line-clamp-2 text-[11px] text-muted">{previewText(data, type)}</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-[9px] !w-[9px] !border-2 !border-[#0C0C0C]"
        style={{ background: color }}
      />
    </div>
  );
}
