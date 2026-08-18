import type { ComponentType } from "react";
import {
  ActionsLinkIcon,
  CommsSendIcon,
  NodesActionIcon,
  NodesAiIcon,
  NodesConditionIcon,
  NodesHandoffIcon,
  NodesLogicIcon,
  NodesMessageIcon,
  NodesQuestionIcon,
  NodesSilentHandoffIcon,
  type IconProps,
} from "@/components/icons";
import type { FlowNodeKind } from "@/lib/flow-types";

/** Maps each flow node kind to its palette/canvas icon — kept apart from flow-types.ts, which
 * stays framework/UI-free since the engine also imports from it. */
export const NODE_KIND_ICON: Record<FlowNodeKind, ComponentType<IconProps>> = {
  start: NodesMessageIcon,
  message: NodesMessageIcon,
  ai: NodesAiIcon,
  reply: CommsSendIcon,
  condition: NodesConditionIcon,
  capture: NodesQuestionIcon,
  webhook: NodesActionIcon,
  handoff: NodesHandoffIcon,
  silentHandoff: NodesSilentHandoffIcon,
  link: ActionsLinkIcon,
  logic: NodesLogicIcon,
};
