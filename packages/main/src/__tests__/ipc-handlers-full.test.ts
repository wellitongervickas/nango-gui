import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Nango SDK mocks ──────────────────────────────────────────────────────────

const mockListConnections = vi.fn();
const mockGetConnection = vi.fn();
const mockDeleteConnection = vi.fn();
const mockListProviders = vi.fn();
const mockGetProvider = vi.fn();
const mockSyncStatus = vi.fn();
const mockTriggerSync = vi.fn();
const mockPauseSync = vi.fn();
const mockStartSync = vi.fn();
const mockListRecords = vi.fn();
const mockTriggerAction = vi.fn();
const mockProxy = vi.fn();

vi.mock("@nangohq/node", () => ({
  Nango: vi.fn().mockImplementation(() => ({
    listConnections: mockListConnections,
    getConnection: mockGetConnection,
    deleteConnection: mockDeleteConnection,
    listProviders: mockListProviders,
    getProvider: mockGetProvider,
    syncStatus: mockSyncStatus,
    triggerSync: mockTriggerSync,
    pauseSync: mockPauseSync,
    startSync: mockStartSync,
    listRecords: mockListRecords,
    triggerAction: mockTriggerAction,
    proxy: mockProxy,
  })),
}));

// ── Electron mocks ───────────────────────────────────────────────────────────

const mockSafeStorage = {
  isEncryptionAvailable: vi.fn().mockReturnValue(true),
  encryptString: vi.fn().mockReturnValue(Buffer.from("encrypted")),
  decryptString: vi.fn().mockReturnValue("test-secret-key"),
};

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: {
    getVersion: () => "1.0.0",
    getPath: () => "/tmp/test",
  },
  safeStorage: mockSafeStorage,
}));

