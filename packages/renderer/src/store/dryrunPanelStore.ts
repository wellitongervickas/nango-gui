import { create } from "zustand";

interface DryrunPanelState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useDryrunPanelStore = create<DryrunPanelState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false }),
}));
