import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreateConnectSession = vi.fn();

vi.mock("@nangohq/node", () => ({
  Nango: vi.fn().mockImplementation(() => ({
    listConnections: vi.fn().mockResolvedValue({ connections: [] }),
    createConnectSession: mockCreateConnectSession,
  })),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

import { initNangoClient, resetNangoClient } from "../nango-client.js";

// Extract the handler function registered for a given channel by capturing
// ipcMain.handle calls after registerIpcHandlers() runs.
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

describe("nango:createConnectSession IPC handler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await initNangoClient("test-secret-key");
  });

  afterEach(() => {
    resetNangoClient();
  });

  it("returns a token on success", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "sess_abc123", connect_link: "https://connect.nango.dev", expires_at: "2026-01-01T00:00:00Z" },
    });

    const handler = await captureHandler("nango:createConnectSession");
    expect(handler).toBeDefined();

    const result = await handler!(
      {},
      { endUserId: "user-1", endUserDisplayName: "Test User" }
    );

    expect(result).toEqual({
      status: "ok",
      data: { token: "sess_abc123", expiresAt: "2026-01-01T00:00:00Z", connectLink: "https://connect.nango.dev" },
      error: null,
    });

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "user-1", display_name: "Test User" },
    });
  });

  it("passes allowedIntegrations when provided", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "tok_xyz", connect_link: "", expires_at: "2026-12-31T00:00:00Z" },
    });

    const handler = await captureHandler("nango:createConnectSession");
    await handler!({}, { endUserId: "u2", allowedIntegrations: ["github", "slack"] });

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "u2" },
      allowed_integrations: ["github", "slack"],
    });
  });

  it("omits display_name when not provided", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "tok_min", connect_link: "", expires_at: "2026-12-31T00:00:00Z" },
    });

    const handler = await captureHandler("nango:createConnectSession");
    await handler!({}, { endUserId: "u3" });

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "u3" },
    });
  });

  it("wraps SDK errors in the error envelope", async () => {
    mockCreateConnectSession.mockRejectedValueOnce(new Error("Nango API error"));

    const handler = await captureHandler("nango:createConnectSession");
    const result = await handler!({}, { endUserId: "user-1" });

    expect(result).toEqual({
      status: "error",
      data: null,
      error: "Nango API error",
      errorCode: "UNKNOWN",
    });
  });

  it("returns error envelope when client is not initialized", async () => {
    resetNangoClient();

    const handler = await captureHandler("nango:createConnectSession");
    const result = await handler!({}, { endUserId: "user-1" });

    expect(result).toMatchObject({
      status: "error",
      data: null,
      error: expect.stringContaining("not initialized"),
    });
  });
});
