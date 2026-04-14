import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  IpcResponse,
  NangoListRecordsResult,
} from "@nango-gui/shared";

// ── window.nango mock ───────────────────────────────────────────────────────

const mockRecordsPage1: NangoListRecordsResult = {
  records: [
    {
      id: "rec-1",
      name: "Alice",
      email: "alice@example.com",
      _nango_metadata: {
        first_seen_at: "2026-01-01T00:00:00Z",
        last_modified_at: "2026-01-02T00:00:00Z",
        last_action: "ADDED",
        deleted_at: null,
        cursor: "cursor-1",
      },
    },
    {
      id: "rec-2",
      name: "Bob",
      email: "bob@example.com",
      _nango_metadata: {
        first_seen_at: "2026-01-01T00:00:00Z",
        last_modified_at: "2026-01-03T00:00:00Z",
        last_action: "UPDATED",
        deleted_at: null,
        cursor: "cursor-2",
      },
    },
  ],
  next_cursor: "page-2-cursor",
};

const mockRecordsPage2: NangoListRecordsResult = {
  records: [
    {
      id: "rec-3",
      name: "Charlie",
      email: "charlie@example.com",
      _nango_metadata: {
        first_seen_at: "2026-01-01T00:00:00Z",
        last_modified_at: "2026-01-04T00:00:00Z",
        last_action: "ADDED",
        deleted_at: null,
        cursor: "cursor-3",
      },
    },
  ],
  next_cursor: null,
};

const mockListRecords = vi.fn(
  (): Promise<IpcResponse<NangoListRecordsResult>> =>
    Promise.resolve({ status: "ok", data: mockRecordsPage1, error: null })
);

vi.stubGlobal("window", {
  nango: {
    listRecords: mockListRecords,
  },
});

import { useRecordsStore } from "../store/recordsStore.js";

beforeEach(() => {
  useRecordsStore.setState({
    records: [],
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    connectionId: null,
    providerConfigKey: null,
    model: null,
    filter: null,
    modifiedAfter: null,
  });
  vi.clearAllMocks();
  mockListRecords.mockImplementation(() =>
    Promise.resolve({ status: "ok", data: mockRecordsPage1, error: null })
  );
});

describe("useRecordsStore", () => {
  describe("fetchRecords", () => {
    it("populates records on success", async () => {
      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");

      const state = useRecordsStore.getState();
      expect(state.records).toEqual(mockRecordsPage1.records);
      expect(state.nextCursor).toBe("page-2-cursor");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.providerConfigKey).toBe("github");
      expect(state.connectionId).toBe("user-1");
      expect(state.model).toBe("Contact");
    });

    it("calls window.nango.listRecords with correct params", async () => {
      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");

      expect(mockListRecords).toHaveBeenCalledWith({
        providerConfigKey: "github",
        connectionId: "user-1",
        model: "Contact",
        limit: 100,
      });
    });

    it("passes filter when provided", async () => {
      await useRecordsStore
        .getState()
        .fetchRecords("github", "user-1", "Contact", { filter: "added" });

      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ filter: "added" })
      );
    });

    it("passes modifiedAfter when provided", async () => {
      await useRecordsStore
        .getState()
        .fetchRecords("github", "user-1", "Contact", {
          modifiedAfter: "2026-01-01T00:00:00Z",
        });

      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ modifiedAfter: "2026-01-01T00:00:00Z" })
      );
    });

    it("sets error on API failure", async () => {
      mockListRecords.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Unauthorized",
      });

      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");

      expect(useRecordsStore.getState().error).toBe("Unauthorized");
      expect(useRecordsStore.getState().records).toEqual([]);
    });

    it("sets error on thrown exception", async () => {
      mockListRecords.mockRejectedValueOnce(new Error("Network error"));

      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");

      expect(useRecordsStore.getState().error).toBe("Network error");
    });

    it("clears previous records on new fetch", async () => {
      // Pre-populate state
      useRecordsStore.setState({
        records: mockRecordsPage1.records,
        nextCursor: "old-cursor",
      });

      // Fetch fresh
      await useRecordsStore.getState().fetchRecords("slack", "user-2", "Message");

      expect(useRecordsStore.getState().providerConfigKey).toBe("slack");
      expect(useRecordsStore.getState().connectionId).toBe("user-2");
      expect(useRecordsStore.getState().model).toBe("Message");
    });
  });

  describe("loadMore", () => {
    it("appends records from next page", async () => {
      // First fetch
      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");
      expect(useRecordsStore.getState().records).toHaveLength(2);

      // Setup page 2 response
      mockListRecords.mockResolvedValueOnce({
        status: "ok",
        data: mockRecordsPage2,
        error: null,
      });

      await useRecordsStore.getState().loadMore();

      const state = useRecordsStore.getState();
      expect(state.records).toHaveLength(3);
      expect(state.records[2]!.id).toBe("rec-3");
      expect(state.nextCursor).toBeNull();
      expect(state.isLoadingMore).toBe(false);
    });

    it("sends cursor in loadMore request", async () => {
      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");

      mockListRecords.mockResolvedValueOnce({
        status: "ok",
        data: mockRecordsPage2,
        error: null,
      });

      await useRecordsStore.getState().loadMore();

      expect(mockListRecords).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: "page-2-cursor" })
      );
    });

    it("does nothing when no cursor", async () => {
      useRecordsStore.setState({ nextCursor: null });
      await useRecordsStore.getState().loadMore();
      expect(mockListRecords).not.toHaveBeenCalled();
    });

    it("does nothing when missing context", async () => {
      useRecordsStore.setState({ nextCursor: "some-cursor", providerConfigKey: null });
      await useRecordsStore.getState().loadMore();
      expect(mockListRecords).not.toHaveBeenCalled();
    });
  });

  describe("setFilter", () => {
    it("refetches with new filter when context is set", async () => {
      // Setup context by fetching first
      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");
      mockListRecords.mockClear();

      await useRecordsStore.getState().setFilter("deleted");

      expect(useRecordsStore.getState().filter).toBe("deleted");
      expect(mockListRecords).toHaveBeenCalledWith(
        expect.objectContaining({ filter: "deleted" })
      );
    });

    it("does not fetch when no context", () => {
      useRecordsStore.getState().setFilter("added");
      expect(useRecordsStore.getState().filter).toBe("added");
      expect(mockListRecords).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("clears all state", async () => {
      await useRecordsStore.getState().fetchRecords("github", "user-1", "Contact");
      useRecordsStore.getState().reset();

      const state = useRecordsStore.getState();
      expect(state.records).toEqual([]);
      expect(state.nextCursor).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.connectionId).toBeNull();
      expect(state.providerConfigKey).toBeNull();
      expect(state.model).toBeNull();
      expect(state.filter).toBeNull();
      expect(state.modifiedAfter).toBeNull();
    });
  });
});
