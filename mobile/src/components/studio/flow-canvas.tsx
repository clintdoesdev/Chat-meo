import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { NodeInspector } from "@/components/studio/node-inspector";
import {
  NODE_KIND_META,
  NODE_KINDS,
  type FlowEdge,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeKind,
} from "@/lib/flow/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 60;

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
// A finger moving less than this many graph-space units between a node's pan gesture starting
// and ending counts as a tap (opens the inspector) rather than a drag.
const TAP_THRESHOLD = 6;
// Half-extent of the SVG's coordinate space, centered on graph-space (0, 0) — matches the
// modest x/y ranges defaultFlowGraph() and the web Studio editor actually produce (typically a
// few hundred to a couple thousand units). An edge whose endpoints land outside this box simply
// doesn't render — an acceptable v1 limit rather than an unbounded canvas.
const SVG_EXTENT = 4000;

export type FlowCanvasHandle = {
  /** Current nodes and edges, for the screen's Save button to read on demand — see
   * saveFlowForUser's graph shape in src/lib/flow-queries.ts. Deliberately pull-based rather than
   * lifting this state up on every drag frame or keystroke, so editing a node doesn't also
   * re-render the screen that owns the Save button. */
  getNodes: () => FlowNode[];
  getEdges: () => FlowEdge[];
};

type FlowCanvasProps = {
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
};

let nodeIdCounter = 0;
function nextNodeId(kind: FlowNodeKind): string {
  nodeIdCounter += 1;
  return `${kind}-${Date.now()}-${nodeIdCounter}`;
}

/** A pan/pinch-zoomable, drag-to-reposition, tap-to-edit canvas for a bot's flow graph — the
 * mobile counterpart to the web Studio's @xyflow/react-based editor (src/components/studio/
 * studio-editor.tsx). Covers viewing the graph, repositioning/editing/adding/deleting nodes via
 * NodeInspector. Rewiring connections (dragging a new edge between nodes, or deleting one) still
 * needs to happen on the web for now — that interaction needs more room to design well on a
 * touchscreen than this pass had time for, so it's a deliberate, called-out gap rather than a
 * silent one. */
export const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(function FlowCanvas(
  { initialNodes, initialEdges },
  ref,
) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useImperativeHandle(ref, () => ({ getNodes: () => nodes, getEdges: () => edges }), [nodes, edges]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  // A JS-thread mirror of scale.value, kept in sync only at the end of a pinch — node-drag deltas
  // (computed on the JS thread, see handleNodeDragUpdate) need to divide by the current zoom
  // level, and a shared value can't be read synchronously from plain JS code.
  const scaleRef = useRef(1);

  const dragOriginRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const handleNodeDragStart = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node) dragOriginRef.current = { id, x: node.position.x, y: node.position.y };
    },
    [nodes],
  );

  const handleNodeDragUpdate = useCallback((id: string, dx: number, dy: number) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.id !== id) return;
    const s = scaleRef.current;
    setNodes((current) =>
      current.map((n) =>
        n.id === id ? { ...n, position: { x: origin.x + dx / s, y: origin.y + dy / s } } : n,
      ),
    );
  }, []);

  const handleNodeDragEnd = useCallback((id: string, dx: number, dy: number) => {
    dragOriginRef.current = null;
    if (Math.hypot(dx, dy) < TAP_THRESHOLD) setSelectedNodeId(id);
  }, []);

  const handleNodeDataChange = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    setNodes((current) => current.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, []);

  const handleNodeDelete = useCallback((id: string) => {
    setNodes((current) => current.filter((n) => n.id !== id));
    setEdges((current) => current.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  }, []);

  const handleAddNode = useCallback((kind: FlowNodeKind) => {
    const meta = NODE_KIND_META[kind];
    const id = nextNodeId(kind);
    setNodes((current) => [
      ...current,
      {
        id,
        type: kind,
        position: { x: 60 + (current.length % 4) * 40, y: 120 + current.length * 130 },
        data: structuredCloneData(meta.defaultData),
      },
    ]);
    setPickerVisible(false);
    setSelectedNodeId(id);
  }, []);

  const syncScaleRef = useCallback((value: number) => {
    scaleRef.current = value;
  }, []);

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onUpdate((e) => {
          translateX.value = savedTranslateX.value + e.translationX;
          translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }),
    [translateX, translateY, savedTranslateX, savedTranslateY],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          scale.value = clampScale(savedScale.value * e.scale);
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          syncScaleRef(scale.value);
        }),
    [scale, savedScale, syncScaleRef],
  );

  const composedGesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const zoomBy = (factor: number) => {
    const next = clampScale(savedScale.value * factor);
    scale.value = next;
    savedScale.value = next;
    syncScaleRef(next);
  };

  const resetView = () => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    translateX.value = spacing.xl - minX;
    translateY.value = spacing.xl - minY;
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
    scale.value = 1;
    savedScale.value = 1;
    syncScaleRef(1);
  };

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const edgePaths = useMemo(() => {
    return edges
      .map((edge) => {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (!source || !target) return null;
        const sx = source.position.x + NODE_WIDTH / 2;
        const sy = source.position.y + NODE_HEIGHT;
        const tx = target.position.x + NODE_WIDTH / 2;
        const ty = target.position.y;
        const dy = Math.max(40, Math.abs(ty - sy) / 2);
        return { id: edge.id, d: `M ${sx} ${sy} C ${sx} ${sy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}` };
      })
      .filter((p): p is { id: string; d: string } => p !== null);
  }, [edges, nodesById]);

  const selectedNode = selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null;

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.content, contentStyle]}>
            <Svg
              style={[styles.edgeLayer, { left: -SVG_EXTENT, top: -SVG_EXTENT }]}
              width={SVG_EXTENT * 2}
              height={SVG_EXTENT * 2}
              viewBox={`${-SVG_EXTENT} ${-SVG_EXTENT} ${SVG_EXTENT * 2} ${SVG_EXTENT * 2}`}
            >
              {edgePaths.map((path) => (
                <Path key={path.id} d={path.d} stroke={colors.line2} strokeWidth={2} fill="none" />
              ))}
            </Svg>
            {nodes.map((node) => (
              <FlowNodeBox
                key={node.id}
                node={node}
                onDragStart={handleNodeDragStart}
                onDragUpdate={handleNodeDragUpdate}
                onDragEnd={handleNodeDragEnd}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.fabRow}>
        <Pressable style={styles.fab} onPress={() => setPickerVisible(true)}>
          <Text style={styles.fabText}>+ Add node</Text>
        </Pressable>
      </View>

      <View style={styles.zoomControls}>
        <Pressable style={styles.zoomButton} onPress={() => zoomBy(1.25)}>
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
        <Pressable style={styles.zoomButton} onPress={() => zoomBy(0.8)}>
          <Text style={styles.zoomButtonText}>–</Text>
        </Pressable>
        <Pressable style={styles.zoomButton} onPress={resetView}>
          <Text style={styles.zoomButtonTextSmall}>Fit</Text>
        </Pressable>
      </View>

      <NodeInspector
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onSave={handleNodeDataChange}
        onDelete={handleNodeDelete}
      />

      <NodeKindPicker visible={pickerVisible} onClose={() => setPickerVisible(false)} onPick={handleAddNode} />
    </View>
  );
});

