import { describe, expect, it, vi } from "vitest";
import { createInitialState, step } from "./executor";
import type { EngineDeps, EngineState, FlowGraph, LlmDep } from "./types";

function createDeps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    llm: vi.fn(async () => ({ content: "mock ai reply" })),
    // Defaults to "no semantic match" so tests that don't care about classification (most of
    // them) get the same fall-through behavior as if no classifier existed.
    classify: vi.fn(async () => ({ content: "NONE" })),
    fetch: vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch,
    logger: { error: vi.fn(), info: vi.fn() },
    conversationId: "conv-1",
    ...overrides,
  };
}

describe("createInitialState", () => {
  it("points at the Start node with status RUNNING", () => {
    const graph: FlowGraph = {
      nodes: [{ id: "start-1", type: "start", data: {} }],
      edges: [],
    };
    expect(createInitialState(graph)).toEqual({
      currentNodeId: "start-1",
      variables: {},
      status: "RUNNING",
    });
  });

  it("ends immediately when the graph has no Start node", () => {
    const graph: FlowGraph = { nodes: [], edges: [] };
    expect(createInitialState(graph)).toEqual({
      currentNodeId: null,
      variables: {},
      status: "ENDED",
    });
  });
});

describe("step: linear flow", () => {
  it("walks through multiple message nodes in a single call and ends at the dead end", async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "start-1", type: "start", data: {} },
        { id: "msg-1", type: "message", data: { text: "Hello!" } },
        { id: "msg-2", type: "message", data: { text: "How can I help?" } },
      ],
      edges: [
        { id: "e1", source: "start-1", target: "msg-1" },
        { id: "e2", source: "msg-1", target: "msg-2" },
      ],
    };
    const state = createInitialState(graph);
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "Hello!" }, { content: "How can I help?" }]);
    expect(output.state).toEqual({ currentNodeId: null, variables: {}, status: "ENDED" });
  });

  it("interpolates {{variables}} into message text", async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "start-1", type: "start", data: {} },
        { id: "msg-1", type: "message", data: { text: "Hi {{name}}, welcome!" } },
      ],
      edges: [{ id: "e1", source: "start-1", target: "msg-1" }],
    };
    const state: EngineState = { currentNodeId: "start-1", variables: { name: "Ada" }, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "Hi Ada, welcome!" }]);
  });

  it("leaves unknown {{variables}} untouched rather than blanking them", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "msg-1", type: "message", data: { text: "Hi {{missing}}!" } }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "msg-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "Hi {{missing}}!" }]);
  });

  it("ends gracefully when a node's outgoing edge is missing (dead end)", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "msg-1", type: "message", data: { text: "The end." } }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "msg-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.state.status).toBe("ENDED");
    expect(output.state.currentNodeId).toBeNull();
  });

  it("ends gracefully when currentNodeId references a node that no longer exists", async () => {
    const graph: FlowGraph = { nodes: [], edges: [] };
    const state: EngineState = { currentNodeId: "ghost", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([]);
    expect(output.state).toEqual({ currentNodeId: null, variables: {}, status: "ENDED" });
  });
});

describe("step: link node", () => {
  it("sends the link text and URL on separate lines so the widget can auto-link the URL", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "link-1", type: "link", data: { url: "https://example.com/pricing", linkText: "View pricing" } }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "link-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "View pricing\nhttps://example.com/pricing" }]);
    expect(output.state.status).toBe("ENDED");
  });

  it("sends just the bare URL when no link text is set", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "link-1", type: "link", data: { url: "https://example.com" } }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "link-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "https://example.com" }]);
  });

  it("interpolates {{variables}} into both the link text and the URL", async () => {
    const graph: FlowGraph = {
      nodes: [
        {
          id: "link-1",
          type: "link",
          data: { url: "https://example.com/u/{{userId}}", linkText: "View {{name}}'s profile" },
        },
      ],
      edges: [],
    };
    const state: EngineState = {
      currentNodeId: "link-1",
      variables: { userId: "42", name: "Ada" },
      status: "RUNNING",
    };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "View Ada's profile\nhttps://example.com/u/42" }]);
  });

  it("continues to the next node like a message node", async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "link-1", type: "link", data: { url: "https://example.com" } },
        { id: "msg-1", type: "message", data: { text: "Anything else?" } },
      ],
      edges: [{ id: "e1", source: "link-1", target: "msg-1" }],
    };
    const state: EngineState = { currentNodeId: "link-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([
      { content: "https://example.com" },
      { content: "Anything else?" },
    ]);
    expect(output.state.status).toBe("ENDED");
  });
});

