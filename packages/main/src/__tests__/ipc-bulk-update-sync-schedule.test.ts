import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Captures every (providerConfigKey, syncName, connectionId, frequency) call
// so each test can stub success/failure per syncName independently.
const mockUpdateSyncConnectionFrequency = vi.fn();

vi.mock("@nangohq/node", () => ({
  Nango: vi.fn().mockImplementation(() => ({
    listConnections: vi.fn().mockResolvedValue({ connections: [] }),
    updateSyncConnectionFrequency: mockUpdateSyncConnectionFrequency,
  })),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

import { initNangoClient, resetNangoClient } from "../nango-client.js";

async function captureHandler(channel: string) {
  const { ipcMain } = await import("electron");
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  vi.mocked(ipcMain.handle).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((ch: string, fn: (...args: any[]) => any) => {
      handlers.set(ch, fn);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  );
  const { registerIpcHandlers } = await import("../ipc-handlers.js");
  registerIpcHandlers();
  return handlers.get(channel);
}

describe("nango:bulkUpdateSyncSchedule IPC handler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await initNangoClient("test-secret-key");
  });

  afterEach(() => {
    resetNangoClient();
  });

  it("applies every entry sequentially and returns ok results in request order", async () => {
    mockUpdateSyncConnectionFrequency
      .mockResolvedValueOnce({ frequency: "every 5m" })
      .mockResolvedValueOnce({ frequency: "every 1h" });

    const handler = await captureHandler("nango:bulkUpdateSyncSchedule");
    const result = await handler!(
      {},
      {
        providerConfigKey: "github",
        connectionId: "conn-1",
        entries: [
          { syncName: "issues", frequency: "every 5m" },
          { syncName: "pulls", frequency: "every 1h" },
        ],
      },
    );

    expect(result).toEqual({
      status: "ok",
      data: {
        results: [
          { syncName: "issues", status: "ok", frequency: "every 5m" },
          { syncName: "pulls", status: "ok", frequency: "every 1h" },
        ],
        allSucceeded: true,
      },
      error: null,
    });
    expect(mockUpdateSyncConnectionFrequency).toHaveBeenCalledTimes(2);
    expect(mockUpdateSyncConnectionFrequency).toHaveBeenNthCalledWith(
      1,
      "github",
      "issues",
      "conn-1",
      "every 5m",
    );
    expect(mockUpdateSyncConnectionFrequency).toHaveBeenNthCalledWith(
      2,
      "github",
      "pulls",
      "conn-1",
      "every 1h",
    );
  });

  it("reports per-entry failures without aborting the rest of the batch", async () => {
    mockUpdateSyncConnectionFrequency
      .mockResolvedValueOnce({ frequency: "every 5m" })
      .mockRejectedValueOnce(new Error("sync not found"))
      .mockResolvedValueOnce({ frequency: "every 30m" });

    const handler = await captureHandler("nango:bulkUpdateSyncSchedule");
    const result = await handler!(
      {},
      {
        providerConfigKey: "github",
        connectionId: "conn-1",
        entries: [
          { syncName: "issues", frequency: "every 5m" },
          { syncName: "broken", frequency: "every 10m" },
          { syncName: "pulls", frequency: "every 30m" },
        ],
      },
    );

    expect(result).toMatchObject({
      status: "ok",
      data: {
        results: [
          { syncName: "issues", status: "ok", frequency: "every 5m" },
          { syncName: "broken", status: "error", error: "sync not found" },
          { syncName: "pulls", status: "ok", frequency: "every 30m" },
        ],
        allSucceeded: false,
      },
    });
    // All three SDK calls must run — failure of one entry must not short-circuit.
    expect(mockUpdateSyncConnectionFrequency).toHaveBeenCalledTimes(3);
  });

  it("rejects an empty entries array via the error envelope", async () => {
    const handler = await captureHandler("nango:bulkUpdateSyncSchedule");
    const result = await handler!(
      {},
      { providerConfigKey: "github", connectionId: "conn-1", entries: [] },
    );

    expect(result).toMatchObject({
      status: "error",
      data: null,
      error: expect.stringContaining("non-empty"),
    });
    expect(mockUpdateSyncConnectionFrequency).not.toHaveBeenCalled();
  });

  it("requires providerConfigKey and connectionId", async () => {
    const handler = await captureHandler("nango:bulkUpdateSyncSchedule");
    const result = await handler!(
      {},
      { entries: [{ syncName: "issues", frequency: "every 5m" }] },
    );

    expect(result).toMatchObject({
      status: "error",
      error: expect.stringContaining("required"),
    });
    expect(mockUpdateSyncConnectionFrequency).not.toHaveBeenCalled();
  });

  it("forwards null frequency unchanged (reset to integration default)", async () => {
    mockUpdateSyncConnectionFrequency.mockResolvedValueOnce({
      frequency: "every 1d",
    });

    const handler = await captureHandler("nango:bulkUpdateSyncSchedule");
    await handler!(
      {},
      {
        providerConfigKey: "github",
        connectionId: "conn-1",
        entries: [{ syncName: "issues", frequency: null }],
      },
    );

    expect(mockUpdateSyncConnectionFrequency).toHaveBeenCalledWith(
      "github",
      "issues",
      "conn-1",
      null,
    );
  });
});