function structuredCloneData(data: FlowNodeData): FlowNodeData {
  return JSON.parse(JSON.stringify(data)) as FlowNodeData;
}

function NodeKindPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (kind: FlowNodeKind) => void;
}) {
  const paletteKinds = NODE_KINDS.filter((meta) => meta.inPalette);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <Pressable style={styles.pickerBackdrop} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Add a node</Text>
          <ScrollView contentContainerStyle={styles.pickerList}>
            {paletteKinds.map((meta) => (
              <Pressable key={meta.kind} style={styles.pickerRow} onPress={() => onPick(meta.kind)}>
                <View style={[styles.pickerDot, { backgroundColor: meta.color }]} />
                <View style={styles.pickerRowText}>
                  <Text style={styles.pickerRowTitle}>{meta.label}</Text>
                  <Text style={styles.pickerRowDescription} numberOfLines={2}>
                    {meta.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FlowNodeBox({
  node,
  onDragStart,
  onDragUpdate,
  onDragEnd,
}: {
  node: FlowNode;
  onDragStart: (id: string) => void;
  onDragUpdate: (id: string, dx: number, dy: number) => void;
  onDragEnd: (id: string, dx: number, dy: number) => void;
}) {
  const meta = NODE_KIND_META[node.type];

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onStart(() => {
          // These handlers run as worklets on the UI thread by default — runOnJS hops back to the
          // JS thread, since onDragStart/onDragUpdate/onDragEnd ultimately call setState.
          runOnJS(onDragStart)(node.id);
        })
        .onUpdate((e) => {
          runOnJS(onDragUpdate)(node.id, e.translationX, e.translationY);
        })
        .onEnd((e) => {
          runOnJS(onDragEnd)(node.id, e.translationX, e.translationY);
        }),
    [node.id, onDragStart, onDragUpdate, onDragEnd],
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.node,
          { left: node.position.x, top: node.position.y, width: NODE_WIDTH, borderColor: meta.color + "55" },
        ]}
      >
        <View style={[styles.nodeAccent, { backgroundColor: meta.color }]} />
        <View style={styles.nodeBody}>
          <Text style={styles.nodeKind} numberOfLines={1}>
            {meta.label}
          </Text>
          <Text style={styles.nodeLabel} numberOfLines={2}>
            {node.data.label}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  edgeLayer: {
    position: "absolute",
  },
  node: {
    position: "absolute",
    flexDirection: "row",
    borderRadius: radius.cardSm,
    borderWidth: 1,
    backgroundColor: colors.card2,
    overflow: "hidden",
  },
  nodeAccent: {
    width: 4,
  },
  nodeBody: {
    flex: 1,
    padding: spacing.sm + 2,
    gap: 2,
  },
  nodeKind: {
    color: colors.muted,
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  nodeLabel: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  fabRow: {
    position: "absolute",
    left: spacing.lg,
    bottom: spacing.xl,
  },
  fab: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: {
    color: colors.white,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
  zoomControls: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    gap: spacing.sm,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomButtonText: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    lineHeight: 20,
  },
  zoomButtonTextSmall: {
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 10.5,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  pickerSheet: {
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  pickerTitle: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  pickerList: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.cardSm,
    backgroundColor: colors.card2,
  },
  pickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  pickerRowText: {
    flex: 1,
    gap: 2,
  },
  pickerRowTitle: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 13.5,
  },
  pickerRowDescription: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 15,
  },
});
