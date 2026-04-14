import type { IpcResponse, IpcErrorCode } from "@nango-gui/shared";
import { useErrorStore } from "./errorStore";

/** Error codes that should trigger a visible toast notification. */
const TOAST_CODES = new Set<IpcErrorCode>([
  "AUTH_INVALID",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "NETWORK_ERROR",
  "CLIENT_NOT_READY",
]);

/**
 * If an IPC error response carries an actionable error code, push a
 * toast notification so the user sees immediate feedback.
 */
export function notifyIpcError(res: IpcResponse<unknown>): void {
  if (res.status !== "error") return;
  if (TOAST_CODES.has(res.errorCode)) {
    useErrorStore.getState().pushError(res.error, res.errorCode);
  }
}
