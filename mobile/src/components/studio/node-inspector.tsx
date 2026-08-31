import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { NODE_KIND_META, type ConditionBranch, type FlowNode, type FlowNodeData, type LogicRule, type ReplyVariant } from "@/lib/flow/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Mobile counterpart to the web Studio's node-inspector.tsx — a per-node-kind editor, rendered
 * as a bottom-sheet-style Modal rather than a side panel (no room for one on a phone). Covers the
 * scalar fields every kind has (text, delay, note, url, …) plus a compact editor for each kind's
 * one list field (Logic's rules, Condition's branches, Reply's variants). Every change calls
 * onSave immediately — there's no separate "apply" step, matching how the web inspector's own
 * onChange callback works (src/components/studio/node-inspector.tsx). */
export function NodeInspector({
  node,
  onClose,
  onSave,
  onDelete,
}: {
  node: FlowNode | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
}) {
  const visible = node !== null;
  const meta = node ? NODE_KIND_META[node.type] : null;
  const canDelete = node ? node.type !== "start" : false;

  function patch(p: Partial<FlowNodeData>) {
    if (node) onSave(node.id, p);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.overlayBackdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {node && meta && (
            <>
              <View style={styles.header}>
                <View style={[styles.kindDot, { backgroundColor: meta.color }]} />
                <Text style={styles.kindLabel}>{meta.label}</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Text style={styles.closeText}>Done</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
                <TextField label="Label" value={node.data.label} onChange={(v) => patch({ label: v })} />

                {(node.type === "start" || node.type === "message") && (
                  <>
                    <TextField
                      label="Message"
                      value={node.data.text ?? ""}
                      onChange={(v) => patch({ text: v })}
                      multiline
                    />
                    <DelayField value={node.data.delaySeconds} onChange={(v) => patch({ delaySeconds: v })} />
                  </>
                )}

                {node.type === "ai" && (
                  <>
                    <TextField
                      label="System prompt"
                      value={node.data.systemPrompt ?? ""}
                      onChange={(v) => patch({ systemPrompt: v })}
                      multiline
                    />
                    <TextField label="Model" value={node.data.model ?? ""} onChange={(v) => patch({ model: v })} />
                    <NumberField
                      label="Temperature"
                      value={node.data.temperature}
                      onChange={(v) => patch({ temperature: v })}
                      min={0}
                      max={2}
                      step={0.05}
                    />
                    <NumberField
                      label="Max replies before handoff (0 = unlimited)"
                      value={node.data.maxReplies}
                      onChange={(v) => patch({ maxReplies: v })}
                      min={0}
                      max={50}
                    />
                  </>
                )}

                {node.type === "reply" && (
                  <>
                    <TextField label="Message" value={node.data.text ?? ""} onChange={(v) => patch({ text: v })} multiline />
                    <ToggleField
                      label="Vary wording (AI paraphrase)"
                      value={node.data.randomizeWording ?? false}
                      onChange={(v) => patch({ randomizeWording: v })}
                    />
                    <VariantsField
                      variants={node.data.variants ?? []}
                      onChange={(variants) => patch({ variants })}
                    />
                    <DelayField value={node.data.delaySeconds} onChange={(v) => patch({ delaySeconds: v })} />
                  </>
                )}

                {node.type === "logic" && (
                  <>
                    <RulesField rules={node.data.rules ?? []} onChange={(rules) => patch({ rules })} />
                    <DelayField value={node.data.delaySeconds} onChange={(v) => patch({ delaySeconds: v })} />
                  </>
                )}

                {node.type === "condition" && (
                  <>
                    <TextField label="Variable" value={node.data.variable ?? ""} onChange={(v) => patch({ variable: v })} />
                    <BranchesField branches={node.data.branches ?? []} onChange={(branches) => patch({ branches })} />
                  </>
                )}

                {node.type === "capture" && (
                  <>
                    <TextField label="Question" value={node.data.question ?? ""} onChange={(v) => patch({ question: v })} multiline />
                    <TextField
                      label="Save as variable"
                      value={node.data.variableName ?? ""}
                      onChange={(v) => patch({ variableName: v })}
                    />
                    <DelayField value={node.data.delaySeconds} onChange={(v) => patch({ delaySeconds: v })} />
                  </>
                )}

                {node.type === "webhook" && (
                  <>
                    <TextField label="URL" value={node.data.url ?? ""} onChange={(v) => patch({ url: v })} />
                    <TextField label="Method" value={node.data.method ?? "POST"} onChange={(v) => patch({ method: v as FlowNodeData["method"] })} />
                  </>
                )}

                {node.type === "link" && (
                  <>
                    <TextField label="Link text" value={node.data.linkText ?? ""} onChange={(v) => patch({ linkText: v })} />
                    <TextField label="URL" value={node.data.url ?? ""} onChange={(v) => patch({ url: v })} />
                    <DelayField value={node.data.delaySeconds} onChange={(v) => patch({ delaySeconds: v })} />
                  </>
                )}

                {(node.type === "handoff" || node.type === "silentHandoff") && (
                  <>
                    <TextField label="Note" value={node.data.note ?? ""} onChange={(v) => patch({ note: v })} multiline />
                    {node.type === "handoff" && (
                      <DelayField value={node.data.delaySeconds} onChange={(v) => patch({ delaySeconds: v })} />
                    )}
                  </>
                )}

                {canDelete ? (
                  <Pressable style={styles.deleteButton} onPress={() => onDelete(node.id)}>
                    <Text style={styles.deleteText}>Delete node</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.startHint}>The Start node can&apos;t be deleted.</Text>
                )}
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value === undefined ? "" : String(value)}
        onChangeText={(text) => {
          if (text === "") {
            onChange(undefined);
            return;
          }
          const parsed = Number(text);
          if (!Number.isNaN(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
        }}
        keyboardType="numeric"
        placeholder={step < 1 ? "0.0" : "0"}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.card2, true: colors.orange }} thumbColor={colors.white} />
    </View>
  );
}

function DelayField({ value, onChange }: { value: number | undefined; onChange: (value: number | undefined) => void }) {
  return <NumberField label="Delay before sending (seconds)" value={value} onChange={onChange} min={0} max={120} />;
}

function RulesField({ rules, onChange }: { rules: LogicRule[]; onChange: (rules: LogicRule[]) => void }) {
  function update(index: number, patch: Partial<LogicRule>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }
  function remove(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...rules, { id: `rule-${Date.now()}`, label: "New rule", triggers: "", reply: "" }]);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Rules</Text>
      {rules.map((rule, index) => (
        <View key={rule.id} style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <TextInput
              value={rule.label}
              onChangeText={(v) => update(index, { label: v })}
              placeholder="Rule name"
              placeholderTextColor={colors.muted}
              style={styles.listCardTitleInput}
            />
            <Pressable onPress={() => remove(index)} hitSlop={8}>
              <Text style={styles.listCardRemove}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            value={rule.triggers}
            onChangeText={(v) => update(index, { triggers: v })}
            placeholder="Triggers, comma separated"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={rule.reply}
            onChangeText={(v) => update(index, { reply: v })}
            placeholder="Reply (leave blank to only route)"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.inputMultiline, styles.listCardSpacing]}
          />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={add}>
        <Text style={styles.addButtonText}>+ Add rule</Text>
      </Pressable>
    </View>
  );
}

