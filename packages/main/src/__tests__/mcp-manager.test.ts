import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockExistsSync = vi.fn<(path: string) => boolean>().mockReturnValue(false);
const mockReadFile = vi.fn<(path: string, encoding: string) => Promise<string>>();
const mockWriteFile = vi.fn<(path: string, data: string, encoding: string) => Promise<void>>()
  .mockResolvedValue(undefined);

vi.mock("node:fs", () => ({ existsSync: (...args: unknown[]) => mockExistsSync(args[0] as string) }));
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(args[0] as string, args[1] as string),
  writeFile: (...args: unknown[]) => mockWriteFile(args[0] as string, args[1] as string, args[2] as string),
}));

// Create a fake ChildProcess emitter
function makeFakeProcess(pid = 12345): EventEmitter & { pid: number; killed: boolean; stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> } {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    killed: boolean;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.pid = pid;
  proc.killed = false;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => { proc.killed = true; });
  return proc;
}

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]) => mockSpawn(...args) }));

// Fresh module import per test suite (singleton resets)
let McpServerManagerModule: typeof import("../mcp-manager.js");

beforeEach(async () => {
  vi.clearAllMocks();
  // Re-import to get a fresh singleton
  vi.resetModules();
  vi.doMock("../logger.js", () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }));
  vi.doMock("node:fs", () => ({ existsSync: (...args: unknown[]) => mockExistsSync(args[0] as string) }));
  vi.doMock("node:fs/promises", () => ({
    readFile: (...args: unknown[]) => mockReadFile(args[0] as string, args[1] as string),
    writeFile: (...args: unknown[]) => mockWriteFile(args[0] as string, args[1] as string, args[2] as string),
  }));
  vi.doMock("node:child_process", () => ({ spawn: (...args: unknown[]) => mockSpawn(...args) }));
  McpServerManagerModule = await import("../mcp-manager.js");
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("McpServerManager", () => {
  describe("getConfigPaths()", () => {
    it("returns default paths when no custom path is set", () => {
      const { mcpManager } = McpServerManagerModule;
      const paths = mcpManager.getConfigPaths();
      expect(paths).toContain(join(homedir(), ".cursor", "mcp.json"));
      expect(paths).toContain(join(homedir(), ".claude", "claude_desktop_config.json"));
    });

    it("prepends custom config path when set", () => {
      const { mcpManager } = McpServerManagerModule;
      mcpManager.setCustomConfigPath("/custom/mcp.json");
      const paths = mcpManager.getConfigPaths();
      expect(paths[0]).toBe("/custom/mcp.json");
    });
  });

  describe("loadConfigs()", () => {
    it("skips non-existent config files", async () => {
      const { mcpManager } = McpServerManagerModule;
      mockExistsSync.mockReturnValue(false);

      await mcpManager.loadConfigs();
      expect(mcpManager.getState()).toHaveLength(0);
    });

    it("loads servers from a valid config file", async () => {
      const { mcpManager } = McpServerManagerModule;
      const configPath = join(homedir(), ".cursor", "mcp.json");

      mockExistsSync.mockImplementation((p: string) => p === configPath);
      mockReadFile.mockResolvedValue(JSON.stringify({
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
            env: { PORT: "3000" },
          },
        },
      }));

      await mcpManager.loadConfigs();
      const state = mcpManager.getState();

      expect(state).toHaveLength(1);
      expect(state[0].config.name).toBe("test-server");
      expect(state[0].config.command).toBe("node");
      expect(state[0].config.args).toEqual(["server.js"]);
      expect(state[0].config.env).toEqual({ PORT: "3000" });
      expect(state[0].status).toBe("stopped");
    });

    it("uses first-found-wins for duplicate server names", async () => {
      const { mcpManager } = McpServerManagerModule;
      const cursorPath = join(homedir(), ".cursor", "mcp.json");
      const _claudePath = join(homedir(), ".claude", "claude_desktop_config.json");

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockImplementation(async (p: string) => {
        if (p === cursorPath) {
          return JSON.stringify({
            mcpServers: { "dup-server": { command: "cursor-cmd" } },
          });
        }
        return JSON.stringify({
          mcpServers: { "dup-server": { command: "claude-cmd" } },
        });
      });

      await mcpManager.loadConfigs();
      const state = mcpManager.getState();
      const dup = state.find((s) => s.config.name === "dup-server");
      expect(dup?.config.command).toBe("cursor-cmd");
    });

    it("skips entries without a command", async () => {
      const { mcpManager } = McpServerManagerModule;
      const configPath = join(homedir(), ".cursor", "mcp.json");

      mockExistsSync.mockImplementation((p: string) => p === configPath);
      mockReadFile.mockResolvedValue(JSON.stringify({
        mcpServers: {
          "no-cmd": { args: ["--help"] },
        },
      }));

      await mcpManager.loadConfigs();
      expect(mcpManager.getState()).toHaveLength(0);
    });

    it("handles malformed JSON gracefully", async () => {
      const { mcpManager } = McpServerManagerModule;
      const configPath = join(homedir(), ".cursor", "mcp.json");

      mockExistsSync.mockImplementation((p: string) => p === configPath);
      mockReadFile.mockResolvedValue("{ not valid json");

      await mcpManager.loadConfigs();
      expect(mcpManager.getState()).toHaveLength(0);
    });
  });

  describe("start() / stop()", () => {
    it("starts a server and sets status to running", async () => {
      const { mcpManager } = McpServerManagerModule;
      const configPath = join(homedir(), ".cursor", "mcp.json");

      mockExistsSync.mockImplementation((p: string) => p === configPath);
      mockReadFile.mockResolvedValue(JSON.stringify({
        mcpServers: { "my-server": { command: "node", args: ["index.js"] } },
      }));
      await mcpManager.loadConfigs();

      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);

      await mcpManager.start("my-server");

      const state = mcpManager.getState();
      const server = state.find((s) => s.config.name === "my-server");
      expect(server?.status).toBe("running");
      expect(server?.pid).toBe(12345);

      // Cleanup
      mcpManager.shutdown();
    });

    it("stops a running server", async () => {
      const { mcpManager } = McpServerManagerModule;
      const configPath = join(homedir(), ".cursor", "mcp.json");

      mockExistsSync.mockImplementation((p: string) => p === configPath);
      mockReadFile.mockResolvedValue(JSON.stringify({
        mcpServers: { "stop-test": { command: "node", args: [] } },
      }));
      await mcpManager.loadConfigs();

      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);
      await mcpManager.start("stop-test");

      mcpManager.stop("stop-test");

      const state = mcpManager.getState();
      const server = state.find((s) => s.config.name === "stop-test");
      expect(server?.status).toBe("stopped");
      expect(server?.pid).toBeNull();

      mcpManager.shutdown();
    });

    it("throws when starting an unknown server", async () => {
      const { mcpManager } = McpServerManagerModule;
      await expect(mcpManager.start("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("onStatusChange()", () => {
    it("notifies listeners on status changes", async () => {
      const { mcpManager } = McpServerManagerModule;
      const configPath = join(homedir(), ".cursor", "mcp.json");

      mockExistsSync.mockImplementation((p: string) => p === configPath);
      mockReadFile.mockResolvedValue(JSON.stringify({
        mcpServers: { "cb-server": { command: "echo", args: ["hi"] } },
      }));
      await mcpManager.loadConfigs();

      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);

      const cb = vi.fn();
      mcpManager.onStatusChange(cb);

      await mcpManager.start("cb-server");

      // Should have been called for "starting" and "running"
      expect(cb).toHaveBeenCalledTimes(2);
      expect(cb.mock.calls[0][0].status).toBe("starting");
      expect(cb.mock.calls[1][0].status).toBe("running");

      mcpManager.offStatusChange(cb);
      mcpManager.shutdown();
    });
  });

  describe("addConfig()", () => {
    it("persists a new config entry and updates in-memory state", async () => {
      const { mcpManager } = McpServerManagerModule;

      mockExistsSync.mockReturnValue(false);
      mcpManager.setCustomConfigPath("/tmp/mcp.json");

      await mcpManager.addConfig({
        name: "new-server",
        command: "npx",
        args: ["-y", "some-mcp-server"],
      });

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
      expect(written.mcpServers["new-server"]).toBeDefined();
      expect(written.mcpServers["new-server"].command).toBe("npx");

      const state = mcpManager.getState();
      expect(state.find((s) => s.config.name === "new-server")).toBeDefined();
    });
  });

  describe("removeConfig()", () => {
    it("removes a config from memory and disk", async () => {
      const { mcpManager } = McpServerManagerModule;

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify({
        mcpServers: { "rm-server": { command: "node", args: [] } },
      }));
      await mcpManager.loadConfigs();

      expect(mcpManager.getState()).toHaveLength(1);

      await mcpManager.removeConfig("rm-server");

      expect(mcpManager.getState()).toHaveLength(0);
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });
});
