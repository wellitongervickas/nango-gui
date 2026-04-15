import { create } from "zustand";

interface CodePanelState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useCodePanelStore = create<CodePanelState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false }),
}));
