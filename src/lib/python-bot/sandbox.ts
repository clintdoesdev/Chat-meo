import { Sandbox } from "@e2b/code-interpreter";
import type { PythonBotInput, PythonBotRunResult } from "./types";

// Applied both as the sandbox's own code-execution timeout (passed to runCode, so E2B itself
// kills a hung/looping script) and, with headroom added, as an outer guard around the whole
// call in case sandbox creation itself hangs — see runPythonBotCode's Promise.race below.
// 30s is generous for a chat reply but this only ever runs backgrounded (WhatsApp, via after())
// or, for the widget, is what the visitor is already waiting on regardless of how the flow graph
// would have replied — the tradeoff for handing a bot owner a real Python runtime instead of the
// graph's own AI/webhook nodes (which use much tighter budgets, see WEBHOOK_TIMEOUT_MS).
const SANDBOX_RUN_TIMEOUT_MS = 30_000;
const SANDBOX_HARD_TIMEOUT_MS = 45_000;

// Runs INSIDE the sandbox, once per turn, wrapping the bot owner's own script rather than
// requiring them to write one themselves — see the "Python Bot" Studio page for the contract this
// documents to them: read chatmeo_input, optionally set chatmeo_reply/chatmeo_replies/
// chatmeo_state/chatmeo_handoff, nothing else required. File-based I/O (not stdin/stdout
// markers) so the owner's own print() calls during development never have to be parsed around —
// they just show up as plain stdout/stderr we hand back untouched for the Test panel.
const RUNNER_SOURCE = `
import json

with open("/tmp/chatmeo_input.json") as f:
    chatmeo_input = json.load(f)

chatmeo_reply = None
chatmeo_replies = None
chatmeo_state = chatmeo_input.get("state") or {}
chatmeo_handoff = False

with open("/tmp/chatmeo_bot.py") as f:
    _chatmeo_source = f.read()

exec(compile(_chatmeo_source, "chatmeo_bot.py", "exec"), globals())

with open("/tmp/chatmeo_output.json", "w") as f:
    json.dump({
        "reply": chatmeo_reply,
        "replies": chatmeo_replies,
        "state": chatmeo_state,
        "handoff": bool(chatmeo_handoff),
    }, f)
`;

/** The slice of the E2B SDK this module actually uses — narrowed to a small interface (rather
 * than importing the real `Sandbox` type everywhere) so tests can inject a fake one instead of
 * hitting E2B's real API. See createE2BSandbox below for the real implementation. */
export type SandboxHandle = {
  writeFiles(files: { path: string; data: string }[]): Promise<void>;
  runCode(
    code: string,
    opts: { timeoutMs: number },
  ): Promise<{
    error?: { name: string; value: string };
    logs: { stdout: string[]; stderr: string[] };
  }>;
  readFile(path: string): Promise<string>;
  kill(): Promise<void>;
};

export type CreateSandbox = () => Promise<SandboxHandle>;

/** Real E2B-backed sandbox factory — a fresh isolated sandbox per call (see runPythonBotCode),
 * never reused across turns. E2B_API_KEY is a platform-wide secret (this app's own account, not
 * per-bot-owner), so every bot owner's script runs on the same billed account; nothing of ours
 * (this key included) is ever written into the sandbox's filesystem or environment — only the
 * conversation input this module explicitly writes to /tmp/chatmeo_input.json. */
export const createE2BSandbox: CreateSandbox = async () => {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) throw new Error("E2B_API_KEY is not configured on this deployment.");
  const sandbox = await Sandbox.create({ apiKey, timeoutMs: SANDBOX_RUN_TIMEOUT_MS });
  return {
    async writeFiles(files) {
      await sandbox.files.write(files.map((file) => ({ path: file.path, data: file.data })));
    },
    async runCode(code, opts) {
      const execution = await sandbox.runCode(code, { timeoutMs: opts.timeoutMs });
      return {
        error: execution.error ? { name: execution.error.name, value: execution.error.value } : undefined,
        logs: execution.logs,
      };
    },
    readFile: (path) => sandbox.files.read(path),
    async kill() {
      await sandbox.kill();
    },
  };
};

/**
 * Runs a bot owner's Python file for one turn, inside a fresh E2B sandbox that's killed again
 * before this returns (or throws) — see PythonBot's doc comment in prisma/schema.prisma for why
 * a new sandbox per message, rather than one kept alive for the conversation, is the deliberate
 * choice here. Never throws: sandbox creation failures, script exceptions, and malformed output
 * all come back as `{ kind: "error" }` so a caller can fall back to a friendly reply and keep
 * going, the same way engine/executor.ts's AI-node LLM-call failures do.
 */
export async function runPythonBotCode(
  code: string,
  input: PythonBotInput,
  createSandbox: CreateSandbox = createE2BSandbox,
): Promise<PythonBotRunResult> {
  async function run(): Promise<PythonBotRunResult> {
    const sandbox = await createSandbox();
    try {
      await sandbox.writeFiles([
        { path: "/tmp/chatmeo_input.json", data: JSON.stringify(input) },
        { path: "/tmp/chatmeo_bot.py", data: code },
      ]);
      const execution = await sandbox.runCode(RUNNER_SOURCE, { timeoutMs: SANDBOX_RUN_TIMEOUT_MS });
      const stdout = execution.logs.stdout.join("");
      const stderr = execution.logs.stderr.join("");
      if (execution.error) {
        return { kind: "error", message: `${execution.error.name}: ${execution.error.value}`, stdout, stderr };
      }

      const raw = await sandbox.readFile("/tmp/chatmeo_output.json");
      const parsed = JSON.parse(raw) as {
        reply: string | null;
        replies: string[] | null;
        state: unknown;
        handoff: boolean;
      };
      const replies =
        parsed.replies?.filter((reply): reply is string => typeof reply === "string" && reply.trim().length > 0) ??
        (parsed.reply && parsed.reply.trim() ? [parsed.reply] : []);
      const state =
        parsed.state && typeof parsed.state === "object" && !Array.isArray(parsed.state)
          ? (parsed.state as Record<string, unknown>)
          : {};

      return { kind: "success", replies, state, handoff: Boolean(parsed.handoff), stdout, stderr };
    } finally {
      await sandbox.kill().catch(() => {});
    }
  }

  try {
    return await Promise.race([
      run(),
      new Promise<PythonBotRunResult>((_, reject) =>
        setTimeout(() => reject(new Error("Python bot sandbox timed out.")), SANDBOX_HARD_TIMEOUT_MS),
      ),
    ]);
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error), stdout: "", stderr: "" };
  }
}
