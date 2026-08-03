"use client";

import { createContext, useContext } from "react";

/** nodeId -> a short, human-readable reason that node isn't fully usable yet (missing a
 * required field, a condition branch with nowhere to go, not connected to Start, ...). Read by
 * FlowNodeView to show a small warning badge directly on the node — see computeNodeIssues in
 * studio-editor.tsx for the actual rules. */
export const NodeIssuesContext = createContext<Record<string, string>>({});

export function useNodeIssue(nodeId: string): string | undefined {
  return useContext(NodeIssuesContext)[nodeId];
}