describe("step: capture pause/resume", () => {
  const graph: FlowGraph = {
    nodes: [
      { id: "capture-1", type: "capture", data: { question: "What's your email?", variableName: "email" } },
      { id: "msg-1", type: "message", data: { text: "Thanks, {{email}}!" } },
    ],
    edges: [{ id: "e1", source: "capture-1", target: "msg-1" }],
  };

  it("emits the question and pauses at AWAITING_INPUT without advancing", async () => {
    const state: EngineState = { currentNodeId: "capture-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([{ content: "What's your email?" }]);
    expect(output.state).toEqual({
      currentNodeId: "capture-1",
      variables: {},
      status: "AWAITING_INPUT",
    });
  });

  it("stores the visitor's answer and continues on the next step", async () => {
    const awaiting: EngineState = { currentNodeId: "capture-1", variables: {}, status: "AWAITING_INPUT" };
    const output = await step(graph, awaiting, "ada@example.com", createDeps());

    expect(output.replies).toEqual([{ content: "Thanks, ada@example.com!" }]);
    expect(output.state).toEqual({
      currentNodeId: null,
      variables: { email: "ada@example.com" },
      status: "ENDED",
    });
  });

  it("is a no-op when awaiting input but none is supplied", async () => {
    const awaiting: EngineState = { currentNodeId: "capture-1", variables: {}, status: "AWAITING_INPUT" };
    const output = await step(graph, awaiting, undefined, createDeps());

    expect(output.replies).toEqual([]);
    expect(output.state).toEqual(awaiting);
  });

  it("ends gracefully if the capture node has no outgoing edge", async () => {
    const deadEndGraph: FlowGraph = {
      nodes: [{ id: "capture-1", type: "capture", data: { question: "Q?", variableName: "v" } }],
      edges: [],
    };
    const awaiting: EngineState = { currentNodeId: "capture-1", variables: {}, status: "AWAITING_INPUT" };
    const output = await step(deadEndGraph, awaiting, "answer", createDeps());

    expect(output.state).toEqual({ currentNodeId: null, variables: { v: "answer" }, status: "ENDED" });
  });
});

describe("step: condition branching", () => {
  const graph: FlowGraph = {
    nodes: [
      {
        id: "cond-1",
        type: "condition",
        data: {
          variable: "topic",
          branches: [
            { id: "branch-pricing", label: "Pricing", value: "pricing" },
            { id: "branch-else", label: "Else", value: "" },
          ],
        },
      },
      { id: "msg-pricing", type: "message", data: { text: "Here are our prices." } },
      { id: "msg-else", type: "message", data: { text: "Tell me more." } },
    ],
    edges: [
      { id: "e1", source: "cond-1", target: "msg-pricing", sourceHandle: "branch-pricing" },
      { id: "e2", source: "cond-1", target: "msg-else", sourceHandle: "branch-else" },
    ],
  };

  it("follows the branch whose value is contained in the variable (case-insensitive)", async () => {
    const state: EngineState = { currentNodeId: "cond-1", variables: { topic: "What is your PRICING?" }, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());
    expect(output.replies).toEqual([{ content: "Here are our prices." }]);
  });

  it("falls back to the empty-value branch when nothing matches", async () => {
    const state: EngineState = { currentNodeId: "cond-1", variables: { topic: "unrelated question" }, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());
    expect(output.replies).toEqual([{ content: "Tell me more." }]);
  });

  it("falls back to the first branch when no branch matches and there's no else", async () => {
    const noElseGraph: FlowGraph = {
      nodes: [
        {
          id: "cond-1",
          type: "condition",
          data: {
            variable: "topic",
            branches: [{ id: "branch-a", label: "A", value: "alpha" }],
          },
        },
        { id: "msg-a", type: "message", data: { text: "Branch A." } },
      ],
      edges: [{ id: "e1", source: "cond-1", target: "msg-a", sourceHandle: "branch-a" }],
    };
    const state: EngineState = { currentNodeId: "cond-1", variables: { topic: "nothing relevant" }, status: "RUNNING" };
    const output = await step(noElseGraph, state, undefined, createDeps());
    expect(output.replies).toEqual([{ content: "Branch A." }]);
  });

  it("ends gracefully when the matched branch has no wired edge", async () => {
    const unwiredGraph: FlowGraph = {
      nodes: [
        {
          id: "cond-1",
          type: "condition",
          data: { variable: "topic", branches: [{ id: "branch-a", label: "A", value: "" }] },
        },
      ],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "cond-1", variables: {}, status: "RUNNING" };
    const output = await step(unwiredGraph, state, undefined, createDeps());
    expect(output.state.status).toBe("ENDED");
  });
});

describe("step: webhook", () => {
  const graph: FlowGraph = {
    nodes: [
      { id: "hook-1", type: "webhook", data: { url: "https://example.com/hook", method: "POST" } },
      { id: "msg-1", type: "message", data: { text: "Done." } },
    ],
    edges: [{ id: "e1", source: "hook-1", target: "msg-1" }],
  };

  it("posts variables and conversationId, then continues to the next node", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("ok", { status: 200 }));
    const deps = createDeps({ fetch: fetchMock as unknown as typeof fetch });
    const state: EngineState = { currentNodeId: "hook-1", variables: { plan: "pro" }, status: "RUNNING" };

    const output = await step(graph, state, undefined, deps);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      variables: { plan: "pro" },
      conversationId: "conv-1",
    });
    expect(output.replies).toEqual([{ content: "Done." }]);
  });

  it("logs and continues when the webhook call fails (non-blocking)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const errorLog = vi.fn();
    const deps = createDeps({ fetch: fetchMock as unknown as typeof fetch, logger: { error: errorLog } });
    const state: EngineState = { currentNodeId: "hook-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, undefined, deps);

    expect(errorLog).toHaveBeenCalled();
    expect(output.replies).toEqual([{ content: "Done." }]);
    expect(output.state.status).toBe("ENDED");
  });
});

