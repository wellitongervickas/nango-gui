import { spawn } from "node:child_process";

export type CliStream = "stdout" | "stderr";

export interface CliRunOptions {
  /** Executable to run (e.g. "nango", "node"). */
  command: string;
  /** Arguments to pass to the executable. */
  args: string[];
  /** Working directory for the subprocess. Defaults to cwd of the main process. */
  cwd?: string;
  /** Additional environment variables to inject on top of process.env. */
  env?: Record<string, string>;
}

export interface CliLineEvent {
  stream: CliStream;
  line: string;
}

export interface CliExitEvent {
  code: number | null;
  signal: string | null;
}

/** Handle for a live subprocess — allows observation and termination. */
export interface CliRunner {
  readonly pid: number | undefined;
  /** Send SIGTERM to the subprocess. No-op if already exited. */
  kill(): void;
}

/**
 * Spawn a CLI subprocess and stream its stdout/stderr line-by-line.
 *
 * @param options  - Command, args, cwd, and env for the subprocess.
 * @param onLine   - Called once per non-empty output line.
 * @param onExit   - Called once when the process closes (after all output).
 * @returns        A CliRunner handle for kill() and pid access.
 */
export function spawnCli(
  options: CliRunOptions,
  onLine: (event: CliLineEvent) => void,
  onExit: (event: CliExitEvent) => void
): CliRunner {
  const proc = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    // stdin closed, stdout and stderr piped for streaming
    stdio: ["ignore", "pipe", "pipe"],
  });

  function emitLines(stream: CliStream, chunk: Buffer): void {
    const text = chunk.toString("utf8");
    for (const line of text.split(/\r?\n/)) {
      if (line.length > 0) onLine({ stream, line });
    }
  }

  proc.stdout!.on("data", (chunk: Buffer) => emitLines("stdout", chunk));
  proc.stderr!.on("data", (chunk: Buffer) => emitLines("stderr", chunk));
  proc.on("error", (err) => {
    onLine({ stream: "stderr", line: `Error: ${err.message}` });
    onExit({ code: 1, signal: null });
  });
  proc.on("close", (code, signal) => onExit({ code, signal }));

  return {
    get pid() {
      return proc.pid;
    },
    kill() {
      proc.kill("SIGTERM");
    },
  };
}
