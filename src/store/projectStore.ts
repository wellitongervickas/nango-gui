import { create } from "zustand";
import type { NangoProject } from "../types/flow";

interface ProjectState {
  project: NangoProject | null;
  isDirty: boolean;
  setProject: (project: NangoProject) => void;
  markDirty: () => void;
  markClean: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  isDirty: false,

  setProject: (project) => set({ project, isDirty: false }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
}));