describe("step: ai node", () => {
  it("calls deps.llm with the interpolated prompt and continues", async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "ai-1", type: "ai", data: { systemPrompt: "You are Meo, helping {{name}}.", model: "grok-main", temperature: 0.5 } },
        { id: "msg-1", type: "message", data: { text: "Anything else?" } },
      ],
      edges: [{ id: "e1", source: "ai-1", target: "msg-1" }],
    };
    const llmMock = vi.fn(async () => ({ content: "Here's my answer." }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: { name: "Ada" }, status: "RUNNING" };

    const output = await step(graph, state, undefined, deps);

    expect(llmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "You are Meo, helping Ada.",
        temperature: 0.5,
        model: "grok-main",
      }),
    );
    expect(output.replies).toEqual([{ content: "Here's my answer." }, { content: "Anything else?" }]);
  });

  it("carries the LLM's token usage onto the reply when reported", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "ai-1", type: "ai", data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3 } }],
      edges: [],
    };
    const llmMock = vi.fn(async () => ({
      content: "Sure thing.",
      usage: { promptTokens: 42, completionTokens: 7 },
    }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, undefined, deps);

    expect(output.replies).toEqual([{ content: "Sure thing.", promptTokens: 42, completionTokens: 7 }]);
  });

  it("falls back to a friendly reply instead of crashing when the LLM call throws", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "ai-1", type: "ai", data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3 } }],
      edges: [],
    };
    const llmMock = vi.fn(async () => {
      throw new Error("upstream 500");
    });
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const result = await step(graph, state, undefined, deps);

    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].content).not.toBe("");
    // Dead-end AI node: even after a fallback reply, the conversation stays open rather than
    // ending — see "step: ai node with no outgoing edge" below.
    expect(result.state.status).toBe("AWAITING_INPUT");
    expect(result.state.currentNodeId).toBe("ai-1");
    expect(result.state.lastError).toBe("upstream 500");
  });
});

