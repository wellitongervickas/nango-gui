/**
 * MCP server lifecycle manager.
 *
 * Discovers MCP config files, spawns/kills server processes, monitors health,
 * and inventories available tools. Does NOT implement the MCP protocol itself.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  McpServerConfig,
  McpServerState,
  McpServerStatus,
  McpStatusChangedEvent,
} from "@nango-gui/shared";
import log from "./logger.js";

const HEALTH_CHECK_INTERVAL_MS = 30_000;

type StatusCallback = (event: McpStatusChangedEvent) => void;

/** Known config file locations to scan (in priority order). */
const DEFAULT_CONFIG_PATHS = [
  join(homedir(), ".cursor", "mcp.json"),
  join(homedir(), ".claude", "claude_desktop_config.json"),
];

interface ManagedServer {
  config: McpServerConfig;
  status: McpServerStatus;
  process: ChildProcess | null;
  tools: string[];
  error: string | null;
  updatedAt: string;
}

class McpServerManager {
  private servers = new Map<string, ManagedServer>();
  private listeners = new Set<StatusCallback>();
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private customConfigPath: string | null = null;

  /** Set a custom config path (from app settings). */
  setCustomConfigPath(path: string | null): void {
    this.customConfigPath = path;
  }

  /** Get all config file paths to scan. */
  getConfigPaths(): string[] {
    const paths = [...DEFAULT_CONFIG_PATHS];
    if (this.customConfigPath) paths.unshift(this.customConfigPath);
    return paths;
  }

