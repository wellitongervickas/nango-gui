import { create } from "zustand";
import type {
  NangoRecord,
  NangoRecordFilterAction,
} from "@nango-gui/shared";

interface RecordsState {
  records: NangoRecord[];
  nextCursor: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  connectionId: string | null;
  providerConfigKey: string | null;
  model: string | null;
  filter: NangoRecordFilterAction | null;
  modifiedAfter: string | null;

  fetchRecords: (
    providerConfigKey: string,
    connectionId: string,
    model: string,
    opts?: { filter?: NangoRecordFilterAction | null; modifiedAfter?: string | null }
  ) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (filter: NangoRecordFilterAction | null) => void;
  setModifiedAfter: (date: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  records: [] as NangoRecord[],
  nextCursor: null as string | null,
  isLoading: false,
  isLoadingMore: false,
  error: null as string | null,
  connectionId: null as string | null,
  providerConfigKey: null as string | null,
  model: null as string | null,
  filter: null as NangoRecordFilterAction | null,
  modifiedAfter: null as string | null,
};

export const useRecordsStore = create<RecordsState>((set, get) => ({
  ...INITIAL_STATE,

  fetchRecords: async (providerConfigKey, connectionId, model, opts) => {
    const filter = opts?.filter ?? get().filter;
    const modifiedAfter = opts?.modifiedAfter ?? get().modifiedAfter;

    set({
      isLoading: true,
      error: null,
      records: [],
      nextCursor: null,
      connectionId,
      providerConfigKey,
      model,
      filter,
      modifiedAfter,
    });

    try {
      const res = await window.nango.listRecords({
        providerConfigKey,
        connectionId,
        model,
        limit: 100,
        ...(filter ? { filter } : {}),
        ...(modifiedAfter ? { modifiedAfter } : {}),
      });

      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }

      set({
        records: res.data.records,
        nextCursor: res.data.next_cursor,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load records",
        isLoading: false,
      });
    }
  },

  loadMore: async () => {
    const { nextCursor, providerConfigKey, connectionId, model, filter, modifiedAfter } = get();
    if (!nextCursor || !providerConfigKey || !connectionId || !model) return;

    set({ isLoadingMore: true });

    try {
      const res = await window.nango.listRecords({
        providerConfigKey,
        connectionId,
        model,
        cursor: nextCursor,
        limit: 100,
        ...(filter ? { filter } : {}),
        ...(modifiedAfter ? { modifiedAfter } : {}),
      });

      if (res.status === "error") {
        set({ error: res.error, isLoadingMore: false });
        return;
      }

      set((state) => ({
        records: [...state.records, ...res.data.records],
        nextCursor: res.data.next_cursor,
        isLoadingMore: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load more records",
        isLoadingMore: false,
      });
    }
  },

  setFilter: (filter) => {
    const { providerConfigKey, connectionId, model } = get();
    set({ filter });
    if (providerConfigKey && connectionId && model) {
      get().fetchRecords(providerConfigKey, connectionId, model, { filter });
    }
  },

  setModifiedAfter: (date) => {
    const { providerConfigKey, connectionId, model } = get();
    set({ modifiedAfter: date });
    if (providerConfigKey && connectionId && model) {
      get().fetchRecords(providerConfigKey, connectionId, model, { modifiedAfter: date });
    }
  },

  reset: () => set(INITIAL_STATE),
}));