describe("step: ai node with no outgoing edge stays open for more chatting", () => {
  const graph: FlowGraph = {
    nodes: [{ id: "ai-1", type: "ai", data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3 } }],
    edges: [],
  };

  it("replies and waits for more input instead of ending the conversation", async () => {
    const llmMock = vi.fn(async () => ({ content: "How can I help?" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, "Hi", deps);

    expect(output.replies).toEqual([{ content: "How can I help?" }]);
    expect(output.state).toEqual({
      currentNodeId: "ai-1",
      variables: {},
      status: "AWAITING_INPUT",
    });
  });

  it("is a no-op when awaiting more input but none is supplied yet", async () => {
    const llmMock = vi.fn(async () => ({ content: "unused" }));
    const deps = createDeps({ llm: llmMock });
    const awaiting: EngineState = { currentNodeId: "ai-1", variables: {}, status: "AWAITING_INPUT" };

    const output = await step(graph, awaiting, undefined, deps);

    expect(output.replies).toEqual([]);
    expect(output.state).toEqual(awaiting);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("keeps replying across many turns, feeding each new message to the same AI node", async () => {
    const llmMock = vi
      .fn()
      .mockResolvedValueOnce({ content: "Hi! What's up?" })
      .mockResolvedValueOnce({ content: "Nice to hear!" })
      .mockResolvedValueOnce({ content: "Anytime." });
    const deps = createDeps({ llm: llmMock });

    let state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };
    const turn1 = await step(graph, state, "Hi", deps);
    expect(turn1.replies).toEqual([{ content: "Hi! What's up?" }]);
    state = turn1.state;

    const turn2 = await step(graph, state, "All good, thanks", deps);
    expect(turn2.replies).toEqual([{ content: "Nice to hear!" }]);
    state = turn2.state;

    const turn3 = await step(graph, state, "Thanks for your help", deps);
    expect(turn3.replies).toEqual([{ content: "Anytime." }]);

    expect(llmMock).toHaveBeenCalledTimes(3);
    // Every call still targets the same never-ending AI node.
    expect(state.currentNodeId).toBe("ai-1");
    expect(state.status).toBe("AWAITING_INPUT");
  });

  it("still ends normally when routed to a real dead end (e.g. a Message node with no edge)", async () => {
    const messageDeadEnd: FlowGraph = {
      nodes: [
        { id: "ai-1", type: "ai", data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3 } },
        { id: "msg-1", type: "message", data: { text: "Bye!" } },
      ],
      edges: [{ id: "e1", source: "ai-1", target: "msg-1" }],
    };
    const llmMock = vi.fn(async () => ({ content: "One sec." }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(messageDeadEnd, state, "bye", deps);

    expect(output.replies).toEqual([{ content: "One sec." }, { content: "Bye!" }]);
    expect(output.state.status).toBe("ENDED");
  });
});

describe("step: handoff", () => {
  it("emits the fixed customer-facing message and sets status HANDOFF, ignoring the internal note", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "handoff-1", type: "handoff", data: { note: "Internal: billing dispute, check account history." } }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "handoff-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([
      { content: "Your message is being sent to a live team to assist you." },
    ]);
    expect(output.state.status).toBe("HANDOFF");
    expect(output.state.currentNodeId).toBeNull();
  });

  it("defaults to the web channel and shows the message when deps.channel is omitted", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "handoff-1", type: "handoff", data: {} }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "handoff-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies[0].content.length).toBeGreaterThan(0);
    expect(output.state.status).toBe("HANDOFF");
  });

  it("still transitions to HANDOFF but stays silent on non-web channels", async () => {
    const graph: FlowGraph = {
      nodes: [{ id: "handoff-1", type: "handoff", data: {} }],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "handoff-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps({ channel: "webhook" }));

    expect(output.replies).toEqual([]);
    expect(output.state.status).toBe("HANDOFF");
    expect(output.state.currentNodeId).toBeNull();
  });
});

