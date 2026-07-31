import { X } from "lucide-react";
import { MeoMark } from "@/components/meo-mark";
import {
  NODE_KIND_META,
  type AiModel,
  type ConditionBranch,
  type FlowNode,
  type FlowNodeData,
  type WebhookMethod,
} from "@/lib/flow-types";

const MODELS: AiModel[] = ["claude-sonnet", "claude-haiku"];
const WEBHOOK_METHODS: WebhookMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

type NodeInspectorProps = {
  node: FlowNode | null;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
  onClose: () => void;
};

function fieldClass() {
  return "w-full rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5 text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none";
}

function labelClass() {
  return "mb-1.5 block text-xs font-semibold text-muted";
}

const sheetPositionClass =
  "fixed inset-x-0 bottom-0 z-[80] max-h-[65vh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] " +
  "transition-transform duration-300 ease-out min-[1020px]:static min-[1020px]:z-auto min-[1020px]:max-h-none " +
  "min-[1020px]:w-[260px] min-[1020px]:shrink-0 min-[1020px]:translate-y-0 min-[1020px]:rounded-t-none " +
  "min-[1020px]:border-t-0 min-[1020px]:border-l min-[1020px]:pb-0";

export function NodeInspector({ node, onChange, onClose }: NodeInspectorProps) {
  if (!node || !node.type) {
    return (
      <aside
        className={`${sheetPositionClass} translate-y-full border-line bg-[#111] p-4 min-[1020px]:translate-y-0`}
      >
        <div className="flex flex-col items-center gap-2.5 py-6 text-center min-[1020px]:py-10">
          <MeoMark size={28} />
          <p className="text-[12.5px] text-muted">Select a node to edit it</p>
        </div>
      </aside>
    );
  }

  const meta = NODE_KIND_META[node.type];
  const data = node.data;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[75] bg-black/50 min-[1020px]:hidden"
      />
      <aside
        className={`${sheetPositionClass} translate-y-0 overflow-auto border-line bg-[#111] p-4`}
      >
        <div className="mb-3 flex items-center justify-between min-[1020px]:hidden">
          <span className="h-1 w-9 rounded-full bg-white/15" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        <h4 className="text-sm font-semibold">{meta.label}</h4>
        <p className="mb-4 text-[11.5px] text-muted">{node.id}</p>

        <div className="mb-3.5">
          <label htmlFor="field-label" className={labelClass()}>
            Label
          </label>
          <input
            id="field-label"
            value={data.label}
            onChange={(event) =>
              onChange(node.id, { label: event.target.value })
            }
            className={fieldClass()}
          />
        </div>

        {(node.type === "start" || node.type === "message") && (
          <div className="mb-3.5">
            <label htmlFor="field-text" className={labelClass()}>
              Message
            </label>
            <textarea
              id="field-text"
              value={data.text ?? ""}
              onChange={(event) =>
                onChange(node.id, { text: event.target.value })
              }
              rows={4}
              className={`${fieldClass()} resize-y leading-relaxed`}
            />
          </div>
        )}

        {node.type === "ai" && (
          <>
            <div className="mb-3.5">
              <label htmlFor="field-system-prompt" className={labelClass()}>
                System prompt
              </label>
              <textarea
                id="field-system-prompt"
                value={data.systemPrompt ?? ""}
                onChange={(event) =>
                  onChange(node.id, { systemPrompt: event.target.value })
                }
                rows={4}
                className={`${fieldClass()} resize-y leading-relaxed`}
              />
            </div>
            <div className="mb-3.5">
              <label htmlFor="field-model" className={labelClass()}>
                Model
              </label>
              <select
                id="field-model"
                value={data.model ?? "claude-sonnet"}
                onChange={(event) =>
                  onChange(node.id, { model: event.target.value as AiModel })
                }
                className={fieldClass()}
              >
                {MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3.5">
              <label
                htmlFor="field-temperature"
                className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted"
              >
                Creativity
                <span className="font-semibold text-orange-2">
                  {(data.temperature ?? 0.35).toFixed(2)}
                </span>
              </label>
              <input
                id="field-temperature"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={data.temperature ?? 0.35}
                onChange={(event) =>
                  onChange(node.id, { temperature: Number(event.target.value) })
                }
                className="w-full accent-orange"
              />
            </div>
          </>
        )}

        {node.type === "condition" && (
          <>
            <div className="mb-3.5">
              <label htmlFor="field-variable" className={labelClass()}>
                Variable
              </label>
              <input
                id="field-variable"
                value={data.variable ?? ""}
                onChange={(event) => onChange(node.id, { variable: event.target.value })}
                placeholder="last_message"
                className={fieldClass()}
              />
            </div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className={labelClass().replace("mb-1.5 ", "")}>Branches</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {(data.branches ?? []).map((branch, index) => (
                <div key={branch.id} className="rounded-[12px] border border-line-2 bg-card-2 p-2.5">
                  <input
                    aria-label={`Branch ${index + 1} label`}
                    value={branch.label}
                    onChange={(event) => {
                      const next: ConditionBranch[] = [...(data.branches ?? [])];
                      next[index] = { ...branch, label: event.target.value };
                      onChange(node.id, { branches: next });
                    }}
                    placeholder="Branch label"
                    className="mb-1.5 w-full bg-transparent text-[12.5px] font-medium text-text placeholder:text-[#5C5C5C] focus:outline-none"
                  />
                  <input
                    aria-label={`Branch ${index + 1} value`}
                    value={branch.value}
                    onChange={(event) => {
                      const next: ConditionBranch[] = [...(data.branches ?? [])];
                      next[index] = { ...branch, value: event.target.value };
                      onChange(node.id, { branches: next });
                    }}
                    placeholder="Match value"
                    className="w-full bg-transparent text-[11.5px] text-muted placeholder:text-[#5C5C5C] focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {node.type === "capture" && (
          <>
            <div className="mb-3.5">
              <label htmlFor="field-question" className={labelClass()}>
                Question
              </label>
              <textarea
                id="field-question"
                value={data.question ?? ""}
                onChange={(event) => onChange(node.id, { question: event.target.value })}
                rows={3}
                className={`${fieldClass()} resize-y leading-relaxed`}
              />
            </div>
            <div className="mb-3.5">
              <label htmlFor="field-variable-name" className={labelClass()}>
                Variable name
              </label>
              <input
                id="field-variable-name"
                value={data.variableName ?? ""}
                onChange={(event) => onChange(node.id, { variableName: event.target.value })}
                className={fieldClass()}
              />
            </div>
          </>
        )}

        {node.type === "webhook" && (
          <>
            <div className="mb-3.5">
              <label htmlFor="field-method" className={labelClass()}>
                Method
              </label>
              <select
                id="field-method"
                value={data.method ?? "POST"}
                onChange={(event) =>
                  onChange(node.id, { method: event.target.value as WebhookMethod })
                }
                className={fieldClass()}
              >
                {WEBHOOK_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3.5">
              <label htmlFor="field-url" className={labelClass()}>
                URL
              </label>
              <input
                id="field-url"
                value={data.url ?? ""}
                onChange={(event) => onChange(node.id, { url: event.target.value })}
                placeholder="https://"
                className={fieldClass()}
              />
            </div>
          </>
        )}

        {node.type === "handoff" && (
          <div className="mb-3.5">
            <label htmlFor="field-note" className={labelClass()}>
              Note
            </label>
            <textarea
              id="field-note"
              value={data.note ?? ""}
              onChange={(event) =>
                onChange(node.id, { note: event.target.value })
              }
              rows={3}
              className={`${fieldClass()} resize-y leading-relaxed`}
            />
          </div>
        )}
      </aside>
    </>
  );
}
