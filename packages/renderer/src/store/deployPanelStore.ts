import { create } from "zustand";

interface DeployPanelState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useDeployPanelStore = create<DeployPanelState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false }),
}));
