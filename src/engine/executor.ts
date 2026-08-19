import type {
  AiNode,
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
  ReplyNode,
} from "./types";

const MAX_HOPS_PER_STEP = 25;
const WEBHOOK_TIMEOUT_MS = 5000;
const HANDOFF_MESSAGE = "Your message is being sent to a live team to assist you.";
const LOOP_GUARD_MESSAGE = "Something went wrong on our end — let's start over.";
// Reply node's optional pre-send pause (see ReplyNode.data.delaySeconds) — capped well short of
// typical serverless function timeouts, since on synchronous channels (the web widget, the
// Studio Test drawer) this blocks the visitor's own request for the full duration; on WhatsApp
// it's safely backgrounded, but the cap stays the same everywhere for one predictable ceiling.
export const MAX_REPLY_DELAY_SECONDS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Bare words too common and ambiguous to trust as a *literal* match on their own — "yes" alone
// could mean "yes, send the payment link", "yes, I already paid", or a dozen other things
// depending on what was just asked. Letting one of these win the free keyword pass outright is
// exactly how a rule ends up firing on the wrong intent before the smarter semantic pass (which
// actually reads the message in context) ever gets a chance to weigh in. Excluding them here
// only takes away their ability to win *alone*; the rule's full trigger text (including these
// words) is still handed to the classifier as-is. Only applied where a semantic fallback
// actually exists to catch what this excludes — see excludeGeneric below.
const GENERIC_KEYWORDS = new Set([
  "yes",
  "yeah",
  "yep",
  "yup",
  "sure",
  "ok",
  "okay",
  "no",
  "nope",
  "done",
  "please",
  "thanks",
  "thank you",
  "hi",
  "hello",
  "hey",
]);

