import { createStore } from "zustand";
import type { FlowEdge, FlowNode } from "@/lib/flow-types";

export type FlowSnapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const MAX_HISTORY = 50;

type HistoryState = {
  stack: FlowSnapshot[];
  pushCurrent: (snapshot: FlowSnapshot) => void;
  popPrevious: () => FlowSnapshot | undefined;
};

/** One store instance per open editor — created via useState(() => createFlowHistoryStore())
 * so undo history never leaks between different bots' flows. */
export function createFlowHistoryStore() {
  return createStore<HistoryState>((set, get) => ({
    stack: [],
    pushCurrent: (snapshot) =>
      set((state) => ({ stack: [...state.stack, snapshot].slice(-MAX_HISTORY) })),
    popPrevious: () => {
      const { stack } = get();
      if (stack.length === 0) return undefined;
      const previous = stack[stack.length - 1];
      set({ stack: stack.slice(0, -1) });
      return previous;
    },
  }));
}

export type FlowHistoryStore = ReturnType<typeof createFlowHistoryStore>;
