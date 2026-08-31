import { useRef, useState } from "react";
import { ActionsCloseIcon, ActionsPlusIcon, ActionsTrashIcon, ActionsUploadIcon } from "@/components/icons";
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
  type LogicRule,
  type ReplyVariant,
  type WebhookMethod,
} from "@/lib/flow-types";

/** The AI node's provider setting defaults to xai visually until a value is explicitly saved —
 * same tie-break defaultProviderId() in src/lib/ai/providers.ts uses when AI_PROVIDER is unset,
 * so an untouched node's picker matches what it'd actually resolve to at runtime. */
function effectiveProviderId(raw: string | undefined): ProviderId {
  return raw && isProviderId(raw) ? raw : "xai";
}

// Catches prompts that have a fake transcript pasted into them (often copied from another
// platform's template) — the engine already feeds real conversation history to the model as
// separate messages (see toOpenAiMessages in src/engine/llm.ts), so a hardcoded "User: ...
// Bot: ..." block in the system prompt itself is always redundant, wastes tokens, and can even
// nudge the model to echo that exact scripted exchange back to real visitors.
const TRANSCRIPT_PATTERN = /current conversation:|^\s*(user|visitor|customer)\s*:/im;

function looksLikeHardcodedTranscript(prompt: string): boolean {
  return TRANSCRIPT_PATTERN.test(prompt);
}

