import { create } from "zustand";

interface ConnectFlowState {
  /** Whether the provider search modal is visible. */
  isSearchOpen: boolean;
  /** Open the provider search modal. */
  openSearch: () => void;
  /** Close the provider search modal. */
  closeSearch: () => void;
}

export const useConnectFlowStore = create<ConnectFlowState>((set) => ({
  isSearchOpen: false,
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
}));
