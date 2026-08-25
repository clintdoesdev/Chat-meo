import { describe, expect, it, vi } from "vitest";
import { runPythonBotCode, type CreateSandbox, type SandboxHandle } from "./sandbox";

function fakeSandbox(overrides: Partial<SandboxHandle> = {}): SandboxHandle {
  return {
    writeFiles: vi.fn(async () => {}),
    runCode: vi.fn(async () => ({ logs: { stdout: [], stderr: [] } })),
    readFile: vi.fn(async () => JSON.stringify({ reply: null, replies: null, state: {}, handoff: false })),
    kill: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("runPythonBotCode", () => {
  it("writes the bot's code and the turn's input as files, then reads the reply back out", async () => {
    const sandbox = fakeSandbox({
      readFile: vi.fn(async () =>
        JSON.stringify({ reply: "Here's your link", replies: null, state: { step: 2 }, handoff: false }),
      ),
    });
    const createSandbox: CreateSandbox = vi.fn(async () => sandbox);

    const result = await runPythonBotCode(
      "chatmeo_reply = 'hi'",
      { message: "hello", history: [], state: {} },
      createSandbox,
    );

    expect(sandbox.writeFiles).toHaveBeenCalledWith([
      { path: "/tmp/chatmeo_input.json", data: JSON.stringify({ message: "hello", history: [], state: {} }) },
      { path: "/tmp/chatmeo_bot.py", data: "chatmeo_reply = 'hi'" },
    ]);
    expect(result).toEqual({
      kind: "success",
      replies: ["Here's your link"],
      state: { step: 2 },
      handoff: false,
      stdout: "",
      stderr: "",
    });
    expect(sandbox.kill).toHaveBeenCalledOnce();
  });

  it("collects multiple replies from chatmeo_replies, dropping blank entries", async () => {
    const sandbox = fakeSandbox({
      readFile: vi.fn(async () =>
        JSON.stringify({ reply: null, replies: ["First", "  ", "Second"], state: {}, handoff: false }),
      ),
    });

    const result = await runPythonBotCode("...", { message: "hi", history: [], state: {} }, async () => sandbox);

    expect(result).toMatchObject({ kind: "success", replies: ["First", "Second"] });
  });

  it("returns kind: 'success' with no replies when the script sets neither reply field — not an error", async () => {
    const sandbox = fakeSandbox();

    const result = await runPythonBotCode("pass", { message: "hi", history: [], state: {} }, async () => sandbox);

    expect(result).toEqual({ kind: "success", replies: [], state: {}, handoff: false, stdout: "", stderr: "" });
  });

  it("surfaces a script exception as kind: 'error' with the stdout/stderr captured so far, without reading output.json", async () => {
    const readFile = vi.fn();
    const sandbox = fakeSandbox({
      runCode: vi.fn(async () => ({
        error: { name: "NameError", value: "name 'undefined_var' is not defined" },
        logs: { stdout: ["partial output\n"], stderr: ["Traceback...\n"] },
      })),
      readFile,
    });

    const result = await runPythonBotCode("chatmeo_reply = undefined_var", { message: "hi", history: [], state: {} }, async () => sandbox);

    expect(result).toEqual({
      kind: "error",
      message: "NameError: name 'undefined_var' is not defined",
      stdout: "partial output\n",
      stderr: "Traceback...\n",
    });
    expect(readFile).not.toHaveBeenCalled();
  });

  it("always kills the sandbox, even when the run throws", async () => {
    const kill = vi.fn(async () => {});
    const sandbox = fakeSandbox({
      runCode: vi.fn(async () => {
        throw new Error("boom");
      }),
      kill,
    });

    const result = await runPythonBotCode("...", { message: "hi", history: [], state: {} }, async () => sandbox);

    expect(result).toEqual({ kind: "error", message: "boom", stdout: "", stderr: "" });
    expect(kill).toHaveBeenCalledOnce();
  });

  it("returns kind: 'error' when the sandbox factory itself fails (e.g. E2B_API_KEY missing)", async () => {
    const createSandbox: CreateSandbox = vi.fn(async () => {
      throw new Error("E2B_API_KEY is not configured on this deployment.");
    });

    const result = await runPythonBotCode("...", { message: "hi", history: [], state: {} }, createSandbox);

    expect(result).toEqual({
      kind: "error",
      message: "E2B_API_KEY is not configured on this deployment.",
      stdout: "",
      stderr: "",
    });
  });

  it("ignores a non-object state and falls back to {}", async () => {
    const sandbox = fakeSandbox({
      readFile: vi.fn(async () => JSON.stringify({ reply: "ok", replies: null, state: "not-an-object", handoff: false })),
    });

    const result = await runPythonBotCode("...", { message: "hi", history: [], state: {} }, async () => sandbox);

    expect(result).toMatchObject({ kind: "success", state: {} });
  });
});
