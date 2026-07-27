import { NODE_KIND_META, type FlowNode, type FlowNodeData } from "@/lib/flow-types";

const MODELS = ["claude-sonnet", "claude-haiku", "claude-opus"];

type NodeInspectorProps = {
  node: FlowNode | null;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
};

function fieldClass() {
  return "w-full rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5 text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:border-orange-2/60 focus:outline-none";
}

function labelClass() {
  return "mb-1.5 block text-xs font-semibold text-muted";
}

export function NodeInspector({ node, onChange }: NodeInspectorProps) {
  if (!node || !node.type) {
    return (
      <aside className="border-l border-line bg-[#111] p-4">
        <p className="text-[12.5px] text-muted">
          Select a node to edit its settings, or drag a new one in from the palette.
        </p>
      </aside>
    );
  }

  const meta = NODE_KIND_META[node.type];
  const data = node.data;

  return (
    <aside className="overflow-auto border-l border-line bg-[#111] p-4">
      <h4 className="text-sm font-semibold">{meta.label}</h4>
      <p className="mb-4 text-[11.5px] text-muted">{node.id}</p>

      <div className="mb-3.5">
        <label htmlFor="field-label" className={labelClass()}>
          Label
        </label>
        <input
          id="field-label"
          value={data.label}
          onChange={(event) => onChange(node.id, { label: event.target.value })}
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
            onChange={(event) => onChange(node.id, { text: event.target.value })}
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
              onChange={(event) => onChange(node.id, { systemPrompt: event.target.value })}
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
              onChange={(event) => onChange(node.id, { model: event.target.value })}
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
            <label htmlFor="field-temperature" className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
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
        <div className="mb-3.5">
          <label htmlFor="field-condition" className={labelClass()}>
            Condition
          </label>
          <input
            id="field-condition"
            value={data.condition ?? ""}
            onChange={(event) => onChange(node.id, { condition: event.target.value })}
            placeholder='reply contains "pricing"'
            className={fieldClass()}
          />
        </div>
      )}

      {node.type === "capture" && (
        <>
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
          <div className="mb-3.5">
            <label htmlFor="field-prompt" className={labelClass()}>
              Prompt
            </label>
            <textarea
              id="field-prompt"
              value={data.prompt ?? ""}
              onChange={(event) => onChange(node.id, { prompt: event.target.value })}
              rows={3}
              className={`${fieldClass()} resize-y leading-relaxed`}
            />
          </div>
        </>
      )}

      {node.type === "webhook" && (
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
      )}

      {node.type === "handoff" && (
        <div className="mb-3.5">
          <label htmlFor="field-note" className={labelClass()}>
            Note
          </label>
          <textarea
            id="field-note"
            value={data.note ?? ""}
            onChange={(event) => onChange(node.id, { note: event.target.value })}
            rows={3}
            className={`${fieldClass()} resize-y leading-relaxed`}
          />
        </div>
      )}
    </aside>
  );
}