vi.mock("fs", async () => ({
  ...(await vi.importActual<typeof import("fs")>("fs")),
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("encrypted")),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { initNangoClient, resetNangoClient } from "../nango-client.js";

// ── Helper ───────────────────────────────────────────────────────────────────

async function captureHandlers(): Promise<Map<string, (...args: unknown[]) => unknown>> {
  const { ipcMain } = await import("electron");
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  vi.mocked(ipcMain.handle).mockImplementation(
    ((ch: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(ch, fn);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );
  const { registerIpcHandlers } = await import("../ipc-handlers.js");
  registerIpcHandlers();
  return handlers;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("IPC handlers", () => {
  let handlers: Map<string, (...args: unknown[]) => unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await initNangoClient("test-secret-key");
    handlers = await captureHandlers();
  });

  afterEach(() => {
    resetNangoClient();
  });

  // ── Connection handlers ──────────────────────────────────────────────────

  describe("nango:listConnections", () => {
    it("returns mapped connection summaries", async () => {
      mockListConnections.mockResolvedValueOnce({
        connections: [
          {
            id: 1,
            connection_id: "conn-1",
            provider: "github",
            provider_config_key: "github-key",
            created: "2024-01-01T00:00:00Z",
            metadata: { team: "eng" },
          },
        ],
      });

      const handler = handlers.get("nango:listConnections")!;
      const result = await handler({});

      expect(result).toMatchObject({
        status: "ok",
        data: [
          {
            id: 1,
            connection_id: "conn-1",
            provider: "github",
            provider_config_key: "github-key",
            created: "2024-01-01T00:00:00Z",
            metadata: { team: "eng" },
          },
        ],
      });
    });

    it("passes integrationId filter when provided", async () => {
      mockListConnections.mockResolvedValueOnce({ connections: [] });
      const handler = handlers.get("nango:listConnections")!;
      await handler({}, { integrationId: "slack" });
      expect(mockListConnections).toHaveBeenCalledWith({ integrationId: "slack" });
    });

    it("wraps errors with errorCode", async () => {
      mockListConnections.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
      const handler = handlers.get("nango:listConnections")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "error", errorCode: "AUTH_INVALID" });
    });
  });

  describe("nango:getConnection", () => {
    it("returns connection detail", async () => {
      mockGetConnection.mockResolvedValueOnce({
        id: 42,
        connection_id: "conn-42",
        provider_config_key: "gh",
        provider: "github",
        credentials: { access_token: "tok" },
        created: "2024-01-01",
      });

      const handler = handlers.get("nango:getConnection")!;
      const result = await handler({}, { providerConfigKey: "gh", connectionId: "conn-42" });

      expect(result).toMatchObject({
        status: "ok",
        data: { id: 42, connection_id: "conn-42", provider: "github" },
      });
      expect(mockGetConnection).toHaveBeenCalledWith("gh", "conn-42");
    });
  });

  describe("nango:deleteConnection", () => {
    it("deletes and returns ok", async () => {
      mockDeleteConnection.mockResolvedValueOnce(undefined);
      const handler = handlers.get("nango:deleteConnection")!;
      const result = await handler({}, { providerConfigKey: "gh", connectionId: "conn-1" });
      expect(result).toMatchObject({ status: "ok" });
      expect(mockDeleteConnection).toHaveBeenCalledWith("gh", "conn-1");
    });
  });

  // ── Provider handlers ────────────────────────────────────────────────────

  describe("nango:listProviders", () => {
    it("returns provider list", async () => {
      mockListProviders.mockResolvedValueOnce({
        data: [
          { name: "github", display_name: "GitHub", logo_url: "gh.png", auth_mode: "OAUTH2", categories: ["dev"] },
        ],
      });

      const handler = handlers.get("nango:listProviders")!;
      const result = await handler({});

      expect(result).toMatchObject({
        status: "ok",
        data: [{ name: "github", display_name: "GitHub" }],
      });
    });

    it("wraps 429 as RATE_LIMITED", async () => {
      mockListProviders.mockRejectedValueOnce(Object.assign(new Error("Too Many Requests"), { status: 429 }));
      const handler = handlers.get("nango:listProviders")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "error", errorCode: "RATE_LIMITED" });
    });
  });

  describe("nango:getProvider", () => {
    it("returns a single provider", async () => {
      mockGetProvider.mockResolvedValueOnce({
        data: { name: "slack", display_name: "Slack", logo_url: "sl.png", auth_mode: "OAUTH2" },
      });

      const handler = handlers.get("nango:getProvider")!;
      const result = await handler({}, { provider: "slack" });

      expect(result).toMatchObject({ status: "ok", data: { name: "slack" } });
      expect(mockGetProvider).toHaveBeenCalledWith({ provider: "slack" });
    });
  });

  // ── Sync handlers ────────────────────────────────────────────────────────

  describe("nango:listSyncs", () => {
    it("returns mapped sync records", async () => {
      mockSyncStatus.mockResolvedValueOnce({
        syncs: [
          {
            id: "s1",
            name: "get-contacts",
            status: "RUNNING",
            type: "INCREMENTAL",
            frequency: "every 10 minutes",
            finishedAt: "2024-06-01T00:00:00Z",
            nextScheduledSyncAt: "2024-06-01T00:10:00Z",
            latestResult: { added: 5, updated: 2, deleted: 0 },
          },
        ],
      });

      const handler = handlers.get("nango:listSyncs")!;
      const result = await handler({}, { connectionId: "conn-1", providerConfigKey: "gh" });

      expect(result).toMatchObject({
        status: "ok",
        data: [
          {
            id: "s1",
            name: "get-contacts",
            status: "RUNNING",
            latestResult: { added: 5, updated: 2, deleted: 0 },
          },
        ],
      });
      expect(mockSyncStatus).toHaveBeenCalledWith("gh", [], "conn-1");
    });
  });

  describe("nango:getSyncStatus", () => {
    it("passes specific sync names", async () => {
      mockSyncStatus.mockResolvedValueOnce({ syncs: [] });
      const handler = handlers.get("nango:getSyncStatus")!;
      await handler({}, { providerConfigKey: "gh", syncs: ["sync-a", "sync-b"], connectionId: "c1" });
      expect(mockSyncStatus).toHaveBeenCalledWith("gh", ["sync-a", "sync-b"], "c1");
    });
  });

  describe("nango:triggerSync", () => {
    it("triggers a sync successfully", async () => {
      mockTriggerSync.mockResolvedValueOnce(undefined);
      const handler = handlers.get("nango:triggerSync")!;
      const result = await handler({}, {
        providerConfigKey: "gh",
        syncs: ["get-repos"],
        connectionId: "c1",
        fullResync: true,
      });
      expect(result).toMatchObject({ status: "ok" });
      expect(mockTriggerSync).toHaveBeenCalledWith("gh", ["get-repos"], "c1", true);
    });
  });

  describe("nango:pauseSync", () => {
    it("pauses a sync successfully", async () => {
      mockPauseSync.mockResolvedValueOnce(undefined);
      const handler = handlers.get("nango:pauseSync")!;
      const result = await handler({}, { providerConfigKey: "gh", syncs: ["s1"], connectionId: "c1" });
      expect(result).toMatchObject({ status: "ok" });
      expect(mockPauseSync).toHaveBeenCalledWith("gh", ["s1"], "c1");
    });
  });

  describe("nango:startSync", () => {
    it("starts a sync successfully", async () => {
      mockStartSync.mockResolvedValueOnce(undefined);
      const handler = handlers.get("nango:startSync")!;
      const result = await handler({}, { providerConfigKey: "gh", syncs: ["s1"], connectionId: "c1" });
      expect(result).toMatchObject({ status: "ok" });
      expect(mockStartSync).toHaveBeenCalledWith("gh", ["s1"], "c1");
    });
  });

  // ── Records handler ──────────────────────────────────────────────────────

  describe("nango:listRecords", () => {
    it("returns records with next_cursor", async () => {
      mockListRecords.mockResolvedValueOnce({
        records: [
          { id: "r1", name: "Alice", _nango_metadata: { first_seen_at: "2024-01-01", last_modified_at: "2024-01-02", last_action: "ADDED", deleted_at: null, cursor: "abc" } },
        ],
        next_cursor: "cursor-2",
      });

      const handler = handlers.get("nango:listRecords")!;
      const result = await handler({}, { providerConfigKey: "gh", connectionId: "c1", model: "contacts", limit: 50 });

      expect(result).toMatchObject({
        status: "ok",
        data: {
          records: [{ id: "r1" }],
          next_cursor: "cursor-2",
        },
      });
    });

    it("passes optional filter and cursor", async () => {
      mockListRecords.mockResolvedValueOnce({ records: [], next_cursor: null });
      const handler = handlers.get("nango:listRecords")!;
      await handler({}, {
        providerConfigKey: "gh",
        connectionId: "c1",
        model: "contacts",
        cursor: "abc",
        filter: "updated",
        modifiedAfter: "2024-01-01",
      });
      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "abc", filter: "updated", modifiedAfter: "2024-01-01" }),
      );
    });
  });

  // ── Action & Proxy handlers ──────────────────────────────────────────────

  describe("nango:triggerAction", () => {
    it("returns action result", async () => {
      mockTriggerAction.mockResolvedValueOnce({ id: 123, title: "Created" });

      const handler = handlers.get("nango:triggerAction")!;
      const result = await handler({}, {
        integrationId: "gh",
        connectionId: "c1",
        actionName: "create-issue",
        input: { title: "Bug" },
      });

      expect(result).toMatchObject({ status: "ok", data: { result: { id: 123, title: "Created" } } });
      expect(mockTriggerAction).toHaveBeenCalledWith("gh", "c1", "create-issue", { title: "Bug" });
    });
  });

  describe("nango:proxyRequest", () => {
    it("returns proxy response", async () => {
      mockProxy.mockResolvedValueOnce({
        status: 200,
        headers: { "content-type": "application/json" },
        data: { repos: [] },
      });

      const handler = handlers.get("nango:proxyRequest")!;
      const result = await handler({}, {
        integrationId: "gh",
        connectionId: "c1",
        method: "GET",
        endpoint: "/repos",
      });

      expect(result).toMatchObject({
        status: "ok",
        data: { status: 200, data: { repos: [] } },
      });
    });

    it("passes headers and data for POST", async () => {
      mockProxy.mockResolvedValueOnce({ status: 201, headers: {}, data: {} });
      const handler = handlers.get("nango:proxyRequest")!;
      await handler({}, {
        integrationId: "gh",
        connectionId: "c1",
        method: "POST",
        endpoint: "/repos",
        headers: { "X-Custom": "val" },
        data: { name: "new-repo" },
        params: { org: "acme" },
      });
      expect(mockProxy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          endpoint: "/repos",
          headers: { "X-Custom": "val" },
          data: { name: "new-repo" },
          params: { org: "acme" },
        }),
      );
    });
  });

  // ── Dashboard handler ────────────────────────────────────────────────────

  describe("nango:getDashboard", () => {
    it("aggregates dashboard data", async () => {
      mockListConnections.mockResolvedValueOnce({
        connections: [
          { id: 1, connection_id: "c1", provider: "github", provider_config_key: "gh", created: "2024-01-01" },
          { id: 2, connection_id: "c2", provider: "slack", provider_config_key: "sl", created: "2024-01-02" },
        ],
      });
      mockSyncStatus
        .mockResolvedValueOnce({
          syncs: [
            { name: "contacts", status: "RUNNING", finishedAt: "2024-06-01" },
            { name: "repos", status: "ERROR", finishedAt: "2024-05-01" },
          ],
        })
        .mockResolvedValueOnce({
          syncs: [{ name: "messages", status: "PAUSED", finishedAt: null }],
        });

      const handler = handlers.get("nango:getDashboard")!;
      const result = await handler({});

      expect(result).toMatchObject({
        status: "ok",
        data: {
          totalConnections: 2,
          totalSyncs: 3,
          runningSyncs: 1,
          pausedSyncs: 1,
          errorSyncs: 1,
        },
      });
    });

    it("handles connections with no syncs gracefully", async () => {
      mockListConnections.mockResolvedValueOnce({
        connections: [
          { id: 1, connection_id: "c1", provider: "github", provider_config_key: "gh", created: "2024-01-01" },
        ],
      });
      mockSyncStatus.mockRejectedValueOnce(new Error("No syncs"));

      const handler = handlers.get("nango:getDashboard")!;
      const result = await handler({});

      expect(result).toMatchObject({
        status: "ok",
        data: { totalConnections: 1, totalSyncs: 0 },
      });
    });
  });

  // ── Credential handlers ──────────────────────────────────────────────────

  describe("credentials:exists", () => {
    it("returns true when key is stored", async () => {
      const handler = handlers.get("credentials:exists")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "ok", data: { exists: true } });
    });
  });

  describe("credentials:clear", () => {
    it("clears credentials and resets client", async () => {
      const handler = handlers.get("credentials:clear")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "ok" });
    });
  });

  // ── App settings handlers ────────────────────────────────────────────────

  describe("app:getSettings", () => {
    it("returns combined settings", async () => {
      const handler = handlers.get("app:getSettings")!;
      const result = await handler({});
      expect(result).toMatchObject({
        status: "ok",
        data: {
          appVersion: "1.0.0",
          nangoSdkVersion: "0.69.49",
        },
      });
    });
  });

  describe("app:updateSettings", () => {
    it("returns ok on success", async () => {
      const handler = handlers.get("app:updateSettings")!;
      const result = await handler({}, { theme: "dark" });
      expect(result).toMatchObject({ status: "ok" });
    });
  });

  describe("app:getEnvironment", () => {
    it("returns the stored environment", async () => {
      const handler = handlers.get("app:getEnvironment")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "ok", data: { environment: expect.any(String) } });
    });
  });

  describe("app:setEnvironment", () => {
    it("saves the environment", async () => {
      const handler = handlers.get("app:setEnvironment")!;
      const result = await handler({}, { environment: "production" });
      expect(result).toMatchObject({ status: "ok" });
    });
  });

  // ── Error classification integration ─────────────────────────────────────

  describe("error classification", () => {
    it("classifies 500 as SERVER_ERROR", async () => {
      mockListConnections.mockRejectedValueOnce(Object.assign(new Error("Internal"), { status: 500 }));
      const handler = handlers.get("nango:listConnections")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "error", errorCode: "SERVER_ERROR" });
    });

    it("classifies fetch failures as NETWORK_ERROR", async () => {
      mockListConnections.mockRejectedValueOnce(new Error("fetch failed"));
      const handler = handlers.get("nango:listConnections")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "error", errorCode: "NETWORK_ERROR" });
    });

    it("classifies ECONNREFUSED as NETWORK_ERROR", async () => {
      mockListConnections.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:443"));
      const handler = handlers.get("nango:listConnections")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "error", errorCode: "NETWORK_ERROR" });
    });

    it("classifies client not initialized as CLIENT_NOT_READY", async () => {
      resetNangoClient();
      const handler = handlers.get("nango:listConnections")!;
      const result = await handler({});
      expect(result).toMatchObject({ status: "error", errorCode: "CLIENT_NOT_READY" });
    });
  });
});
