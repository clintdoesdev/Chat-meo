"use client";

import { createContext, useContext } from "react";

type StudioNodeActions = {
  /** Long-press (or right-click) on a node opens its details/settings sheet. */
  openDetails: (id: string) => void;
};

export const StudioNodeActionsContext = createContext<StudioNodeActions | null>(null);

export function useStudioNodeActions(): StudioNodeActions {
  const ctx = useContext(StudioNodeActionsContext);
  if (!ctx) throw new Error("useStudioNodeActions must be used within StudioNodeActionsContext");
  return ctx;
}
