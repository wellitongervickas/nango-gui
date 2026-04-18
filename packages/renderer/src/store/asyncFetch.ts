import type { IpcResponse } from "@nango-gui/shared";
import { notifyIpcError } from "./notifyError";

/**
 * Standard async IPC fetch with loading/error state management.
 *
 * Handles the common pattern: set loading → call API → check status →
 * set success state or error → catch unexpected errors.
 */
export async function asyncFetch<S extends { isLoading: boolean; error: string | null }, T>(
  set: (partial: Partial<S>) => void,
  apiFn: () => Promise<IpcResponse<T>>,
  onSuccess: (data: T) => Partial<S>,
  fallbackError = "An error occurred",
): Promise<void> {
  set({ isLoading: true, error: null } as Partial<S>);
  try {
    const res = await apiFn();
    if (!res) {
      set({ isLoading: false } as Partial<S>);
      return;
    }
    if (res.status === "error") {
      notifyIpcError(res);
      set({ error: res.error, isLoading: false } as Partial<S>);
      return;
    }
    set({ ...onSuccess(res.data), isLoading: false } as Partial<S>);
  } catch (err) {
    const message = err instanceof Error ? err.message : fallbackError;
    set({ error: message, isLoading: false } as Partial<S>);
  }
}
