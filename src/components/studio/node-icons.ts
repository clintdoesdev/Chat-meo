import type { ComponentType } from "react";
import {
  NodesActionIcon,
  NodesAiIcon,
  NodesConditionIcon,
  NodesHandoffIcon,
  NodesMessageIcon,
  NodesQuestionIcon,
  type IconProps,
} from "@/components/icons";
import type { FlowNodeKind } from "@/lib/flow-types";

/** Maps each flow node kind to its palette/canvas icon — kept apart from flow-types.ts, which
 * stays framework/UI-free since the engine also imports from it. */
export const NODE_KIND_ICON: Record<FlowNodeKind, ComponentType<IconProps>> = {
  start: NodesMessageIcon,
  message: NodesMessageIcon,
  ai: NodesAiIcon,
  condition: NodesConditionIcon,
  capture: NodesQuestionIcon,
  webhook: NodesActionIcon,
  handoff: NodesHandoffIcon,
};