describe("step: guards", () => {
  it("stops after 25 hops on a cyclic graph instead of looping forever", async () => {
    const graph: FlowGraph = {
      nodes: [
        { id: "a", type: "message", data: { text: "a" } },
        { id: "b", type: "message", data: { text: "b" } },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "a" },
      ],
    };
    const state: EngineState = { currentNodeId: "a", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    // 25 real hops each emit a message, plus one final loop-guard reply.
    expect(output.replies.length).toBe(26);
    expect(output.replies.slice(0, 25).map((r) => r.content)).toEqual(
      Array.from({ length: 25 }, (_, i) => (i % 2 === 0 ? "a" : "b")),
    );
    expect(output.replies[25].content).toMatch(/start over/i);
    expect(output.state.status).toBe("ENDED");
    expect(output.state.currentNodeId).toBeNull();
  });

  it("is a no-op when called on an already-ENDED conversation", async () => {
    const graph: FlowGraph = { nodes: [], edges: [] };
    const endedState: EngineState = { currentNodeId: null, variables: { x: "1" }, status: "ENDED" };
    const output = await step(graph, endedState, "hello", createDeps());

    expect(output).toEqual({ replies: [], state: endedState });
  });

  it("is a no-op when called on an already-HANDOFF conversation", async () => {
    const graph: FlowGraph = { nodes: [], edges: [] };
    const handoffState: EngineState = { currentNodeId: null, variables: {}, status: "HANDOFF" };
    const output = await step(graph, handoffState, "hello", createDeps());

    expect(output).toEqual({ replies: [], state: handoffState });
  });
});

