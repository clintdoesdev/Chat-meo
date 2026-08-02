import { ActionsCloseIcon, ActionsPlusIcon, ActionsTrashIcon } from "@/components/icons";
import { MeoMark } from "@/components/meo-mark";
import { KnowledgeUpload } from "@/components/studio/knowledge-upload";
import { ModelPicker } from "@/components/studio/model-picker";
import { PillSelect } from "@/components/studio/pill-select";
import { isProviderId, PROVIDERS, type ProviderId } from "@/lib/ai/providers";
import {
  NODE_KIND_META,
  type ConditionBranch,
  type FlowNode,
  type FlowNodeData,
  type WebhookMethod,
} from "@/lib/flow-types";

/** The AI node's provider setting defaults to xai visually until a value is explicitly saved —
 * same tie-break defaultProviderId() in src/lib/ai/providers.ts uses when AI_PROVIDER is unset,
 * so an untouched node's picker matches what it'd actually resolve to at runtime. */
function effectiveProviderId(raw: string | undefined): ProviderId {
  return raw && isProviderId(raw) ? raw : "xai";
}

function newBranchId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `branch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const WEBHOOK_METHODS: WebhookMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

type NodeInspectorProps = {
  node: FlowNode | null;
  flowId: string;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
  onClose: () => void;
  onRequestDelete: () => void;
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

export function NodeInspector({ node, flowId, onChange, onClose, onRequestDelete }: NodeInspectorProps) {
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
            <ActionsCloseIcon size={16} />
          </button>
        </div>

        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold">{meta.label}</h4>
            <p className="text-[11.5px] text-muted">{node.id}</p>
          </div>
          {node.deletable !== false && (
            <button
              type="button"
              data-fx-skip
              onClick={onRequestDelete}
              aria-label={`Delete ${meta.label}`}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bad/15 text-bad transition hover:bg-bad/25"
            >
              <ActionsTrashIcon size={15} />
            </button>
          )}
        </div>

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
                rows={5}
                className={`${fieldClass()} resize-y font-mono text-[13px] leading-relaxed`}
              />
            </div>
            <div className="mb-3.5">
              <label className={labelClass()}>Provider</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(PROVIDERS).map((provider) => {
                  const active = effectiveProviderId(data.provider) === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() =>
                        onChange(node.id, { provider: provider.id, model: provider.defaultModel })
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        active
                          ? "border-orange-2/50 bg-orange/10 text-text"
                          : "border-line-2 bg-card-2 text-muted hover:text-text"
                      }`}
                    >
                      {provider.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mb-3.5">
              <label htmlFor="field-model" className={labelClass()}>
                Model
              </label>
              <ModelPicker
                id="field-model"
                provider={effectiveProviderId(data.provider)}
                value={data.model ?? ""}
                onChange={(modelId) => onChange(node.id, { model: modelId })}
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Live models for the selected provider — search to filter, or type a custom model id.
              </p>
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
            <KnowledgeUpload flowId={flowId} nodeId={node.id} />
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
              <button
                type="button"
                onClick={() => {
                  const next: ConditionBranch[] = [
                    ...(data.branches ?? []),
                    { id: newBranchId(), label: "New branch", value: "" },
                  ];
                  onChange(node.id, { branches: next });
                }}
                className="flex items-center gap-1 rounded-full border border-line-2 px-2.5 py-1 text-[10.5px] font-semibold text-muted transition hover:border-orange-2/50 hover:text-text"
              >
                <ActionsPlusIcon size={11} />
                Add
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {(data.branches ?? []).map((branch, index) => (
                <div
                  key={branch.id}
                  className="relative rounded-[12px] border border-line-2 bg-card-2 p-2.5 pr-8"
                >
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
                  <button
                    type="button"
                    onClick={() => {
                      const next = (data.branches ?? []).filter((b) => b.id !== branch.id);
                      onChange(node.id, { branches: next });
                    }}
                    aria-label={`Remove branch ${index + 1}`}
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-bad"
                  >
                    <ActionsCloseIcon size={12} />
                  </button>
                </div>
              ))}
              {(data.branches ?? []).length === 0 && (
                <p className="text-[11.5px] text-muted">No branches yet — add one above.</p>
              )}
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
              <PillSelect
                id="field-method"
                value={data.method ?? "POST"}
                onChange={(event) =>
                  onChange(node.id, { method: event.target.value as WebhookMethod })
                }
              >
                {WEBHOOK_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </PillSelect>
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
            <p className="mb-3 rounded-lg border border-line-2 bg-card-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
              Customers on the web widget always see: “Your message is being sent to a live team
              to assist you.” — this isn’t editable here.
            </p>
            <label htmlFor="field-note" className={labelClass()}>
              Internal note
            </label>
            <textarea
              id="field-note"
              value={data.note ?? ""}
              onChange={(event) =>
                onChange(node.id, { note: event.target.value })
              }
              rows={3}
              placeholder="For your team only — why this conversation is being handed off."
              className={`${fieldClass()} resize-y leading-relaxed`}
            />
          </div>
        )}
      </aside>
    </>
  );
}
