import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  NangoConnectionSummary,
  IpcResponse,
} from "@nango-gui/shared";

// ── window.nango mock ───────────────────────────────────────────────────────

const mockConnections: NangoConnectionSummary[] = [
  {
    id: 1,
    connection_id: "user-1",
    provider: "github",
    provider_config_key: "github",
    created: "2026-01-01T00:00:00Z",
    metadata: null,
  },
  {
    id: 2,
    connection_id: "user-2",
    provider: "slack",
    provider_config_key: "slack",
    created: "2026-01-02T00:00:00Z",
    metadata: null,
  },
];

const mockListConnections = vi.fn(
  (): Promise<IpcResponse<NangoConnectionSummary[]>> =>
    Promise.resolve({ status: "ok", data: mockConnections, error: null })
);

const mockDeleteConnection = vi.fn(
  (): Promise<IpcResponse<void>> =>
    Promise.resolve({ status: "ok", data: undefined, error: null })
);

vi.stubGlobal("window", {
  nango: {
    listConnections: mockListConnections,
    deleteConnection: mockDeleteConnection,
  },
});

import { useConnectionsStore } from "../store/connectionsStore.js";

beforeEach(() => {
  useConnectionsStore.setState({
    connections: [],
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("useConnectionsStore", () => {
  describe("fetchConnections", () => {
    it("populates connections on success", async () => {
      await useConnectionsStore.getState().fetchConnections();
      expect(useConnectionsStore.getState().connections).toEqual(mockConnections);
      expect(useConnectionsStore.getState().isLoading).toBe(false);
      expect(useConnectionsStore.getState().error).toBeNull();
    });

    it("passes integrationId filter when provided", async () => {
      await useConnectionsStore.getState().fetchConnections("github");
      expect(mockListConnections).toHaveBeenCalledWith({ integrationId: "github" });
    });

    it("sets error on API failure", async () => {
      mockListConnections.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Unauthorized",
        errorCode: "UNKNOWN",
      });
      await useConnectionsStore.getState().fetchConnections();
      expect(useConnectionsStore.getState().error).toBe("Unauthorized");
      expect(useConnectionsStore.getState().connections).toEqual([]);
    });

    it("sets error on thrown exception", async () => {
      mockListConnections.mockRejectedValueOnce(new Error("Network error"));
      await useConnectionsStore.getState().fetchConnections();
      expect(useConnectionsStore.getState().error).toBe("Network error");
    });
  });

  describe("addConnection", () => {
    it("appends a new connection", () => {
      useConnectionsStore.setState({ connections: [mockConnections[0]!] });
      useConnectionsStore.getState().addConnection(mockConnections[1]!);
      expect(useConnectionsStore.getState().connections).toHaveLength(2);
    });

    it("replaces a connection with the same connection_id", () => {
      const updated: NangoConnectionSummary = {
        ...mockConnections[0]!,
        metadata: { updated: true },
      };
      useConnectionsStore.setState({ connections: [mockConnections[0]!] });
      useConnectionsStore.getState().addConnection(updated);
      const conns = useConnectionsStore.getState().connections;
      expect(conns).toHaveLength(1);
      expect(conns[0]!.metadata).toEqual({ updated: true });
    });
  });

  describe("deleteConnection", () => {
    it("removes the connection from state", async () => {
      useConnectionsStore.setState({ connections: [...mockConnections] });
      await useConnectionsStore
        .getState()
        .deleteConnection("github", "user-1");
      const conns = useConnectionsStore.getState().connections;
      expect(conns).toHaveLength(1);
      expect(conns[0]!.connection_id).toBe("user-2");
    });

    it("calls window.nango.deleteConnection with correct args", async () => {
      useConnectionsStore.setState({ connections: [...mockConnections] });
      await useConnectionsStore
        .getState()
        .deleteConnection("slack", "user-2");
      expect(mockDeleteConnection).toHaveBeenCalledWith({
        providerConfigKey: "slack",
        connectionId: "user-2",
      });
    });

    it("throws on API error", async () => {
      mockDeleteConnection.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Not found",
        errorCode: "UNKNOWN",
      });
      useConnectionsStore.setState({ connections: [...mockConnections] });
      await expect(
        useConnectionsStore.getState().deleteConnection("github", "user-1")
      ).rejects.toThrow("Not found");
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      useConnectionsStore.setState({
        connections: [...mockConnections],
        isLoading: true,
        error: "some error",
      });
      useConnectionsStore.getState().reset();
      const state = useConnectionsStore.getState();
      expect(state.connections).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
