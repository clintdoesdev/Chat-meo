import type {
  ConditionBranch,
  EngineDeps,
  EngineOutput,
  EngineState,
  FlowEdge,
  FlowGraph,
  FlowNode,
  LlmChatMessage,
  Reply,
} from "./types";

const MAX_HOPS_PER_STEP = 25;
const WEBHOOK_TIMEOUT_MS = 5000;
const HANDOFF_MESSAGE = "Your message is being sent to a live team to assist you.";
const LOOP_GUARD_MESSAGE = "Something went wrong on our end — let's start over.";

/** A fresh conversation, positioned at the flow's Start node (or immediately ended if the
 * graph has none — the Studio always seeds one, but we don't want to crash on bad data). */
export function createInitialState(graph: FlowGraph): EngineState {
  const start = graph.nodes.find((node) => node.type === "start");
  return {
    currentNodeId: start?.id ?? null,
    variables: {},
    status: start ? "RUNNING" : "ENDED",
  };
}

function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
  );
}

function findNode(graph: FlowGraph, id: string | null): FlowNode | undefined {
  if (!id) return undefined;
  return graph.nodes.find((node) => node.id === id);
}

/** The single outgoing edge for any node type except condition (which uses branch handles). */
function nextEdge(graph: FlowGraph, nodeId: string): FlowEdge | undefined {
  return graph.edges.find((edge) => edge.source === nodeId);
}

function edgeForBranch(graph: FlowGraph, nodeId: string, branchId: string): FlowEdge | undefined {
  return graph.edges.find((edge) => edge.source === nodeId && edge.sourceHandle === branchId);
}

/** Contains-match against a variable's value, falling back to an empty-value "else" branch,
 * then to the first branch — so a condition node always resolves to *some* branch. */
function matchBranch(branches: ConditionBranch[], rawValue: string): ConditionBranch | undefined {
  const value = rawValue.toLowerCase();
  return (
    branches.find((branch) => branch.value !== "" && value.includes(branch.value.toLowerCase())) ??
    branches.find((branch) => branch.value === "") ??
    branches[0]
  );
}

async function callWebhook(
  url: string,
  variables: Record<string, string>,
  deps: EngineDeps,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables, conversationId: deps.conversationId }),
      signal: controller.signal,
    });
  } catch (error) {
    deps.logger.error("Webhook call failed", { url, error });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Advances the conversation from its current node until it needs visitor input (capture),
 * terminates (handoff, dead end, loop guard), or runs out of graph to walk. A single call can
 * traverse several nodes, accumulating every reply produced along the way.
 */
export async function step(
  graph: FlowGraph,
  state: EngineState,
  input: string | undefined,
  deps: EngineDeps,
): Promise<EngineOutput> {
  if (state.status === "ENDED" || state.status === "HANDOFF") {
    return { replies: [], state };
  }

  const variables = { ...state.variables };
  const replies: Reply[] = [];
  const history: LlmChatMessage[] = [];
  let currentNodeId = state.currentNodeId;
  let status: EngineState["status"] = "RUNNING";

  if (state.status === "AWAITING_INPUT") {
    const captureNode = findNode(graph, currentNodeId);
    if (!captureNode || captureNode.type !== "capture") {
      return { replies: [], state: { ...state, status: "ENDED" } };
    }
    if (input === undefined) {
      return { replies: [], state };
    }
    variables[captureNode.data.variableName] = input;
    history.push({ role: "user", content: input });
    const edge = nextEdge(graph, captureNode.id);
    if (!edge) {
      return { replies: [], state: { currentNodeId: null, variables, status: "ENDED" } };
    }
    currentNodeId = edge.target;
  } else if (input !== undefined) {
    history.push({ role: "user", content: input });
  }

  let hops = 0;
  let walking = true;

  while (walking && currentNodeId) {
    if (hops >= MAX_HOPS_PER_STEP) {
      deps.logger.error("Engine loop guard triggered", { currentNodeId });
      replies.push({ content: LOOP_GUARD_MESSAGE });
      status = "ENDED";
      currentNodeId = null;
      break;
    }
    hops += 1;

    const node = findNode(graph, currentNodeId);
    if (!node) {
      status = "ENDED";
      currentNodeId = null;
      break;
    }

    switch (node.type) {
      case "start": {
        const edge = nextEdge(graph, node.id);
        currentNodeId = edge?.target ?? null;
        if (!edge) status = "ENDED";
        break;
      }

      case "message": {
        const text = interpolate(node.data.text ?? "", variables);
        replies.push({ content: text });
        history.push({ role: "assistant", content: text });
        const edge = nextEdge(graph, node.id);
        currentNodeId = edge?.target ?? null;
        if (!edge) status = "ENDED";
        break;
      }

      case "ai": {
        const systemPrompt = interpolate(node.data.systemPrompt ?? "", variables);
        let content: string;
        try {
          content = await deps.llm({
            systemPrompt,
            history,
            temperature: node.data.temperature,
            model: node.data.model,
          });
        } catch (error) {
          deps.logger.error("LLM call failed", error);
          content = "Sorry, I couldn't come up with a reply just now.";
        }
        replies.push({ content });
        history.push({ role: "assistant", content });
        const edge = nextEdge(graph, node.id);
        currentNodeId = edge?.target ?? null;
        if (!edge) status = "ENDED";
        break;
      }

      case "capture": {
        const question = interpolate(node.data.question ?? "", variables);
        replies.push({ content: question });
        status = "AWAITING_INPUT";
        currentNodeId = node.id;
        walking = false;
        break;
      }

      case "condition": {
        const matched = matchBranch(node.data.branches ?? [], variables[node.data.variable] ?? "");
        if (!matched) {
          status = "ENDED";
          currentNodeId = null;
          break;
        }
        const edge = edgeForBranch(graph, node.id, matched.id);
        currentNodeId = edge?.target ?? null;
        if (!edge) status = "ENDED";
        break;
      }

      case "webhook": {
        await callWebhook(node.data.url, variables, deps);
        const edge = nextEdge(graph, node.id);
        currentNodeId = edge?.target ?? null;
        if (!edge) status = "ENDED";
        break;
      }

      case "handoff": {
        // node.data.note is an internal note for the human teammate, not customer-facing —
        // the customer always sees the same fixed message, and only on our own web widget.
        if ((deps.channel ?? "web") === "web") {
          replies.push({ content: HANDOFF_MESSAGE });
        }
        status = "HANDOFF";
        currentNodeId = null;
        walking = false;
        break;
      }

      default: {
        status = "ENDED";
        currentNodeId = null;
        walking = false;
      }
    }
  }

  return { replies, state: { currentNodeId, variables, status } };
}