function matchLogicKeyword(
  rules: LogicRule[],
  rawMessage: string,
  options?: { excludeGeneric?: boolean },
): LogicRule | undefined {
  const message = rawMessage.toLowerCase();
  return rules.find((rule) => {
    const keywords = rule.triggers
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean)
      .filter((keyword) => !(options?.excludeGeneric && GENERIC_KEYWORDS.has(keyword)));
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

/** Keyword match, falling back to a semantic classification pass (see classifySemanticMatch) and
 * then the catch-all rule (same convention as ConditionBranch's empty value) — used by the
 * standalone "logic" case, same three-pass matching an AI-attached Logic node gets, just with no
 * model/provider of its own to run the classification call with (defaults to the deployment's
 * default, same as an unset AiNode.data.model would). Unlike matchBranch, a Logic node with
 * nothing that matches and no catch-all rule returns undefined rather than falling back to the
 * first rule — "no rule applies" needs to be distinguishable from "the first rule applies". */
async function matchLogicRule(
  rules: LogicRule[],
  rawMessage: string,
  history: LlmChatMessage[],
  deps: EngineDeps,
): Promise<LogicRule | undefined> {
  return (
    matchLogicKeyword(rules, rawMessage, { excludeGeneric: true }) ??
    (await classifySemanticMatch(rules, history, deps, "", undefined)) ??
    catchAllRule(rules)
  );
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

/** Semantic fallback used both by runLogicAttachedNode (an AI/Reply node's attached Logic rules)
 * and by matchLogicRule (a standalone Logic node wired directly into the flow) — only called once
 * the keyword pass finds nothing, and only against rules that actually have triggers text to
 * compare meaning against (an empty-triggers catch-all is unconditional and needs no
 * classifying). Takes the real conversation so far (not just the
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

type LogicAttachedResult = {
  currentNodeId: string | null;
  status: EngineState["status"];
  walking: boolean;
  lastError?: string;
};

/**
 * Shared control flow for any node type that can have a Logic node attached via its dedicated
 * "logic" source handle — currently AiNode and ReplyNode. Runs the attached rules against the
 * visitor's message first (a match pre-empts everything else this turn), handles the
 * logicLocked rules-only phase, and otherwise calls `generateReply()` for whatever this node's
 * own kind of content actually is (an LLM call for AiNode, the fixed/reworded text for
 * ReplyNode) — that's the one piece each node type supplies for itself; everything else (the
 * matchedRule/logicLocked branches, and — for AiNode — maxReplies looping via `resendAllowed`)
 * is otherwise identical between them, which is exactly why this is shared rather than
 * duplicated. Returns the new currentNodeId/status/walking rather than mutating them directly,
 * since this is called from two different `switch` cases in step() that each own those bindings
 * themselves.
 */
async function runLogicAttachedNode(
  node: AiNode | ReplyNode,
  graph: FlowGraph,
  input: string | undefined,
  variables: Record<string, string>,
  history: LlmChatMessage[],
  replies: Reply[],
  aiReplyCounts: Record<string, number>,
  logicLocked: Record<string, boolean>,
  deps: EngineDeps,
  classifierModel: string,
  classifierProvider: string | undefined,
  // AiNode: true — free-form replies keep looping (subject to data.maxReplies) until something
  // routes away. ReplyNode: false — the fixed text is only ever worth sending once, so the very
  // first time generateReply() runs with nowhere to route, this locks onto the attached Logic
  // node (if any) or hands off silently, bypassing maxReplies/looping entirely — see the "reply"
  // case in step().
  resendAllowed: boolean,
  generateReply: () => Promise<{ content: string; usage?: LlmUsage; lastError?: string }>,
): Promise<LogicAttachedResult> {
  // A Logic node wired off this node's dedicated "logic" source handle gets first look at the
  // visitor's message — a matched rule pre-empts this node's own reply entirely for this turn
  // (reply and/or reroute). Only ever consulted when there's an actual visitor message driving
  // this turn, so it can't fire on the very first (unprompted) greeting.
  const logicEdge = graph.edges.find((edge) => edge.source === node.id && edge.sourceHandle === "logic");
  const logicNode = logicEdge ? findNode(graph, logicEdge.target) : undefined;
  const logicRules = logicNode?.type === "logic" ? logicNode.data.rules : undefined;

  // Once data.maxReplies consecutive loop turns have passed with nothing routing away from this
  // node, it stops waiting forever: it follows its plain outgoing edge if the author wired one
  // (same edge a routed-away turn would use); otherwise, if a Logic node is attached, it locks
  // onto that instead of ending (its rules — a payment confirmation, etc. — should still get a
  // chance to fire even though this node's own reply budget is spent); otherwise it hands off to
  // a human, exactly like reaching a Handoff node — a stuck conversation shouldn't be able to
  // loop indefinitely. Only AiNode has a maxReplies field at all — ReplyNode reaches this only
  // via the matchedRule branch below (its own content never loops, see resendAllowed), where
  // "unlimited" (undefined) is exactly the right default: a rule-locked node should keep waiting
  // for a matching message indefinitely, not get capped by a budget it doesn't have.
  function loopOrEscalate(): LogicAttachedResult {
    const maxReplies = node.type === "ai" ? node.data.maxReplies : undefined;
    const count = (aiReplyCounts[node.id] ?? 0) + 1;
    if (!maxReplies || count < maxReplies) {
      aiReplyCounts[node.id] = count;
      return { currentNodeId: node.id, status: "AWAITING_INPUT", walking: false };
    }
    delete aiReplyCounts[node.id];
    const fallbackEdge = nextEdge(graph, node.id);
    if (fallbackEdge) {
      return { currentNodeId: fallbackEdge.target, status: "RUNNING", walking: true };
    }
    if (logicNode) {
      logicLocked[node.id] = true;
      return { currentNodeId: node.id, status: "AWAITING_INPUT", walking: false };
    }
    // No Logic node to fall back on, so there's nothing left that could ever respond to another
    // message here — same end state as SilentHandoffNode, deliberately: this node has already
    // been replying for a while by the time the cap is hit, so announcing "you're being sent to
    // a live team" on top of that reads as an abrupt, robotic non-sequitur. Going quiet and
    // letting a human pick up the thread reads far more natural — on every channel, not just web.
    return { currentNodeId: null, status: "HANDOFF", walking: false };
  }

  // Three passes, cheapest first: literal keywords (free, instant) → semantic similarity via a
  // small classification call (only when keywords found nothing, and only against rules that
  // actually have trigger text to compare meaning against) → the empty-triggers catch-all, if
  // the author has one, as the final fallback.
  let candidateRule: LogicRule | undefined;
  if (input !== undefined && logicRules) {
    candidateRule =
      matchLogicKeyword(logicRules, input, { excludeGeneric: true }) ??
      (await classifySemanticMatch(logicRules, history, deps, classifierModel, classifierProvider)) ??
      catchAllRule(logicRules);
  }
  const candidateBranchEdge = candidateRule ? edgeForBranch(graph, logicNode!.id, candidateRule.id) : undefined;
  // A rule with no reply and no route configured is a no-op — most often the default, still-blank
  // "Anything else" catch-all — so it must NOT preempt this node's own reply. Only an
  // author-configured rule (a reply, a route, or both) actually pre-empts this turn.
  const matchedRule = candidateRule && (candidateRule.reply.trim() || candidateBranchEdge) ? candidateRule : undefined;

  if (matchedRule) {
    if (matchedRule.reply.trim()) {
      const text = interpolate(matchedRule.reply, variables);
      replies.push({ content: text });
      history.push({ role: "assistant", content: text });
    }
    if (candidateBranchEdge) {
      delete aiReplyCounts[node.id];
      delete logicLocked[node.id];
      return { currentNodeId: candidateBranchEdge.target, status: "RUNNING", walking: true };
    }
    // No route wired for this rule: same "nothing wired after this node" behavior as below —
    // stay put and keep the conversation open (subject to maxReplies) rather than ending it. A
    // rule that actually said something (rather than just routing) has put this conversation
    // into a rules-only phase from here on — see logicLocked's doc comment in types.ts.
    if (matchedRule.reply.trim()) logicLocked[node.id] = true;
    return loopOrEscalate();
  }

  if (logicLocked[node.id]) {
    // Locked: an attached Logic rule already spoke for this node once, so it doesn't get to
    // freelance a reply of its own that might contradict or duplicate it (e.g. inventing its own
    // payment link after a rule already sent the real one). Nothing matched this turn, so
    // there's nothing to say — stay open and wait for a message that actually matches one of the
    // rules (a confirmation, a receipt mention, etc.).
    return { currentNodeId: node.id, status: "AWAITING_INPUT", walking: false };
  }

  const result = await generateReply();
  replies.push({
    content: result.content,
    ...(result.usage ? { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens } : {}),
  });
  history.push({ role: "assistant", content: result.content });
  const edge = nextEdge(graph, node.id);
  if (edge) {
    delete aiReplyCounts[node.id];
    return { currentNodeId: edge.target, status: "RUNNING", walking: true, lastError: result.lastError };
  }
  if (!resendAllowed) {
    // ReplyNode: it has now said its one fixed thing, so there's nothing left worth waiting
    // around to repeat — lock onto the attached Logic node's rules (if any) exactly as if a rule
    // had just replied, or hand off silently if there's nothing attached, same end state
    // loopOrEscalate reaches once AiNode's maxReplies is spent, just reached immediately instead
    // of after N turns.
    if (logicNode) {
      logicLocked[node.id] = true;
      return { currentNodeId: node.id, status: "AWAITING_INPUT", walking: false, lastError: result.lastError };
    }
    return { currentNodeId: null, status: "HANDOFF", walking: false, lastError: result.lastError };
  }
  // Nothing wired after this node: stay here and keep the conversation open rather than ending
  // it — this node replies automatically and keeps chatting by default, only actually ending
  // when something explicitly routes it elsewhere (a condition to Handoff, a dead-end Message
  // node, etc.) or maxReplies caps the loop (loopOrEscalate).
  return { ...loopOrEscalate(), lastError: result.lastError };
}

// Deliberately narrow: this only ever reworks wording, never decides content — the actual
// message text is fixed by the flow author (ReplyNode.data.text) and embedded verbatim into the
// prompt below, so this is a paraphrase pass, not a conversation. Mainly exists so a Reply node
// that keeps sending the "same" message doesn't look like an identical copy-pasted broadcast.
function buildRewordPrompt(text: string): string {
  return (
    "Reword the message below so it reads a little differently than it might have last time, " +
    "without changing its meaning, tone, or any specific detail — no link, number, name, date, " +
    "or instruction may be added, removed, or altered. This is purely a wording pass, not an " +
    "opportunity to say more, less, or anything different from the original. Reply with ONLY the " +
    "reworded message text, nothing else — no quotes, no explanation, no preamble.\n\n" +
    `Message:\n${text}`
  );
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
  const aiReplyCounts = { ...(state.aiReplyCounts ?? {}) };
  const logicLocked = { ...(state.logicLocked ?? {}) };
  const replies: Reply[] = [];
  const history: LlmChatMessage[] = [];
  let currentNodeId = state.currentNodeId;
  let status: EngineState["status"] = "RUNNING";
  let lastError: string | undefined;

  if (state.status === "AWAITING_INPUT") {
    const waitingNode = findNode(graph, currentNodeId);
    // Capture nodes wait to store the answer into a variable and move on; AI and Reply nodes
    // with nowhere to go next (see runLogicAttachedNode) wait to keep the conversation itself
    // going — the visitor's next message just re-runs the same node with the reply already in
    // history. Anything else waiting is unexpected persisted state; end rather than loop.
    if (!waitingNode || (waitingNode.type !== "capture" && waitingNode.type !== "ai" && waitingNode.type !== "reply")) {
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
        const result = await runLogicAttachedNode(
          node,
          graph,
          input,
          variables,
          history,
          replies,
          aiReplyCounts,
          logicLocked,
          deps,
          node.data.model,
          node.data.provider,
          true,
          async () => {
            const systemPrompt = interpolate(node.data.systemPrompt ?? "", variables);
            try {
              const llmResult = await deps.llm({
                systemPrompt,
                history,
                temperature: node.data.temperature,
                model: node.data.model,
                provider: node.data.provider,
              });
              return { content: llmResult.content, usage: llmResult.usage };
            } catch (error) {
              deps.logger.error("[engine] LLM call failed", error);
              return {
                content: "Sorry, I couldn't come up with a reply just now.",
                lastError: error instanceof Error ? error.message : String(error),
              };
            }
          },
        );
        currentNodeId = result.currentNodeId;
        status = result.status;
        walking = result.walking;
        if (result.lastError) lastError = result.lastError;
        break;
      }

      case "reply": {
        const result = await runLogicAttachedNode(
          node,
          graph,
          input,
          variables,
          history,
          replies,
          aiReplyCounts,
          logicLocked,
          deps,
          node.data.model ?? "",
          node.data.provider,
          false,
          async () => {
            const delaySeconds = node.data.delaySeconds;
            if (delaySeconds && delaySeconds > 0) {
              await sleep(Math.min(delaySeconds, MAX_REPLY_DELAY_SECONDS) * 1000);
            }
            const text = interpolate(node.data.text ?? "", variables);
            if (!node.data.randomizeWording) return { content: text };
            try {
              const llmResult = await deps.llm({
                systemPrompt: buildRewordPrompt(text),
                history: [],
                temperature: node.data.temperature ?? 0.7,
                model: node.data.model ?? "",
                provider: node.data.provider,
              });
              // An empty/unparseable reword falls back to the literal text, same as a thrown
              // error below — this node's whole point is that it never has nothing to say.
              return { content: llmResult.content || text, usage: llmResult.usage };
            } catch (error) {
              // Deliberately silent (no lastError, no apology reply): unlike the AI node, this
              // node's content was never actually at risk — it always has the exact right thing
              // to say (node.data.text). A failed rewording pass just means it says that,
              // unreworded, which is a perfectly good outcome, not a degraded one worth
              // surfacing to the Studio Test drawer's Debug panel.
              deps.logger.error("[engine] Reply node rewording failed — using the original text", error);
              return { content: text };
            }
          },
        );
        currentNodeId = result.currentNodeId;
        status = result.status;
        walking = result.walking;
        break;
      }

      case "logic": {
        // Reached directly (rather than as an AI node's attachment, see the "ai" case above) —
        // behaves like a Condition node keyed off the visitor's message instead of a stored
        // variable, with an optional canned reply per matched rule.
        const matched = input !== undefined ? await matchLogicRule(node.data.rules, input, history, deps) : undefined;
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

      case "silentHandoff": {
        // Same end state as "handoff" (status HANDOFF, conversation shows up in the Inbox) but
        // never sends anything to the customer, on any channel — typically routed to from a
        // Logic rule that already sent its own reply and the flow author wants the bot to just
        // go quiet from there rather than also announce a handoff on top of it.
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

  return {
    replies,
    state: {
      currentNodeId,
      variables,
      status,
      lastError,
      ...(Object.keys(aiReplyCounts).length > 0 ? { aiReplyCounts } : {}),
      ...(Object.keys(logicLocked).length > 0 ? { logicLocked } : {}),
    },
  };
}
