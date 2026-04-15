import { create } from "zustand";
import type { NangoProject } from "../types/flow";

const DEFAULT_PROJECT: NangoProject = {
  name: "",
  provider: "",
  authType: "oauth2",
  environment: "development",
  errorHandling: { retryOn: ["5xx", "timeout"], maxRetries: 3 },
  filePath: null,
  lastSaved: null,
};

interface ProjectState {
  project: NangoProject;
  isDirty: boolean;
  setProject: (project: NangoProject) => void;
  updateProject: (patch: Partial<NangoProject>) => void;
  markDirty: () => void;
  markClean: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: { ...DEFAULT_PROJECT },
  isDirty: false,

  setProject: (project) => set({ project, isDirty: false }),
  updateProject: (patch) => {
    set({ project: { ...get().project, ...patch }, isDirty: true });
  },
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
}));
