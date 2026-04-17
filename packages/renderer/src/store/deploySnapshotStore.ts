import { create } from "zustand";
import type {
  DeploySnapshot,
  DeploySaveSnapshotRequest,
  DeployRollbackResult,
} from "@nango-gui/shared";
import { asyncFetch } from "./asyncFetch";

interface DeploySnapshotState {
  snapshots: DeploySnapshot[];
  isLoading: boolean;
  error: string | null;

  fetchSnapshots: () => Promise<void>;
  saveSnapshot: (request: DeploySaveSnapshotRequest) => Promise<DeploySnapshot>;
  deleteSnapshot: (id: string) => Promise<void>;
  rollback: (id: string) => Promise<DeployRollbackResult>;
}

export const useDeploySnapshotStore = create<DeploySnapshotState>((set) => ({
  snapshots: [],
  isLoading: false,
  error: null,

  fetchSnapshots: async () => {
    if (!window.deploy) return;
    await asyncFetch(
      set,
      () => window.deploy.listSnapshots(),
      (data) => ({ snapshots: data.snapshots }),
      "Failed to fetch snapshots",
    );
  },

  saveSnapshot: async (request) => {
    if (!window.deploy) throw new Error("Deploy API not available");
    const res = await window.deploy.saveSnapshot(request);
    if (res.status === "ok") {
      set((state) => ({ snapshots: [res.data, ...state.snapshots] }));
      return res.data;
    }
    throw new Error(res.error);
  },

  deleteSnapshot: async (id) => {
    if (!window.deploy) throw new Error("Deploy API not available");
    const res = await window.deploy.deleteSnapshot({ id });
    if (res.status === "ok") {
      set((state) => ({
        snapshots: state.snapshots.filter((s) => s.id !== id),
      }));
    } else {
      throw new Error(res.error);
    }
  },

  rollback: async (id) => {
    if (!window.deploy) throw new Error("Deploy API not available");
    const res = await window.deploy.rollback({ id });
    if (res.status === "ok") {
      return res.data;
    }
    throw new Error(res.error);
  },
}));
