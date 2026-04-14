import { describe, it, expect, vi, afterEach } from "vitest";

// Mock @nangohq/node before any imports that use it
vi.mock("@nangohq/node", () => ({
  Nango: vi.fn().mockImplementation(() => ({
    listConnections: vi.fn().mockResolvedValue({
      connections: [
        {
          id: 1,
          connection_id: "conn-1",
          provider: "github",
          provider_config_key: "github-key",
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
    }),
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
  initNangoClient,
  getNangoClient,
  isNangoClientReady,
  resetNangoClient,
  validateNangoKey,
} from "../nango-client.js";

describe("nango-client", () => {
  afterEach(() => {
    resetNangoClient();
  });

  it("is not ready before initialization", () => {
    expect(isNangoClientReady()).toBe(false);
  });

  it("initializes and returns a client", async () => {
    await initNangoClient("test-secret-key");
    expect(isNangoClientReady()).toBe(true);
  });

  it("throws when getNangoClient is called before init", () => {
    expect(() => getNangoClient()).toThrow(
      "Nango client not initialized"
    );
  });

  it("returns the initialized client", async () => {
    const client = await initNangoClient("test-secret-key");
    expect(getNangoClient()).toBe(client);
  });

  it("resets the client on resetNangoClient", async () => {
    await initNangoClient("test-secret-key");
    resetNangoClient();
    expect(isNangoClientReady()).toBe(false);
  });

  it("can re-initialize with a new key", async () => {
    const first = await initNangoClient("key-1");
    const second = await initNangoClient("key-2");
    expect(getNangoClient()).toBe(second);
    expect(first).not.toBe(second);
  });

  describe("validateNangoKey", () => {
    it("returns true when listConnections succeeds", async () => {
      const valid = await validateNangoKey("valid-key");
      expect(valid).toBe(true);
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
});
