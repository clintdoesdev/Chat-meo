import type {
  ConditionBranch,
  EngineDeps,
  EngineOutput,
  EngineState,
  FlowEdge,
  FlowGraph,
  FlowNode,
  LlmChatMessage,
  LlmUsage,
  LogicRule,
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

/** The single "what comes next in the conversation" outgoing edge for any node type except
 * condition (which uses branch handles). Explicitly excludes an AI node's "logic" handle edge —
 * that one only ever points at an attached Logic node's rule-matching, never at the next
 * conversational step, so it must never be mistaken for one here (the "ai" case already
 * consults it directly, before this is called). */
function nextEdge(graph: FlowGraph, nodeId: string): FlowEdge | undefined {
  return graph.edges.find((edge) => edge.source === nodeId && edge.sourceHandle !== "logic");
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

/** Contains-match against a Logic rule's comma-separated keywords — the free, instant first
 * pass. Deliberately excludes the empty-triggers catch-all (see catchAllRule below); the "ai"
 * case only falls back to that after also trying a semantic match, so the two need to stay
 * separate rather than one function silently covering both. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchLogicKeyword(rules: LogicRule[], rawMessage: string): LogicRule | undefined {
  const message = rawMessage.toLowerCase();
  return rules.find((rule) => {
    const keywords = rule.triggers
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);
    // Word-boundary, not raw substring — a plain .includes() would let trigger "payment" match
    // inside "payments", "repayment", "prepayment", etc., firing the rule for messages that
    // aren't actually asking for what the trigger describes (e.g. "I've made payments" —
    // already-paid, a different intent entirely — matching a "wants a payment link" trigger).
    return keywords.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(message));
  });
}

function catchAllRule(rules: LogicRule[]): LogicRule | undefined {
  return rules.find((rule) => rule.triggers.trim() === "");
}

/** Keyword match, falling back to the catch-all rule (same convention as ConditionBranch's
 * empty value) — used by the standalone "logic" case, which (unlike an AI-attached Logic node,
 * see classifySemanticMatch) has no LLM of its own to run a semantic pass with. Unlike
 * matchBranch, a Logic node with nothing that matches and no catch-all rule returns undefined
 * rather than falling back to the first rule — "no rule applies" needs to be distinguishable
 * from "the first rule applies". */
function matchLogicRule(rules: LogicRule[], rawMessage: string): LogicRule | undefined {
  return matchLogicKeyword(rules, rawMessage) ?? catchAllRule(rules);
}

const NONE_TOKEN = "NONE";

function buildClassifierPrompt(rules: LogicRule[]): string {
  const lines = rules.map((rule) => {
    // The trigger text alone is often a bare keyword list ("payment, invoice, pay now,
    // checkout") that doesn't read as a specific request on its own — the rule's configured
    // reply is what actually reveals what it's FOR (asking the customer to pay vs. confirming
    // they already have), so it's included whenever set as the real disambiguating signal
    // between rules that share vocabulary but mean opposite things.
    const purpose = rule.reply.trim()
      ? ` — this rule is for when the customer needs this specific thing, and firing it replies: "${rule.reply.trim()}"`
      : "";
    return `- id: ${rule.id} — triggers on messages meaning the same as: "${rule.triggers}"${purpose}`;
  });
  return (
    "You are a strict intent classifier for a customer support chat bot. Decide whether the " +
    "customer's LATEST message expresses the SAME SPECIFIC REQUEST as one of the rules below — " +
    "different wording is fine (customers phrase the same request many different ways), but the " +
    "underlying request must genuinely be the same one, not just related or on the same topic. " +
    "Use each rule's reply text (below) to understand what it actually means, not just its " +
    "trigger phrase — two rules can share vocabulary (\"payment\") while meaning opposite things " +
    "(requesting a payment link vs. confirming a payment already happened) and must not be " +
    "confused for each other. Use the conversation so far to understand what the latest message " +
    "actually refers to — a short reply like \"done\", \"yes\", or \"just did\" only makes sense " +
    "in light of what was just discussed.\n\n" +
    `Rules:\n${lines.join("\n")}\n\n` +
    `Respond with ONLY the matching rule's id exactly as written above, or the single word ` +
    `${NONE_TOKEN} if none clearly and specifically applies. When in doubt, respond ${NONE_TOKEN} — ` +
    "a missed match just means the AI answers normally, but a wrong match sends the customer an " +
    "incorrect canned reply. No punctuation, no explanation, nothing else."
  );
}

/** Semantic fallback for matchLogicRule's keyword pass, used only when attached to an AI node
 * (see the "ai" case) — only called once the keyword pass finds nothing, and only against rules
 * that actually have triggers text to compare meaning against (an empty-triggers catch-all is
 * unconditional and needs no classifying). Takes the real conversation so far (not just the
 * latest message in isolation) so a short, context-dependent reply can be resolved against what
 * was actually being discussed — the same priorHistory merging run-turn.ts/run-test-turn.ts
 * already do for the main `llm` dependency applies here too (see EngineDeps.classify). Never
 * throws: a classifier failure — bad key, network error, a garbled response — just means "no
 * semantic match", falling through exactly like a keyword miss would rather than breaking the
 * turn. */
async function classifySemanticMatch(
  rules: LogicRule[],
  history: LlmChatMessage[],
  deps: EngineDeps,
  model: string,
  provider: string | undefined,
): Promise<LogicRule | undefined> {
  const candidates = rules.filter((rule) => rule.triggers.trim() !== "");
  if (candidates.length === 0) return undefined;

  try {
    const result = await deps.classify({
      systemPrompt: buildClassifierPrompt(candidates),
      history,
      temperature: 0,
      model,
      provider,
    });
    const answer = result.content.trim();
    return candidates.find((rule) => rule.id === answer);
  } catch (error) {
    deps.logger.error("[engine] Logic rule classification failed", error);
    return undefined;
  }
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
    deps.logger.error("[engine] Webhook call failed", { url, error });
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
  let lastError: string | undefined;

  if (state.status === "AWAITING_INPUT") {
    const waitingNode = findNode(graph, currentNodeId);
    // Capture nodes wait to store the answer into a variable and move on; AI nodes with
    // nowhere to go next (see the "ai" case below) wait to keep the conversation itself going —
    // the visitor's next message just re-runs the same AI node with the reply already in
    // history. Anything else waiting is unexpected persisted state; end rather than loop.
    if (!waitingNode || (waitingNode.type !== "capture" && waitingNode.type !== "ai")) {
      return { replies: [], state: { ...state, status: "ENDED" } };
    }
    if (input === undefined) {
      return { replies: [], state };
    }
    history.push({ role: "user", content: input });
    if (waitingNode.type === "capture") {
      variables[waitingNode.data.variableName] = input;
      const edge = nextEdge(graph, waitingNode.id);
      if (!edge) {
        return { replies: [], state: { currentNodeId: null, variables, status: "ENDED" } };
      }
      currentNodeId = edge.target;
    } else {
      currentNodeId = waitingNode.id;
    }
  } else if (input !== undefined) {
    history.push({ role: "user", content: input });
  }

  let hops = 0;
  let walking = true;

  while (walking && currentNodeId) {
    if (hops >= MAX_HOPS_PER_STEP) {
      deps.logger.error("[engine] Loop guard triggered", { currentNodeId });
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
        // The Start node's own greeting text — editable in the Studio the same way a Message
        // node's is — was previously silently dropped: this case moved straight to the next
        // node without ever sending it, so a bot's very first message a visitor sees came from
        // whatever's wired after Start instead of the greeting configured on Start itself.
        const text = interpolate(node.data.text ?? "", variables);
        if (text) {
          replies.push({ content: text });
          history.push({ role: "assistant", content: text });
        }
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
        // A Logic node wired off this AI node's dedicated "logic" source handle gets first look
        // at the visitor's message — a matched rule pre-empts the LLM entirely for this turn
        // (reply and/or reroute). Only ever consulted when there's an actual visitor message
        // driving this turn, so it can't fire on the very first (unprompted) greeting.
        const logicEdge = graph.edges.find(
          (edge) => edge.source === node.id && edge.sourceHandle === "logic",
        );
        const logicNode = logicEdge ? findNode(graph, logicEdge.target) : undefined;
        const logicRules = logicNode?.type === "logic" ? logicNode.data.rules : undefined;

        // Three passes, cheapest first: literal keywords (free, instant) → semantic similarity
        // via a small classification call (only when keywords found nothing, and only against
        // rules that actually have trigger text to compare meaning against) → the empty-triggers
        // catch-all, if the author has one, as the final fallback.
        let candidateRule: LogicRule | undefined;
        if (input !== undefined && logicRules) {
          candidateRule =
            matchLogicKeyword(logicRules, input) ??
            (await classifySemanticMatch(logicRules, history, deps, node.data.model, node.data.provider)) ??
            catchAllRule(logicRules);
        }
        const candidateBranchEdge = candidateRule ? edgeForBranch(graph, logicNode!.id, candidateRule.id) : undefined;
        // A rule with no reply and no route configured is a no-op — most often the default,
        // still-blank "Anything else" catch-all — so it must NOT preempt the LLM. Only an
        // author-configured rule (a reply, a route, or both) actually pre-empts this turn.
        const matchedRule =
          candidateRule && (candidateRule.reply.trim() || candidateBranchEdge) ? candidateRule : undefined;

        if (matchedRule) {
          if (matchedRule.reply.trim()) {
            const text = interpolate(matchedRule.reply, variables);
            replies.push({ content: text });
            history.push({ role: "assistant", content: text });
          }
          if (candidateBranchEdge) {
            currentNodeId = candidateBranchEdge.target;
          } else {
            // No route wired for this rule: same "nothing wired after this AI node" behavior as
            // below — stay put and keep the conversation open rather than ending it.
            status = "AWAITING_INPUT";
            currentNodeId = node.id;
            walking = false;
          }
          break;
        }

        const systemPrompt = interpolate(node.data.systemPrompt ?? "", variables);
        let content: string;
        let usage: LlmUsage | undefined;
        try {
          const result = await deps.llm({
            systemPrompt,
            history,
            temperature: node.data.temperature,
            model: node.data.model,
            provider: node.data.provider,
          });
          content = result.content;
          usage = result.usage;
        } catch (error) {
          deps.logger.error("[engine] LLM call failed", error);
          lastError = error instanceof Error ? error.message : String(error);
          content = "Sorry, I couldn't come up with a reply just now.";
        }
        replies.push({
          content,
          ...(usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens } : {}),
        });
        history.push({ role: "assistant", content });
        const edge = nextEdge(graph, node.id);
        if (edge) {
          currentNodeId = edge.target;
        } else {
          // Nothing wired after this AI node: stay here and keep the conversation open rather
          // than ending it — an AI node replies automatically and keeps chatting by default,
          // only actually ending when something explicitly routes it elsewhere (a condition to
          // Handoff, a dead-end Message node, etc.).
          status = "AWAITING_INPUT";
          currentNodeId = node.id;
          walking = false;
        }
        break;
      }

      case "logic": {
        // Reached directly (rather than as an AI node's attachment, see the "ai" case above) —
        // behaves like a Condition node keyed off the visitor's message instead of a stored
        // variable, with an optional canned reply per matched rule.
        const matched = input !== undefined ? matchLogicRule(node.data.rules, input) : undefined;
        if (matched) {
          if (matched.reply.trim()) {
            const text = interpolate(matched.reply, variables);
            replies.push({ content: text });
            history.push({ role: "assistant", content: text });
          }
          const edge = edgeForBranch(graph, node.id, matched.id);
          currentNodeId = edge?.target ?? null;
          if (!edge) status = "ENDED";
        } else {
          status = "ENDED";
          currentNodeId = null;
        }
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

      case "link": {
        const url = interpolate(node.data.url, variables);
        const linkText = node.data.linkText ? interpolate(node.data.linkText, variables) : "";
        // On its own line so the widget's existing URL auto-linking (see format-message.tsx) turns it
        // into a real clickable link without this node needing its own reply/message schema.
        const text = linkText ? `${linkText}\n${url}` : url;
        replies.push({ content: text });
        history.push({ role: "assistant", content: text });
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

  return { replies, state: { currentNodeId, variables, status, lastError } };
}
