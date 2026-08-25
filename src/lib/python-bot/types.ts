// Shared shapes for the "Python Bot" bypass mode — a bot owner's own .py file runs a whole
// conversation instead of the Flow Studio graph (see PythonBot in prisma/schema.prisma). Kept in
// their own module (rather than folded into engine/types.ts) since this is a deliberately
// separate, much simpler execution path with no relationship to the graph engine's node types.

export type PythonBotMessage = { role: "user" | "assistant"; content: string };

/** What the sandboxed script receives for one turn — written to /tmp/chatmeo_input.json inside
 * the sandbox (see sandbox.ts's RUNNER_SOURCE), never passed as a raw string the script has to
 * parse itself beyond a single `json.load`. */
export type PythonBotInput = {
  message: string;
  history: PythonBotMessage[];
  /** Whatever the script itself returned as `chatmeo_state` last turn (see PythonBotRunResult) —
   * `{}` on the very first turn. Round-tripped verbatim on Conversation.pythonState so the
   * script can keep track of anything it needs between messages without a database of its own. */
  state: Record<string, unknown>;
};

export type PythonBotRunResult =
  | {
      kind: "success";
      /** Empty when the script set neither `chatmeo_reply` nor `chatmeo_replies` — a
          deliberate "nothing to say this turn" result, not an error. */
      replies: string[];
      state: Record<string, unknown>;
      handoff: boolean;
      stdout: string;
      stderr: string;
    }
  | { kind: "error"; message: string; stdout: string; stderr: string };