function newBranchId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `branch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Deliberately NOT crypto.randomUUID() (unlike newBranchId below, which is never echoed back by
// an LLM): a Logic rule's id gets sent to and echoed back by the semantic-match classifier (see
// classifySemanticMatch in engine/executor.ts) — a 36-character UUID's hex runs tokenize into
// far more tokens than this shorter id does, eating into the classifier's already-small response
// budget for no benefit, since uniqueness only needs to hold within one Logic node's rule list.
function newRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newVariantId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const WEBHOOK_METHODS: WebhookMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Looser than the Bot avatar upload's 200KB (src/components/app/bot-settings-modal.tsx) — a
// Reply node's image is the actual message content shown to visitors/customers, not a small
// profile thumbnail, so it's worth allowing real photo-quality uploads. No blob storage in this
// app, so this becomes a `data:` URI embedded straight into the flow graph's JSON — see
// FlowGraphSchema's imageDataUri cap in src/lib/flow-schema.ts, sized to match this, and
// WhatsApp's own 5MB image message limit, which this stays safely under.
const MAX_REPLY_IMAGE_BYTES = 2 * 1024 * 1024;

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

/** Shared "delay before sending" control for every non-AI node kind that can send something to
 * the visitor (Start/Message/Logic/Capture/Link/Handoff) — an AI node's own reply is never
 * delayed this way since its content and timing already come from the model call itself, and a
 * Reply node keeps its own copy of this field further down since its inspector panel already has
 * a dedicated spot with a Reply-specific hint. Mirrors MAX_NODE_DELAY_SECONDS in
 * engine/executor.ts. */
function DelayField({
  nodeId,
  value,
  onChange,
  hint,
}: {
  nodeId: string;
  value: number | undefined;
  onChange: (id: string, patch: Partial<FlowNodeData>) => void;
  hint: string;
}) {
  const fieldId = `field-${nodeId}-delay`;
  return (
    <div className="mb-3.5">
      <label htmlFor={fieldId} className={labelClass()}>
        Delay before sending (seconds)
      </label>
      <input
        id={fieldId}
        type="number"
        min={0}
        max={120}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(nodeId, { delaySeconds: raw === "" ? undefined : Math.max(0, Math.min(120, Number(raw))) });
        }}
        placeholder="Instant"
        className={fieldClass()}
      />
      <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

const sheetPositionClass =
  "fixed inset-x-0 bottom-0 z-[80] max-h-[65vh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] " +
  "transition-transform duration-300 ease-out min-[1020px]:static min-[1020px]:z-auto min-[1020px]:max-h-none " +
  "min-[1020px]:w-[260px] min-[1020px]:shrink-0 min-[1020px]:translate-y-0 min-[1020px]:rounded-t-none " +
  "min-[1020px]:border-t-0 min-[1020px]:border-l min-[1020px]:pb-0";

export function NodeInspector({ node, flowId, onChange, onClose, onRequestDelete }: NodeInspectorProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  function handleReplyImageFile(nodeId: string, file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_REPLY_IMAGE_BYTES) {
      setImageError("That image is too large — try one under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(nodeId, { imageDataUri: reader.result as string });
    reader.onerror = () => setImageError("Couldn't read that file — try another image.");
    reader.readAsDataURL(file);
  }

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

        {(node.type === "start" || node.type === "message" || node.type === "reply") && (
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
            <p className="mt-1.5 text-[11px] text-muted">
              Use <code className="rounded bg-white/[.06] px-1 py-0.5 text-[10.5px]">{"{{variableName}}"}</code> to
              insert something a Capture node saved earlier — e.g. a Capture node saving to
              &quot;name&quot; means <code className="rounded bg-white/[.06] px-1 py-0.5 text-[10.5px]">{"{{name}}"}</code> here.
              Typed plainly (like &quot;name&quot; in quotes) it&apos;s sent as literal text instead.
            </p>
          </div>
        )}

        {(node.type === "start" || node.type === "message") && (
          <DelayField
            nodeId={node.id}
            value={data.delaySeconds}
            onChange={onChange}
            hint="Pauses this long, like a realistic typing delay, before this message goes out. Leave blank to send instantly."
          />
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
              {looksLikeHardcodedTranscript(data.systemPrompt ?? "") ? (
                <p className="mt-1.5 text-[11px] text-orange-2">
                  This looks like it has a fake conversation pasted in — the actual conversation
                  is already sent to the AI automatically, so you can remove that part. Leaving it
                  in wastes tokens and can make the AI repeat that exact scripted exchange.
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted">
                  Just describe how the AI should behave — the real conversation so far is
                  included automatically, so there&apos;s no need to write it into this prompt. Use{" "}
                  <code className="rounded bg-white/[.06] px-1 py-0.5 text-[10.5px]">{"{{variableName}}"}</code> to
                  insert something a Capture node saved earlier.
                </p>
              )}
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
            <div className="mb-3.5">
              <label htmlFor="field-max-replies" className={labelClass()}>
                Max replies before handoff
              </label>
              <input
                id="field-max-replies"
                type="number"
                min={1}
                max={50}
                value={data.maxReplies ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  onChange(node.id, {
                    maxReplies: raw === "" ? undefined : Math.max(1, Math.min(50, Number(raw))),
                  });
                }}
                placeholder="Unlimited"
                className={fieldClass()}
              />
              <p className="mt-1.5 text-[11px] text-muted">
                After this many back-and-forth replies with nothing resolved, the AI stops
                replying freely. If a Logic node is attached below, its rules stay active and can
                still reply or route (e.g. a payment confirmation) — otherwise the conversation
                quietly hands to a human, no &quot;you&apos;re being transferred&quot; message, it
                just goes quiet and shows up in your Inbox. Leave blank for unlimited.
              </p>
            </div>
            <KnowledgeUpload flowId={flowId} nodeId={node.id} />
          </>
        )}

        {node.type === "reply" && (
          <>
            <div className="mb-3.5">
              <label className={labelClass()}>Image</label>
              <div className="flex items-center gap-2.5">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line-2 bg-card-2">
                  {data.imageDataUri ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize it
                    <img src={data.imageDataUri} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ActionsUploadIcon size={14} className="text-muted" />
                  )}
                </span>
                <input
                  ref={imageFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleReplyImageFile(node.id, event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => imageFileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-full border border-line-2 bg-card-2 px-3 py-2 text-[12px] font-semibold text-text transition hover:border-orange-2/50"
                >
                  <ActionsUploadIcon size={13} />
                  {data.imageDataUri ? "Replace" : "Upload"}
                </button>
                {data.imageDataUri && (
                  <button
                    type="button"
                    onClick={() => onChange(node.id, { imageDataUri: undefined })}
                    className="rounded-full border border-line-2 px-3 py-2 text-[12px] font-semibold text-muted transition hover:border-bad/50 hover:text-bad"
                  >
                    Remove
                  </button>
                )}
              </div>
              {imageError && <p className="mt-1.5 text-[11px] text-bad">{imageError}</p>}
              <p className="mt-1.5 text-[11px] text-muted">
                Sends with the Message below as its caption — or, if the message is too long to
                fit as a caption, the image goes out first and the full message follows as its
                own message right after. Leave unset to send text only.
              </p>
            </div>

            <div className="mb-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className={labelClass().replace("mb-1.5 ", "")}>Extra message variants</span>
                <button
                  type="button"
                  onClick={() => {
                    const next: ReplyVariant[] = [...(data.variants ?? []), { id: newVariantId(), text: "" }];
                    onChange(node.id, { variants: next });
                  }}
                  className="flex items-center gap-1 rounded-full border border-line-2 px-2.5 py-1 text-[10.5px] font-semibold text-muted transition hover:border-orange-2/50 hover:text-text"
                >
                  <ActionsPlusIcon size={11} />
                  Add
                </button>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-muted">
                Each send randomly picks one of these, or the Message above, instead of always
                sending the exact same wording — an author-written alternative to (or combined
                with) &quot;Vary wording&quot; below for cutting the risk of repeated sends
                looking like an identical broadcast. Leave empty to always send the Message above.
              </p>
              <div className="flex flex-col gap-2.5">
                {(data.variants ?? []).map((variant, index) => (
                  <div key={variant.id} className="relative rounded-[12px] border border-line-2 bg-card-2 p-2.5 pr-8">
                    <textarea
                      aria-label={`Variant ${index + 1} message`}
                      value={variant.text}
                      onChange={(event) => {
                        const next: ReplyVariant[] = [...(data.variants ?? [])];
                        next[index] = { ...variant, text: event.target.value };
                        onChange(node.id, { variants: next });
                      }}
                      placeholder="Alternate wording for this message"
                      rows={2}
                      className="w-full resize-y bg-transparent text-[12.5px] text-text placeholder:text-[#5C5C5C] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (data.variants ?? []).filter((v) => v.id !== variant.id);
                        onChange(node.id, { variants: next });
                      }}
                      aria-label={`Remove variant ${index + 1}`}
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-bad"
                    >
                      <ActionsCloseIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-3.5 flex items-center justify-between gap-3 rounded-[13px] border border-line-2 bg-card-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-text">Vary wording with AI</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  Sends the message above, lightly reworded each time (same meaning, different
                  phrasing) so repeated sends don&apos;t look like an identical copy-pasted
                  broadcast. Nothing about what&apos;s actually said ever changes, and if a
                  rewording attempt ever fails, the message above is sent exactly as written.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(data.randomizeWording)}
                onClick={() => onChange(node.id, { randomizeWording: !data.randomizeWording })}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition ${
                  data.randomizeWording
                    ? "bg-grad-orange text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
                    : "border border-line-2 bg-card-2 text-muted"
                }`}
              >
                {data.randomizeWording ? "On" : "Off"}
              </button>
            </div>

            {data.randomizeWording && (
              <>
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
                  <label htmlFor="field-reply-model" className={labelClass()}>
                    Model
                  </label>
                  <ModelPicker
                    id="field-reply-model"
                    provider={effectiveProviderId(data.provider)}
                    value={data.model ?? ""}
                    onChange={(modelId) => onChange(node.id, { model: modelId })}
                  />
                </div>
              </>
            )}

            <div className="mb-3.5">
              <label htmlFor="field-reply-delay" className={labelClass()}>
                Delay before sending (seconds)
              </label>
              <input
                id="field-reply-delay"
                type="number"
                min={0}
                max={120}
                value={data.delaySeconds ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  onChange(node.id, {
                    delaySeconds: raw === "" ? undefined : Math.max(0, Math.min(120, Number(raw))),
                  });
                }}
                placeholder="Instant"
                className={fieldClass()}
              />
              <p className="mt-1.5 text-[11px] text-muted">
                Pauses this long, like a realistic typing delay, before this node&apos;s message
                goes out — still triggered by the visitor&apos;s own message, up to 120 seconds.
                Leave blank to send instantly. This node only ever sends its message once per
                visit; after that it waits for an attached Logic node&apos;s rules to match, or
                quietly hands off to a human.
              </p>
            </div>
          </>
        )}

        {node.type === "logic" && (
          <>
            <p className="mb-3 rounded-lg border border-line-2 bg-card-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
              Attach this to an AI node&apos;s bottom dot. Each turn, the visitor&apos;s message is
              checked against your rules&apos; triggers — first for a literal match, then, if
              nothing hits, the AI checks whether it means the same thing even if it&apos;s
              worded completely differently, using the conversation so far to make sense of short
              replies like &quot;done&quot; or &quot;yes&quot;. So &quot;I have made
              payments&quot; as a trigger will also catch &quot;just sent the money over&quot; —
              you don&apos;t need to list every phrasing. When two rules could sound related (one
              asks for a payment link, another confirms a payment&apos;s already been made), the
              AI leans on each rule&apos;s reply text to tell them apart — so a clear, specific
              reply helps it pick the right rule, not just the customer. A rule that has a reply
              and/or a route wins and skips the AI for that turn; a rule with no triggers matches
              anything, so it&apos;s a good catch-all — but leave both its reply and route blank
              and it&apos;s a no-op, so the AI still handles that turn normally. A literal match
              right next to a word like &quot;don&apos;t&quot; or &quot;not&quot; (e.g.
              &quot;I don&apos;t want a payment&quot; against a trigger of
              &quot;payment&quot;) doesn&apos;t count as confident either — that also falls
              through to the AI, which actually understands what&apos;s being said instead of
              just spotting the word. In a reply, use{" "}
              <code className="rounded bg-white/[.06] px-1 py-0.5 text-[10.5px]">{"{{variableName}}"}</code>{" "}
              to insert something a Capture node saved earlier — typed plainly in quotes, it&apos;s
              sent as literal text instead.
            </p>
            <div className="mb-1.5 flex items-center justify-between">
              <span className={labelClass().replace("mb-1.5 ", "")}>Rules</span>
              <button
                type="button"
                onClick={() => {
                  const next: LogicRule[] = [
                    ...(data.rules ?? []),
                    { id: newRuleId(), label: "New rule", triggers: "", reply: "" },
                  ];
                  onChange(node.id, { rules: next });
                }}
                className="flex items-center gap-1 rounded-full border border-line-2 px-2.5 py-1 text-[10.5px] font-semibold text-muted transition hover:border-orange-2/50 hover:text-text"
              >
                <ActionsPlusIcon size={11} />
                Add
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {(data.rules ?? []).map((rule, index) => (
                <div key={rule.id} className="relative rounded-[12px] border border-line-2 bg-card-2 p-2.5 pr-8">
                  <input
                    aria-label={`Rule ${index + 1} label`}
                    value={rule.label}
                    onChange={(event) => {
                      const next: LogicRule[] = [...(data.rules ?? [])];
                      next[index] = { ...rule, label: event.target.value };
                      onChange(node.id, { rules: next });
                    }}
                    placeholder="Rule label"
                    className="mb-1.5 w-full bg-transparent text-[12.5px] font-medium text-text placeholder:text-[#5C5C5C] focus:outline-none"
                  />
                  <input
                    aria-label={`Rule ${index + 1} triggers`}
                    value={rule.triggers}
                    onChange={(event) => {
                      const next: LogicRule[] = [...(data.rules ?? [])];
                      next[index] = { ...rule, triggers: event.target.value };
                      onChange(node.id, { rules: next });
                    }}
                    placeholder="e.g. I have made payments (similar phrasing counts too; blank = anything)"
                    className="mb-1.5 w-full bg-transparent text-[11.5px] text-muted placeholder:text-[#5C5C5C] focus:outline-none"
                  />
                  <textarea
                    aria-label={`Rule ${index + 1} reply`}
                    value={rule.reply}
                    onChange={(event) => {
                      const next: LogicRule[] = [...(data.rules ?? [])];
                      next[index] = { ...rule, reply: event.target.value };
                      onChange(node.id, { rules: next });
                    }}
                    placeholder="Reply to send — {{name}} inserts a captured value (blank = just route, no reply)"
                    rows={2}
                    className="w-full resize-y bg-transparent text-[11.5px] text-text placeholder:text-[#5C5C5C] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (data.rules ?? []).filter((r) => r.id !== rule.id);
                      onChange(node.id, { rules: next });
                    }}
                    aria-label={`Remove rule ${index + 1}`}
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-muted transition hover:bg-white/[.06] hover:text-bad"
                  >
                    <ActionsCloseIcon size={12} />
                  </button>
                </div>
              ))}
              {(data.rules ?? []).length === 0 && (
                <p className="text-[11.5px] text-muted">No rules yet — add one above.</p>
              )}
            </div>
            <DelayField
              nodeId={node.id}
              value={data.delaySeconds}
              onChange={onChange}
              hint="Pauses this long before whichever rule's reply fires — applies whether this Logic node is wired directly into the flow or attached to an AI/Reply node."
            />
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
            <DelayField
              nodeId={node.id}
              value={data.delaySeconds}
              onChange={onChange}
              hint="Pauses this long before asking this question. Leave blank to send instantly."
            />
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

        {node.type === "link" && (
          <>
            <div className="mb-3.5">
              <label htmlFor="field-link-text" className={labelClass()}>
                Link text
              </label>
              <input
                id="field-link-text"
                value={data.linkText ?? ""}
                onChange={(event) => onChange(node.id, { linkText: event.target.value })}
                placeholder="e.g. Book a call"
                className={fieldClass()}
              />
            </div>
            <div className="mb-3.5">
              <label htmlFor="field-link-url" className={labelClass()}>
                URL
              </label>
              <input
                id="field-link-url"
                value={data.url ?? ""}
                onChange={(event) => onChange(node.id, { url: event.target.value })}
                placeholder="https://"
                className={fieldClass()}
              />
            </div>
            <DelayField
              nodeId={node.id}
              value={data.delaySeconds}
              onChange={onChange}
              hint="Pauses this long before sending the link. Leave blank to send instantly."
            />
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
            <DelayField
              nodeId={node.id}
              value={data.delaySeconds}
              onChange={onChange}
              hint="Pauses this long before the handoff message goes out (web widget only — WhatsApp never shows one). Leave blank to send instantly."
            />
          </div>
        )}

        {node.type === "silentHandoff" && (
          <div className="mb-3.5">
            <p className="mb-3 rounded-lg border border-line-2 bg-card-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
              The bot just stops here — the customer isn’t shown anything, unlike a regular
              Handoff. Good right after a Logic rule (or a Message node) already sent what the
              customer needed, and you&apos;d rather take it from there yourself.
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
