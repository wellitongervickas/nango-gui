import { create } from "zustand";
import type {
  NangoLogOperation,
  NangoLogMessage,
  NangoLogType,
  NangoLogStatus,
} from "@nango-gui/shared";

interface LogsState {
  operations: NangoLogOperation[];
  isLoading: boolean;
  error: string | null;
  cursor: string | null;
  total: number;

  /** Currently expanded operation — shows messages in detail panel. */
  selectedOperationId: string | null;
  messages: NangoLogMessage[];
  messagesLoading: boolean;
  messagesError: string | null;

  /** Filters */
  filterType: NangoLogType | null;
  filterStatus: NangoLogStatus | null;
  filterPeriodFrom: string | null;
  filterPeriodTo: string | null;

  fetchOperations(reset?: boolean): Promise<void>;
  fetchMessages(operationId: string): Promise<void>;
  setSelectedOperationId(id: string | null): void;
  setFilterType(type: NangoLogType | null): void;
  setFilterStatus(status: NangoLogStatus | null): void;
  setFilterPeriod(from: string | null, to: string | null): void;
  clearFilters(): void;
}

export const useLogsStore = create<LogsState>((set, get) => ({
  operations: [],
  isLoading: false,
  error: null,
  cursor: null,
  total: 0,
  selectedOperationId: null,
  messages: [],
  messagesLoading: false,
  messagesError: null,
  filterType: null,
  filterStatus: null,
  filterPeriodFrom: null,
  filterPeriodTo: null,

  fetchOperations: async (reset = true) => {
    if (!window.nango) return;
    const state = get();
    if (state.isLoading) return;

    set({ isLoading: true, error: null, ...(reset ? { operations: [], cursor: null } : {}) });

    try {
      const args: Parameters<typeof window.nango.searchLogs>[0] = {
        limit: 50,
      };
      if (state.filterType) args.types = [state.filterType];
      if (state.filterStatus) args.status = state.filterStatus;
      if (state.filterPeriodFrom && state.filterPeriodTo) {
        args.period = { from: state.filterPeriodFrom, to: state.filterPeriodTo };
      }
      if (!reset && state.cursor) args.cursor = state.cursor;

      const res = await window.nango.searchLogs(args);
      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }
      set((s) => ({
        operations: reset ? res.data.operations : [...s.operations, ...res.data.operations],
        cursor: res.data.pagination.cursor,
        total: res.data.pagination.total,
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch logs",
        isLoading: false,
      });
    }
  },

  fetchMessages: async (operationId: string) => {
    if (!window.nango) return;
    set({ messagesLoading: true, messages: [], messagesError: null });

    try {
      const res = await window.nango.getLogMessages({ operationId, limit: 100 });
      // Guard against stale fetch overwriting current selection
      if (get().selectedOperationId !== operationId) return;
      if (res.status === "error") {
        set({ messagesLoading: false, messagesError: res.error });
        return;
      }
      set({ messages: res.data.messages, messagesLoading: false });
    } catch (err) {
      if (get().selectedOperationId !== operationId) return;
      set({
        messagesLoading: false,
        messagesError: err instanceof Error ? err.message : "Failed to fetch messages",
      });
    }
  },

  setSelectedOperationId: (id: string | null) => {
    set({ selectedOperationId: id, messages: [], messagesError: null });
    if (id) get().fetchMessages(id);
  },

  setFilterType: (type: NangoLogType | null) => {
    set({ filterType: type });
    void get().fetchOperations(true);
  },

  setFilterStatus: (status: NangoLogStatus | null) => {
    set({ filterStatus: status });
    void get().fetchOperations(true);
  },

  setFilterPeriod: (from: string | null, to: string | null) => {
    set({ filterPeriodFrom: from, filterPeriodTo: to });
    void get().fetchOperations(true);
  },

  clearFilters: () => {
    set({
      filterType: null,
      filterStatus: null,
      filterPeriodFrom: null,
      filterPeriodTo: null,
    });
    void get().fetchOperations(true);
  },
}));
