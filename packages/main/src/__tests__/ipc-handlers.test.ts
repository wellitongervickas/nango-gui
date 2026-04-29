import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Mock @nangohq/node before any imports that use it
const mockListConnections = vi.fn().mockResolvedValue({
  connections: [
    {
      id: 1,
      connection_id: "conn-1",
      provider: "github",
      provider_config_key: "github-key",
      created_at: "2024-01-01T00:00:00Z",
    },
  ],
});

vi.mock("@nangohq/node", () => ({
  Nango: vi.fn().mockImplementation(() => ({
    listConnections: mockListConnections,
    getConnection: vi.fn().mockResolvedValue({
      id: 1,
      connection_id: "conn-1",
      provider_config_key: "github-key",
      provider: "github",
      credentials: {},
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    }),
  })),
}));

import {
  registerEnvironmentClient,
  setActiveEnvironment,
  getActiveEnvironment,
  getActiveClient,
  getClientForEnvironment,
  isActiveClientReady,
  clearAllEnvironmentClients,
  clearEnvironmentClient,
  validateNangoKey,
  probeReachability,
} from "../nango-client.js";

describe("nango-client environment factory (NANA-263)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAllEnvironmentClients();
  });

  it("is not ready before any environment is registered", () => {
    expect(isActiveClientReady()).toBe(false);
    expect(getActiveEnvironment()).toBeNull();
  });

  it("registering an environment client makes it the active client", async () => {
    const client = await registerEnvironmentClient("development", "dev-key");
    expect(isActiveClientReady()).toBe(true);
    expect(getActiveEnvironment()).toBe("development");
    expect(getActiveClient()).toBe(client);
  });

  it("throws a descriptive error when no client is active", () => {
    expect(() => getActiveClient()).toThrow(/Nango client not initialized/);
  });

  it("throws when looking up an unregistered environment", () => {
    expect(() => getClientForEnvironment("production")).toThrow(
      /not initialized for environment "production"/,
    );
  });

  it("caches a separate client per environment", async () => {
    const dev = await registerEnvironmentClient("development", "dev-key");
    const prod = await registerEnvironmentClient("production", "prod-key");
    expect(dev).not.toBe(prod);
    expect(getClientForEnvironment("development")).toBe(dev);
    expect(getClientForEnvironment("production")).toBe(prod);
  });

  it("switches the active environment without re-registering", async () => {
    const dev = await registerEnvironmentClient("development", "dev-key");
    await registerEnvironmentClient("production", "prod-key");
    setActiveEnvironment("development");
    expect(getActiveEnvironment()).toBe("development");
    expect(getActiveClient()).toBe(dev);
  });

  it("setActiveEnvironment refuses to switch to an unregistered environment", async () => {
    await registerEnvironmentClient("development", "dev-key");
    expect(() => setActiveEnvironment("staging")).toThrow(
      /No Nango client registered for environment "staging"/,
    );
  });

  it("re-registering replaces the cached instance for that environment", async () => {
    const first = await registerEnvironmentClient("development", "key-1");
    const second = await registerEnvironmentClient("development", "key-2");
    expect(first).not.toBe(second);
    expect(getClientForEnvironment("development")).toBe(second);
  });

  it("clearEnvironmentClient drops a single env and unsets active when matching", async () => {
    await registerEnvironmentClient("development", "dev-key");
    clearEnvironmentClient("development");
    expect(isActiveClientReady()).toBe(false);
    expect(getActiveEnvironment()).toBeNull();
  });

  it("clearAllEnvironmentClients wipes every cached client", async () => {
    await registerEnvironmentClient("development", "dev-key");
    await registerEnvironmentClient("production", "prod-key");
    clearAllEnvironmentClients();
    expect(isActiveClientReady()).toBe(false);
    expect(getActiveEnvironment()).toBeNull();
    expect(() => getClientForEnvironment("development")).toThrow();
  });

  describe("validateNangoKey", () => {
    it("returns true when listConnections succeeds", async () => {
      const valid = await validateNangoKey("valid-key");
      expect(valid).toBe(true);
    });

    it("does not pollute the per-environment cache", async () => {
      await validateNangoKey("transient-key");
      expect(isActiveClientReady()).toBe(false);
    });

    it("returns false on 401", async () => {
      const { Nango } = await import("@nangohq/node");
      vi.mocked(Nango).mockImplementationOnce(
        () =>
          ({
            listConnections: vi.fn().mockRejectedValue({ status: 401 }),
          }) as never
      );
      const valid = await validateNangoKey("bad-key");
      expect(valid).toBe(false);
    });

    it("returns false on 403", async () => {
      const { Nango } = await import("@nangohq/node");
      vi.mocked(Nango).mockImplementationOnce(
        () =>
          ({
            listConnections: vi.fn().mockRejectedValue({ status: 403 }),
          }) as never
      );
      const valid = await validateNangoKey("forbidden-key");
      expect(valid).toBe(false);
    });

    it("re-throws on network error", async () => {
      const { Nango } = await import("@nangohq/node");
      vi.mocked(Nango).mockImplementationOnce(
        () =>
          ({
            listConnections: vi
              .fn()
              .mockRejectedValue(new Error("Network failure")),
          }) as never
      );
      await expect(validateNangoKey("any-key")).rejects.toThrow(
        "Network failure"
      );
    });
  });

  describe("probeReachability (Feature 7 offline detection)", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("returns 'online' when the probe receives a 2xx response", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 200 })) as typeof fetch;
      const result = await probeReachability("https://api.nango.dev");
      expect(result.state).toBe("online");
      expect(result.httpStatus).toBe(200);
      expect(result.error).toBeNull();
      expect(result.latencyMs).not.toBeNull();
    });

    it("returns 'degraded' when Nango responds with a non-2xx", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 })) as typeof fetch;
      const result = await probeReachability("https://api.nango.dev");
      expect(result.state).toBe("degraded");
      expect(result.httpStatus).toBe(503);
    });

    it("returns 'offline' on network failure (DNS / socket / abort)", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("ENOTFOUND api.nango.dev")) as typeof fetch;
      const result = await probeReachability("https://api.nango.dev");
      expect(result.state).toBe("offline");
      expect(result.httpStatus).toBeNull();
      expect(result.latencyMs).toBeNull();
      expect(result.error).toContain("ENOTFOUND");
    });
  });
});
