import { create } from "zustand";
import type { IpcErrorCode } from "@nango-gui/shared";

export interface ErrorNotification {
  id: string;
  message: string;
  errorCode: IpcErrorCode;
  timestamp: number;
}

interface ErrorState {
  notifications: ErrorNotification[];
  /** Push a new error toast. Auto-dismissed after 8 seconds. */
  pushError: (message: string, errorCode: IpcErrorCode) => void;
  /** Dismiss a specific notification by id. */
  dismiss: (id: string) => void;
  /** Clear all notifications. */
  clearAll: () => void;
}

let counter = 0;

export const useErrorStore = create<ErrorState>((set) => ({
  notifications: [],

  pushError: (message, errorCode) => {
    const id = `err-${++counter}-${Date.now()}`;
    const notification: ErrorNotification = { id, message, errorCode, timestamp: Date.now() };

    set((state) => ({
      notifications: [...state.notifications.slice(-9), notification],
    }));

    // Auto-dismiss after 8s
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 8000);
  },

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));
