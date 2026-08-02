import { createStore } from "zustand";
import type { FlowEdge, FlowNode } from "@/lib/flow-types";

export type FlowSnapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

const MAX_HISTORY = 50;

type HistoryState = {
  past: FlowSnapshot[];
  future: FlowSnapshot[];
  /** Records `snapshot` (the state right before an edit) as the new undo point, and clears the
   * redo stack — same convention as every other undo/redo implementation: making a fresh edit
   * after undoing invalidates whatever "future" that undo had rewound past. */
  pushCurrent: (snapshot: FlowSnapshot) => void;
  /** Pops the most recent undo point, pushes `current` onto the redo stack so it can be redone,
   * and returns the popped snapshot — or undefined if there's nothing to undo. */
  undo: (current: FlowSnapshot) => FlowSnapshot | undefined;
  /** Symmetric with undo: pops the most recent redo point, pushes `current` back onto the undo
   * stack, and returns the popped snapshot — or undefined if there's nothing to redo. */
  redo: (current: FlowSnapshot) => FlowSnapshot | undefined;
};

/** One store instance per open editor — created via useState(() => createFlowHistoryStore())
 * so undo/redo history never leaks between different bots' flows. */
export function createFlowHistoryStore() {
  return createStore<HistoryState>((set, get) => ({
    past: [],
    future: [],
    pushCurrent: (snapshot) =>
      set((state) => ({ past: [...state.past, snapshot].slice(-MAX_HISTORY), future: [] })),
    undo: (current) => {
      const { past, future } = get();
      if (past.length === 0) return undefined;
      const previous = past[past.length - 1];
      set({ past: past.slice(0, -1), future: [...future, current].slice(-MAX_HISTORY) });
      return previous;
    },
    redo: (current) => {
      const { past, future } = get();
      if (future.length === 0) return undefined;
      const next = future[future.length - 1];
      set({ future: future.slice(0, -1), past: [...past, current].slice(-MAX_HISTORY) });
      return next;
    },
  }));
}

export type FlowHistoryStore = ReturnType<typeof createFlowHistoryStore>;
