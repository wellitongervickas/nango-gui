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

import {
  registerEnvironmentClient,
  clearAllEnvironmentClients,
} from "../nango-client.js";

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
    await registerEnvironmentClient("development", "test-secret-key");
  });

  afterEach(() => {
    clearAllEnvironmentClients();
  });

  it("returns a token, connect_link and expiry on success", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "sess_abc123", connect_link: "https://connect.nango.dev/abc", expires_at: "2026-01-01T00:00:00Z" },
    });

    const handler = await captureHandler("nango:connect:createSession");
    expect(handler).toBeDefined();

    const result = await handler!(
      {},
      { endUserId: "user-1", endUserEmail: "user@example.com", endUserDisplayName: "Test User" }
    );

    expect(result).toEqual({
      status: "ok",
      data: {
        token: "sess_abc123",
        connectLink: "https://connect.nango.dev/abc",
        expiresAt: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "user-1", email: "user@example.com", display_name: "Test User" },
    });
  });

  it("passes allowedIntegrations when provided", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "tok_xyz", connect_link: "", expires_at: "2026-12-31T00:00:00Z" },
    });

    const handler = await captureHandler("nango:connect:createSession");
    await handler!({}, { endUserId: "u2", allowedIntegrations: ["github", "slack"] });

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "u2" },
      allowed_integrations: ["github", "slack"],
    });
  });

  it("omits display_name and email when not provided", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "tok_min", connect_link: "", expires_at: "2026-12-31T00:00:00Z" },
    });

    const handler = await captureHandler("nango:connect:createSession");
    await handler!({}, { endUserId: "u3" });

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "u3" },
    });
  });

  it("surfaces 422 fieldErrors from the Nango API", async () => {
    const apiError = Object.assign(new Error("Validation failed"), {
      status: 422,
      response: {
        data: {
          errors: [
            { path: ["end_user", "email"], message: "Invalid email address" },
            { path: ["end_user", "id"], message: "ID is required" },
          ],
        },
      },
    });
    mockCreateConnectSession.mockRejectedValueOnce(apiError);

    const handler = await captureHandler("nango:connect:createSession");
    const result = await handler!({}, { endUserId: "" });

    expect(result).toMatchObject({
      status: "error",
      data: null,
      errorCode: "VALIDATION_ERROR",
      fieldErrors: {
        endUserEmail: "Invalid email address",
        endUserId: "ID is required",
      },
    });
  });

  it("wraps SDK errors in the error envelope", async () => {
    mockCreateConnectSession.mockRejectedValueOnce(new Error("Nango API error"));

    const handler = await captureHandler("nango:connect:createSession");
    const result = await handler!({}, { endUserId: "user-1" });

    expect(result).toEqual({
      status: "error",
      data: null,
      error: "Nango API error",
      errorCode: "UNKNOWN",
    });
  });

  it("forwards advanced config oauth client overrides as connection_config", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "tok_adv", connect_link: "", expires_at: "2026-12-31T00:00:00Z" },
    });

    const handler = await captureHandler("nango:connect:createSession");
    await handler!(
      {},
      {
        endUserId: "u4",
        integrationsConfigDefaults: {
          github: {
            oauthClientId: "client-123",
            oauthClientSecret: "secret-xyz",
            userScopes: ["repo", "read:user"],
            authParams: { tenant: "acme" },
          },
        },
      }
    );

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "u4" },
      integrations_config_defaults: {
        github: {
          user_scopes: "repo read:user",
          authorization_params: { tenant: "acme" },
          connection_config: {
            oauth_client_id_override: "client-123",
            oauth_client_secret_override: "secret-xyz",
          },
        },
      },
    });
  });

  it("omits oauth client overrides when useNangoDevApp is true", async () => {
    mockCreateConnectSession.mockResolvedValueOnce({
      data: { token: "tok_dev", connect_link: "", expires_at: "2026-12-31T00:00:00Z" },
    });

    const handler = await captureHandler("nango:connect:createSession");
    await handler!(
      {},
      {
        endUserId: "u5",
        integrationsConfigDefaults: {
          github: {
            // These overrides MUST be ignored when useNangoDevApp is set,
            // so Nango falls back to its pre-configured developer app.
            oauthClientId: "should-be-ignored",
            oauthClientSecret: "also-ignored",
            useNangoDevApp: true,
            userScopes: ["repo"],
          },
        },
      }
    );

    expect(mockCreateConnectSession).toHaveBeenCalledWith({
      end_user: { id: "u5" },
      integrations_config_defaults: {
        github: {
          user_scopes: "repo",
          // Note: no `connection_config` key — the dev app flag suppresses it.
        },
      },
    });
  });

  it("returns error envelope when client is not initialized", async () => {
    clearAllEnvironmentClients();

    const handler = await captureHandler("nango:connect:createSession");
    const result = await handler!({}, { endUserId: "user-1" });

    expect(result).toMatchObject({
      status: "error",
      data: null,
      error: expect.stringContaining("not initialized"),
    });
  });
});
