import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavBackIcon } from "@/components/icons";
import { FlowCanvas, type FlowCanvasHandle } from "@/components/studio/flow-canvas";
import { ApiError } from "@/lib/api/client";
import { getFlow, saveFlow } from "@/lib/api/endpoints";
import type { FlowGraph } from "@/lib/flow/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** The mobile Flow Studio canvas for one bot — loads its flow graph via GET /api/v1/bots/[id]/flow
 * (src/app/api/v1/bots/[id]/flow/route.ts) and saves node position changes back via the same
 * route's PATCH, sharing the exact validation/ownership logic the web Studio editor's own saveFlow
 * Server Action uses (src/lib/flow-queries.ts). */
export default function FlowStudioScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const router = useRouter();
  const canvasRef = useRef<FlowCanvasHandle>(null);

  const [flowId, setFlowId] = useState<string | null>(null);
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getFlow(botId);
      setFlowId(response.flowId);
      setGraph(response.graph);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach Chatmeo — check your connection.");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave() {
    if (!flowId || !graph || saving) return;
    const nodes = canvasRef.current?.getNodes() ?? graph.nodes;
    const nextGraph: FlowGraph = { nodes, edges: graph.edges };
    setSaving(true);
    setSavedJustNow(false);
    try {
      const result = await saveFlow(botId, flowId, nextGraph);
      if (result.error) {
        setError(result.error);
      } else {
        setGraph(nextGraph);
        setError(null);
        setSavedJustNow(true);
        setTimeout(() => setSavedJustNow(false), 2000);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <NavBackIcon size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Flow</Text>
        <Pressable
          onPress={handleSave}
          disabled={!graph || saving}
          style={[styles.saveButton, (!graph || saving) && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>{savedJustNow ? "Saved" : "Save"}</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.orange2} />
        </View>
      ) : error && !graph ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : graph ? (
        <>
          <Text style={styles.hint}>Drag a node to move it · pinch to zoom · Save when you&apos;re done</Text>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
          <FlowCanvas ref={canvasRef} initialNodes={graph.nodes} edges={graph.edges} />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 18,
  },
  saveButton: {
    minWidth: 72,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: "center",
  },
  hint: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  inlineError: {
    color: colors.bad,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
