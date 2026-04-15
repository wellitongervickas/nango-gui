import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawnCli } from "../cli-runner.js";
import { spawn } from "node:child_process";

function makeMockProcess() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = Object.assign(new EventEmitter(), {
    pid: 42,
    stdout,
    stderr,
    kill: vi.fn(),
  });
  return proc;
}

describe("spawnCli", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("spawns with the correct command, args, and cwd", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    spawnCli({ command: "nango", args: ["deploy"], cwd: "/some/dir" }, () => {}, () => {});

    expect(spawn).toHaveBeenCalledWith(
      "nango",
      ["deploy"],
      expect.objectContaining({ cwd: "/some/dir", stdio: ["ignore", "pipe", "pipe"] })
    );
  });

  it("merges custom env on top of process.env", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    spawnCli({ command: "nango", args: [], env: { MY_VAR: "hello" } }, () => {}, () => {});

    expect(spawn).toHaveBeenCalledWith(
      "nango",
      [],
      expect.objectContaining({
        env: expect.objectContaining({ MY_VAR: "hello" }),
      })
    );
  });

  it("emits stdout lines to onLine", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const lines: { stream: string; line: string }[] = [];
    spawnCli({ command: "nango", args: [] }, (e) => lines.push(e), () => {});

    proc.stdout.emit("data", Buffer.from("line1\nline2\n"));

    expect(lines).toEqual([
      { stream: "stdout", line: "line1" },
      { stream: "stdout", line: "line2" },
    ]);
  });

  it("emits stderr lines to onLine", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const lines: { stream: string; line: string }[] = [];
    spawnCli({ command: "nango", args: [] }, (e) => lines.push(e), () => {});

    proc.stderr.emit("data", Buffer.from("error: something went wrong\n"));

    expect(lines).toEqual([{ stream: "stderr", line: "error: something went wrong" }]);
  });

  it("skips empty lines", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const lines: unknown[] = [];
    spawnCli({ command: "nango", args: [] }, (e) => lines.push(e), () => {});

    proc.stdout.emit("data", Buffer.from("\n\n\n"));

    expect(lines).toHaveLength(0);
  });

  it("handles Windows-style CRLF line endings", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const lines: { line: string }[] = [];
    spawnCli({ command: "nango", args: [] }, (e) => lines.push(e), () => {});

    proc.stdout.emit("data", Buffer.from("line1\r\nline2\r\n"));

    expect(lines.map((l) => l.line)).toEqual(["line1", "line2"]);
  });

  it("calls onExit with code and signal on close", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const exits: { code: number | null; signal: string | null }[] = [];
    spawnCli({ command: "nango", args: [] }, () => {}, (e) => exits.push(e));

    proc.emit("close", 0, null);

    expect(exits).toEqual([{ code: 0, signal: null }]);
  });

  it("calls onExit with non-zero code on failure", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const exits: { code: number | null; signal: string | null }[] = [];
    spawnCli({ command: "nango", args: [] }, () => {}, (e) => exits.push(e));

    proc.emit("close", 1, null);

    expect(exits).toEqual([{ code: 1, signal: null }]);
  });

  it("calls onExit with signal when killed", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const exits: { code: number | null; signal: string | null }[] = [];
    spawnCli({ command: "nango", args: [] }, () => {}, (e) => exits.push(e));

    proc.emit("close", null, "SIGTERM");

    expect(exits).toEqual([{ code: null, signal: "SIGTERM" }]);
  });

  it("exposes the child process pid", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const runner = spawnCli({ command: "nango", args: [] }, () => {}, () => {});

    expect(runner.pid).toBe(42);
  });

  it("kills the process with SIGTERM", () => {
    const proc = makeMockProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);

    const runner = spawnCli({ command: "nango", args: [] }, () => {}, () => {});
    runner.kill();

    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
  });
});
