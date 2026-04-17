import { create } from "zustand";
import { parseHash } from "../lib/router";

interface NavigationState {
  history: string[];
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Called by the router when a normal navigation occurs (sidebar, programmatic). */
  push: (route: string) => void;
  goBack: () => void;
  goForward: () => void;
}

/**
 * Flag to suppress history push during back/forward navigation.
 * When goBack/goForward navigate, the hashchange fires and would
 * normally call push() — this flag prevents that double-entry.
 */
let suppressNextPush = false;

export const useNavigationStore = create<NavigationState>((set, get) => ({
  history: [parseHash()],
  currentIndex: 0,
  canGoBack: false,
  canGoForward: false,

  push(route: string) {
    if (suppressNextPush) {
      suppressNextPush = false;
      return;
    }

    const { history, currentIndex } = get();

    // Don't push duplicate consecutive routes
    if (history[currentIndex] === route) return;

    // Truncate any forward history and append the new route
    const newHistory = [...history.slice(0, currentIndex + 1), route];
    const newIndex = newHistory.length - 1;

    set({
      history: newHistory,
      currentIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false,
    });
  },

  goBack() {
    const { history, currentIndex } = get();
    if (currentIndex <= 0) return;

    const newIndex = currentIndex - 1;
    const target = history[newIndex];

    suppressNextPush = true;

    set({
      currentIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: true,
    });

    // Navigate via hash — the router's hashchange listener updates useHashRoute
    window.location.hash = target === "/" ? "/" : `/${target}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  },

  goForward() {
    const { history, currentIndex } = get();
    if (currentIndex >= history.length - 1) return;

    const newIndex = currentIndex + 1;
    const target = history[newIndex];

    suppressNextPush = true;

    set({
      currentIndex: newIndex,
      canGoBack: true,
      canGoForward: newIndex < history.length - 1,
    });

    window.location.hash = target === "/" ? "/" : `/${target}`;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  },
}));