function BranchesField({ branches, onChange }: { branches: ConditionBranch[]; onChange: (branches: ConditionBranch[]) => void }) {
  function update(index: number, patch: Partial<ConditionBranch>) {
    onChange(branches.map((branch, i) => (i === index ? { ...branch, ...patch } : branch)));
  }
  function remove(index: number) {
    onChange(branches.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...branches, { id: `branch-${Date.now()}`, label: "New branch", value: "" }]);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Branches</Text>
      {branches.map((branch, index) => (
        <View key={branch.id} style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <TextInput
              value={branch.label}
              onChangeText={(v) => update(index, { label: v })}
              placeholder="Branch label"
              placeholderTextColor={colors.muted}
              style={styles.listCardTitleInput}
            />
            <Pressable onPress={() => remove(index)} hitSlop={8}>
              <Text style={styles.listCardRemove}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            value={branch.value}
            onChangeText={(v) => update(index, { value: v })}
            placeholder="Value to match (blank = else)"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={add}>
        <Text style={styles.addButtonText}>+ Add branch</Text>
      </Pressable>
    </View>
  );
}

function VariantsField({ variants, onChange }: { variants: ReplyVariant[]; onChange: (variants: ReplyVariant[]) => void }) {
  function update(index: number, text: string) {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, text } : variant)));
  }
  function remove(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...variants, { id: `variant-${Date.now()}`, text: "" }]);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Extra message variants</Text>
      {variants.map((variant, index) => (
        <View key={variant.id} style={styles.listCardRow}>
          <TextInput
            value={variant.text}
            onChangeText={(v) => update(index, v)}
            placeholder="Alternate wording"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.inputMultiline, { flex: 1 }]}
          />
          <Pressable onPress={() => remove(index)} hitSlop={8} style={styles.listCardRowRemove}>
            <Text style={styles.listCardRemove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={add}>
        <Text style={styles.addButtonText}>+ Add variant</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kindLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
  },
  closeText: {
    color: colors.orange2,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  body: {
    paddingHorizontal: spacing.lg,
  },
  bodyContent: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: fontFamily.medium,
    fontSize: 12,
  },
  input: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.card2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listCard: {
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: spacing.sm + 2,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  listCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  listCardTitleInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
    paddingVertical: 2,
  },
  listCardRemove: {
    color: colors.bad,
    fontSize: 14,
  },
  listCardSpacing: {
    marginTop: 0,
  },
  listCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  listCardRowRemove: {
    paddingTop: spacing.sm,
  },
  addButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.card2,
  },
  addButtonText: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(255,87,87,0.3)",
  },
  deleteText: {
    color: colors.bad,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  startHint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textAlign: "center",
  },
});