describe("step: logic node (standalone)", () => {
  const graph: FlowGraph = {
    nodes: [
      {
        id: "logic-1",
        type: "logic",
        data: {
          rules: [
            {
              id: "rule-pay",
              label: "Payment link",
              triggers: "payment, invoice",
              reply: "Here's your payment link: https://pay.example.com",
            },
            { id: "rule-else", label: "Anything else", triggers: "", reply: "" },
          ],
        },
      },
      { id: "pay-node", type: "message", data: { text: "Anything else?" } },
      { id: "fallback-node", type: "message", data: { text: "Let me get a human." } },
    ],
    edges: [
      { id: "e1", source: "logic-1", target: "pay-node", sourceHandle: "rule-pay" },
      { id: "e2", source: "logic-1", target: "fallback-node", sourceHandle: "rule-else" },
    ],
  };

  it("sends the matched rule's reply and routes to its branch", async () => {
    const state: EngineState = { currentNodeId: "logic-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, "Can I get an invoice?", createDeps());

    expect(output.replies).toEqual([
      { content: "Here's your payment link: https://pay.example.com" },
      { content: "Anything else?" },
    ]);
    expect(output.state.status).toBe("ENDED");
  });

  it("falls through to the empty-triggers rule when nothing else matches", async () => {
    const state: EngineState = { currentNodeId: "logic-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, "what's the weather like", createDeps());

    expect(output.replies).toEqual([{ content: "Let me get a human." }]);
  });

  it("ends without a reply when there's no visitor message to match against", async () => {
    const state: EngineState = { currentNodeId: "logic-1", variables: {}, status: "RUNNING" };
    const output = await step(graph, state, undefined, createDeps());

    expect(output.replies).toEqual([]);
    expect(output.state.status).toBe("ENDED");
  });

  it("ends as a dead end when no rule matches and there's no catch-all", async () => {
    const noElseGraph: FlowGraph = {
      nodes: [
        {
          id: "logic-1",
          type: "logic",
          data: { rules: [{ id: "rule-pay", label: "Payment", triggers: "payment", reply: "Sure!" }] },
        },
      ],
      edges: [],
    };
    const state: EngineState = { currentNodeId: "logic-1", variables: {}, status: "RUNNING" };
    const output = await step(noElseGraph, state, "hello there", createDeps());

    expect(output.replies).toEqual([]);
    expect(output.state.status).toBe("ENDED");
  });
});

describe("step: logic node attached to an AI node", () => {
  function buildGraph(): FlowGraph {
    return {
      nodes: [
        { id: "ai-1", type: "ai", data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3 } },
        {
          id: "logic-1",
          type: "logic",
          data: {
            rules: [
              {
                id: "rule-pay",
                label: "Payment link",
                triggers: "payment, invoice",
                reply: "Here's your payment link: https://pay.example.com",
              },
            ],
          },
        },
        { id: "handoff-1", type: "handoff", data: {} },
      ],
      edges: [
        { id: "e-logic", source: "ai-1", target: "logic-1", sourceHandle: "logic" },
        { id: "e-route", source: "logic-1", target: "handoff-1", sourceHandle: "rule-pay" },
      ],
    };
  }

  it("short-circuits the LLM entirely when a rule matches, replying and routing instead", async () => {
    const llmMock = vi.fn(async () => ({ content: "unused" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(buildGraph(), state, "Can you send me an invoice?", deps);

    expect(llmMock).not.toHaveBeenCalled();
    expect(output.replies).toEqual([
      { content: "Here's your payment link: https://pay.example.com" },
      { content: "Your message is being sent to a live team to assist you." },
    ]);
    expect(output.state.status).toBe("HANDOFF");
  });

  it("stays open on the AI node when a matched rule has no route wired", async () => {
    const graph = buildGraph();
    graph.edges = graph.edges.filter((edge) => edge.sourceHandle !== "rule-pay");
    const llmMock = vi.fn(async () => ({ content: "unused" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, "I need an invoice", deps);

    expect(llmMock).not.toHaveBeenCalled();
    expect(output.replies).toEqual([{ content: "Here's your payment link: https://pay.example.com" }]);
    expect(output.state).toEqual({ currentNodeId: "ai-1", variables: {}, status: "AWAITING_INPUT" });
  });

  it("falls through to the LLM as normal when no rule matches, and stays open afterward", async () => {
    const llmMock = vi.fn(async () => ({ content: "How can I help?" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(buildGraph(), state, "What are your hours?", deps);

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "How can I help?" }]);
    // Regression check: the AI node's only outgoing edge is its "logic" attachment (no plain
    // next edge in buildGraph()) — after the LLM replies, the engine must NOT mistake that
    // logic edge for "what comes next" and wander into the Logic node a second time. It should
    // behave exactly like an AI node with no outgoing edge at all: stay open on itself.
    expect(output.state).toEqual({ currentNodeId: "ai-1", variables: {}, status: "AWAITING_INPUT" });
  });

  it("stays open (not ENDED) when attached to a Logic node with an unwired catch-all rule and no plain next edge", async () => {
    // Mirrors exactly what dragging a Logic node off an AI node's dot produces by default (see
    // NODE_KINDS' "logic" defaultData): a keyword rule plus an "Anything else" catch-all with no
    // route and no reply. Before the nextEdge fix, a message matching neither rule made the
    // engine wander into the Logic node via nextEdge (which didn't filter out the "logic"
    // handle), hit that unwired catch-all a second time, and end the conversation outright.
    const graph: FlowGraph = {
      nodes: [
        { id: "ai-1", type: "ai", data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3 } },
        {
          id: "logic-1",
          type: "logic",
          data: {
            rules: [
              {
                id: "rule-1",
                label: "Asks for a payment link",
                triggers: "payment, invoice, pay now, checkout",
                reply: "Sure — here's your payment link: https://pay.example.com",
              },
              { id: "rule-2", label: "Anything else", triggers: "", reply: "" },
            ],
          },
        },
      ],
      edges: [{ id: "e-logic", source: "ai-1", target: "logic-1", sourceHandle: "logic" }],
    };
    const llmMock = vi.fn(async () => ({ content: "Hi Dave! I'm Meo. What can I help you with?" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, "Dave", deps);

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "Hi Dave! I'm Meo. What can I help you with?" }]);
    expect(output.state).toEqual({ currentNodeId: "ai-1", variables: {}, status: "AWAITING_INPUT" });
  });

  it("never fires rules on the unprompted first turn (no visitor message yet)", async () => {
    const llmMock = vi.fn(async () => ({ content: "Hey there!" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(buildGraph(), state, undefined, deps);

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "Hey there!" }]);
  });

  it("only treats the sourceHandle:\"logic\" edge as the attachment, regardless of edge order", async () => {
    // A plain edge (no sourceHandle) listed *before* the real logic edge shouldn't be mistaken
    // for the logic attachment — the lookup must filter on sourceHandle, not just grab the
    // first outgoing edge from the AI node.
    const graph = buildGraph();
    graph.edges.unshift({ id: "e-next", source: "ai-1", target: "handoff-1" });
    const llmMock = vi.fn(async () => ({ content: "unused" }));
    const deps = createDeps({ llm: llmMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, "send me an invoice please", deps);

    expect(llmMock).not.toHaveBeenCalled();
    expect(output.replies[0]).toEqual({ content: "Here's your payment link: https://pay.example.com" });
  });
});

describe("step: logic node semantic (AI) matching", () => {
  function buildGraph(): FlowGraph {
    return {
      nodes: [
        {
          id: "ai-1",
          type: "ai",
          data: { systemPrompt: "Help.", model: "grok-main", temperature: 0.3, provider: "xai" },
        },
        {
          id: "logic-1",
          type: "logic",
          data: {
            rules: [
              {
                id: "rule-pay",
                label: "Confirms payment",
                triggers: "I have made payments",
                reply: "Thanks — I've marked your payment as received!",
              },
            ],
          },
        },
      ],
      edges: [{ id: "e-logic", source: "ai-1", target: "logic-1", sourceHandle: "logic" }],
    };
  }

  it("falls back to the classifier when no keyword literally matches, and fires the rule it names", async () => {
    const llmMock = vi.fn(async () => ({ content: "unused" }));
    const classifyMock = vi.fn(async () => ({ content: "rule-pay" }));
    const deps = createDeps({ llm: llmMock, classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    // Nothing here literally contains "I have made payments" — only the classifier can catch it.
    const output = await step(buildGraph(), state, "just sent the money over, should be there now", deps);

    expect(llmMock).not.toHaveBeenCalled();
    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "Thanks — I've marked your payment as received!" }]);
  });

  it("calls the classifier with the attached AI node's own model/provider and no persona framing", async () => {
    const classifyMock = vi.fn<LlmDep>(async () => ({ content: "NONE" }));
    const deps = createDeps({ classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    await step(buildGraph(), state, "hello there", deps);

    expect(classifyMock).toHaveBeenCalledTimes(1);
    const call = classifyMock.mock.calls[0][0];
    expect(call.model).toBe("grok-main");
    expect(call.provider).toBe("xai");
    expect(call.temperature).toBe(0);
    expect(call.history).toEqual([{ role: "user", content: "hello there" }]);
    expect(call.systemPrompt).toContain("rule-pay");
    // Guards against a classifier that fires too eagerly on merely-related messages: the prompt
    // must tell it to require the same specific request, not just shared topic/wording, and to
    // default to no match when it isn't sure.
    expect(call.systemPrompt).toMatch(/same specific request/i);
    expect(call.systemPrompt).toMatch(/when in doubt.*NONE/i);
  });

  it("skips the classifier entirely once a keyword already matched (no wasted call)", async () => {
    const classifyMock = vi.fn(async () => ({ content: "NONE" }));
    const deps = createDeps({ classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(buildGraph(), state, "I have made payments already", deps);

    expect(classifyMock).not.toHaveBeenCalled();
    expect(output.replies).toEqual([{ content: "Thanks — I've marked your payment as received!" }]);
  });

  it("skips the classifier when there are no rules with real trigger text to compare against", async () => {
    const graph = buildGraph();
    graph.nodes[1] = {
      id: "logic-1",
      type: "logic",
      data: { rules: [{ id: "rule-else", label: "Anything else", triggers: "", reply: "" }] },
    };
    const classifyMock = vi.fn(async () => ({ content: "NONE" }));
    const llmMock = vi.fn(async () => ({ content: "How can I help?" }));
    const deps = createDeps({ llm: llmMock, classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(graph, state, "hello there", deps);

    expect(classifyMock).not.toHaveBeenCalled();
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "How can I help?" }]);
  });

  it("treats an unrecognized classifier response as no match and falls through to the LLM", async () => {
    const classifyMock = vi.fn(async () => ({ content: "some rambling non-id response" }));
    const llmMock = vi.fn(async () => ({ content: "How can I help?" }));
    const deps = createDeps({ llm: llmMock, classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(buildGraph(), state, "what's the weather like", deps);

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "How can I help?" }]);
  });

  it("treats a classifier failure as no match instead of breaking the turn", async () => {
    const classifyMock = vi.fn(async () => {
      throw new Error("upstream 500");
    });
    const llmMock = vi.fn(async () => ({ content: "How can I help?" }));
    const deps = createDeps({ llm: llmMock, classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    const output = await step(buildGraph(), state, "what's the weather like", deps);

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(output.replies).toEqual([{ content: "How can I help?" }]);
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it("never calls the classifier on the unprompted first turn (no visitor message yet)", async () => {
    const classifyMock = vi.fn(async () => ({ content: "NONE" }));
    const deps = createDeps({ classify: classifyMock });
    const state: EngineState = { currentNodeId: "ai-1", variables: {}, status: "RUNNING" };

    await step(buildGraph(), state, undefined, deps);

    expect(classifyMock).not.toHaveBeenCalled();
  });
});
