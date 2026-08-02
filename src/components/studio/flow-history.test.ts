import { describe, expect, it } from "vitest";
import { createFlowHistoryStore, type FlowSnapshot } from "./flow-history";

function snapshot(label: string): FlowSnapshot {
  return { nodes: [{ id: label } as never], edges: [] };
}

describe("flow history store", () => {
  it("undo returns undefined when there's nothing to undo", () => {
    const store = createFlowHistoryStore();
    expect(store.getState().undo(snapshot("current"))).toBeUndefined();
  });

  it("redo returns undefined when there's nothing to redo", () => {
    const store = createFlowHistoryStore();
    expect(store.getState().redo(snapshot("current"))).toBeUndefined();
  });

  it("undo returns the pushed snapshot and undo/redo round-trips back to the original", () => {
    const store = createFlowHistoryStore();
    const before = snapshot("before-edit");
    const after = snapshot("after-edit");

    store.getState().pushCurrent(before);
    const undone = store.getState().undo(after);
    expect(undone).toEqual(before);

    const redone = store.getState().redo(before);
    expect(redone).toEqual(after);
  });

  it("a new edit after an undo clears the redo stack", () => {
    const store = createFlowHistoryStore();
    const s1 = snapshot("s1");
    const s2 = snapshot("s2");
    const s3 = snapshot("s3");

    store.getState().pushCurrent(s1);
    store.getState().undo(s2);
    expect(store.getState().future).toHaveLength(1);

    store.getState().pushCurrent(s3);
    expect(store.getState().future).toHaveLength(0);
  });

  it("supports multiple undos in sequence", () => {
    const store = createFlowHistoryStore();
    const s1 = snapshot("s1");
    const s2 = snapshot("s2");
    const s3 = snapshot("s3");

    store.getState().pushCurrent(s1);
    store.getState().pushCurrent(s2);

    expect(store.getState().undo(s3)).toEqual(s2);
    expect(store.getState().undo(s2)).toEqual(s1);
    expect(store.getState().undo(s1)).toBeUndefined();
  });
});
