import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_KIND_META, type FlowNode, type FlowNodeData, type FlowNodeKind } from "@/lib/flow-types";

const HANDLE_COLOR = "#FF5C16";
const HANDLE_CLASS = "!h-[9px] !w-[9px] !border-2 !border-[#0C0C0C]";

function previewText(data: FlowNodeData, kind?: FlowNodeKind): string {
  switch (kind) {
    case "start":
    case "message":
      return data.text || "No message set";
    case "ai":
      return data.systemPrompt || "No system prompt set";
    case "capture":
      return data.question || "No question set";
    case "webhook":
      return data.url ? `${data.method ?? "POST"} ${data.url}` : "No URL set";
    case "handoff":
      return data.note || "No note set";
    default:
      return "";
  }
}

export function FlowNodeView({ data, selected, type }: NodeProps<FlowNode>) {
  const meta = type ? NODE_KIND_META[type] : undefined;
  const color = meta?.color ?? "#FF5C16";
  const branches = type === "condition" ? (data.branches ?? []) : [];

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
          className={HANDLE_CLASS}
          style={{ background: HANDLE_COLOR }}
        />
      )}

      <div className="mb-1 flex items-center gap-2 text-[12px] font-bold">
        <i
          className="h-2 w-2 flex-shrink-0 rounded-[3px]"
          style={{
            background: color,
            boxShadow: type === "ai" ? `0 0 8px 1px ${color}` : undefined,
          }}
        />
        <span className="truncate">{data.label || meta?.label}</span>
      </div>

      {type === "condition" ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {branches.length === 0 && <p className="text-[11px] text-muted">No branches set</p>}
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="relative flex items-center justify-between gap-2 rounded-[8px] bg-white/[.04] py-1 pl-2 pr-3 text-[11px]"
            >
              <span className="truncate text-muted">{branch.label || "Untitled branch"}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={branch.id}
                className={`${HANDLE_CLASS} !right-[-17px] !top-1/2 !-translate-y-1/2`}
                style={{ background: HANDLE_COLOR, position: "absolute" }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="line-clamp-2 text-[11px] text-muted">{previewText(data, type)}</p>
      )}

      {type !== "handoff" && type !== "condition" && (
        <Handle
          type="source"
          position={Position.Right}
          className={HANDLE_CLASS}
          style={{ background: HANDLE_COLOR }}
        />
      )}
    </div>
  );
}