  /** Discover and load MCP server configs from known locations. */
  async loadConfigs(): Promise<void> {
    const paths = this.getConfigPaths();

    for (const configPath of paths) {
      if (!existsSync(configPath)) continue;

      try {
        const raw = await readFile(configPath, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        // MCP config format: { "mcpServers": { "name": { command, args, env } } }
        const mcpServers = (parsed.mcpServers ?? parsed.servers ?? {}) as Record<string, unknown>;

        for (const [name, serverDef] of Object.entries(mcpServers)) {
          if (this.servers.has(name)) continue; // First found wins
          const def = serverDef as Record<string, unknown>;

          const config: McpServerConfig = {
            name,
            command: String(def.command ?? ""),
            args: Array.isArray(def.args) ? def.args.map(String) : [],
            env: def.env && typeof def.env === "object"
              ? def.env as Record<string, string>
              : undefined,
            sourceFile: configPath,
          };

          if (!config.command) continue; // Skip invalid entries

          this.servers.set(name, {
            config,
            status: "stopped",
            process: null,
            tools: [],
            error: null,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        log.error(`[MCP] Failed to parse config at ${configPath}:`, err);
      }
    }
  }

  /** Get the current state of all known servers. */
  getState(): McpServerState[] {
    return Array.from(this.servers.values()).map((s) => ({
      config: s.config,
      status: s.status,
      pid: s.process?.pid ?? null,
      tools: s.tools,
      error: s.error,
      updatedAt: s.updatedAt,
    }));
  }

  /** Start an MCP server by name. */
  async start(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) throw new Error(`MCP server "${name}" not found`);
    if (server.status === "running" || server.status === "starting") return;

    this.setStatus(server, "starting", null);

    try {
      const proc = spawn(server.config.command, server.config.args, {
        env: { ...process.env, ...(server.config.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"],
      });

      server.process = proc;

      // Collect stdout for tool discovery
      const stdoutChunks: string[] = [];
      proc.stdout?.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk.toString());
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        log.warn(`[MCP:${name}] stderr: ${chunk.toString().trim()}`);
      });

      proc.on("error", (err) => {
        log.error(`[MCP:${name}] spawn error:`, err.message);
        server.process = null;
        this.setStatus(server, "error", err.message);
      });

      proc.on("close", (code, signal) => {
        server.process = null;
        if (server.status !== "stopped") {
          // Unexpected exit
          const msg = signal
            ? `Process killed by ${signal}`
            : `Process exited with code ${code}`;
          log.warn(`[MCP:${name}] ${msg}`);
          this.setStatus(server, "error", msg);
        }
      });

      // Give the process a moment to start, then mark running
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Status may have changed asynchronously via error/close handlers —
      // read through the object to prevent TypeScript control-flow narrowing
      if ((server as ManagedServer).status === "starting" && server.process && !server.process.killed) {
        // Try to discover tools from initial stdout
        const output = stdoutChunks.join("");
        server.tools = parseToolNames(output);
        this.setStatus(server, "running", null);
      }

      this.ensureHealthMonitor();
    } catch (err) {
      server.process = null;
      const msg = err instanceof Error ? err.message : "Failed to start";
      this.setStatus(server, "error", msg);
      throw err;
    }
  }

  /** Stop an MCP server by name. */
  stop(name: string): void {
    const server = this.servers.get(name);
    if (!server) throw new Error(`MCP server "${name}" not found`);
    if (!server.process) {
      this.setStatus(server, "stopped", null);
      return;
    }

    this.setStatus(server, "stopped", null);
    server.process.kill("SIGTERM");
    server.process = null;
  }

  /** Add a new server config entry and persist to the config file. */
  async addConfig(config: Omit<McpServerConfig, "sourceFile">, targetFile?: string): Promise<void> {
    const configPath = targetFile ?? this.findWritableConfigPath();
    if (!configPath) throw new Error("No writable MCP config file found");

    // Read existing config
    let parsed: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        parsed = JSON.parse(await readFile(configPath, "utf-8"));
      } catch {
        parsed = {};
      }
    }

    // Add/update the server entry
    const servers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
    servers[config.name] = {
      command: config.command,
      args: config.args,
      ...(config.env ? { env: config.env } : {}),
    };
    parsed.mcpServers = servers;

    await writeFile(configPath, JSON.stringify(parsed, null, 2), "utf-8");

    // Update in-memory state
    this.servers.set(config.name, {
      config: { ...config, sourceFile: configPath },
      status: "stopped",
      process: null,
      tools: [],
      error: null,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Remove a server config entry and persist the change. */
  async removeConfig(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) throw new Error(`MCP server "${name}" not found`);

    // Stop if running
    if (server.process) {
      this.stop(name);
    }

    // Update config file
    const configPath = server.config.sourceFile;
    if (existsSync(configPath)) {
      try {
        const parsed = JSON.parse(await readFile(configPath, "utf-8")) as Record<string, unknown>;
        const servers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
        delete servers[name];
        parsed.mcpServers = servers;
        await writeFile(configPath, JSON.stringify(parsed, null, 2), "utf-8");
      } catch (err) {
        log.error(`[MCP] Failed to update config file ${configPath}:`, err);
      }
    }

    this.servers.delete(name);
  }

  /** Register a callback for status change events. */
  onStatusChange(cb: StatusCallback): void {
    this.listeners.add(cb);
  }

  /** Remove a status change callback. */
  offStatusChange(cb: StatusCallback): void {
    this.listeners.delete(cb);
  }

  /** Stop all servers and clean up. */
  shutdown(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    for (const [name] of this.servers) {
      try {
        this.stop(name);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private setStatus(server: ManagedServer, status: McpServerStatus, error: string | null): void {
    server.status = status;
    server.error = error;
    server.updatedAt = new Date().toISOString();

    const event: McpStatusChangedEvent = {
      name: server.config.name,
      status,
      pid: server.process?.pid ?? null,
      error,
    };

    for (const cb of this.listeners) {
      try {
        cb(event);
      } catch {
        // Listener errors must not break the manager
      }
    }
  }

  private ensureHealthMonitor(): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => {
      for (const server of this.servers.values()) {
        if (server.status === "running" && server.process) {
          // Check if process is still alive
          try {
            process.kill(server.process.pid!, 0); // Signal 0 = existence check
          } catch {
            server.process = null;
            this.setStatus(server, "error", "Process disappeared unexpectedly");
          }
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private findWritableConfigPath(): string | null {
    if (this.customConfigPath) return this.customConfigPath;
    // Default to first path
    return DEFAULT_CONFIG_PATHS[0];
  }
}

/** Try to extract tool names from server stdout (best-effort). */
function parseToolNames(output: string): string[] {
  try {
    // Look for JSON-RPC response with tools/list result
    const lines = output.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const parsed = JSON.parse(line);
      if (parsed.result?.tools && Array.isArray(parsed.result.tools)) {
        return parsed.result.tools
          .map((t: { name?: string }) => t.name)
          .filter(Boolean) as string[];
      }
    }
  } catch {
    // Not valid JSON-RPC output — that's fine
  }
  return [];
}

/** Singleton manager instance. */
export const mcpManager = new McpServerManager();
