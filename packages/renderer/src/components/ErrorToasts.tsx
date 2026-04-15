import { useErrorStore } from "../store/errorStore";
import type { IpcErrorCode } from "@nango-gui/shared";
import { navigate } from "../lib/router";

const ICON_MAP: Record<IpcErrorCode, string> = {
  AUTH_INVALID: "\u{1F511}",
  RATE_LIMITED: "\u{23F3}",
  SERVER_ERROR: "\u{1F4A5}",
  NETWORK_ERROR: "\u{1F4E1}",
  CLIENT_NOT_READY: "\u{2699}\u{FE0F}",
  UNKNOWN: "\u{26A0}\u{FE0F}",
};

function actionLabel(code: IpcErrorCode): string | null {
  if (code === "AUTH_INVALID" || code === "CLIENT_NOT_READY") return "Go to Settings";
  return null;
}

function handleAction(code: IpcErrorCode): void {
  if (code === "AUTH_INVALID" || code === "CLIENT_NOT_READY") {
    navigate("settings");
  }
}

export function ErrorToasts() {
  const notifications = useErrorStore((s) => s.notifications);
  const dismiss = useErrorStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => {
        const action = actionLabel(n.errorCode);
        return (
          <div
            key={n.id}
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-background p-3 shadow-lg animate-in slide-in-from-bottom-2"
          >
            <span className="text-lg shrink-0">{ICON_MAP[n.errorCode]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{n.message}</p>
              {action && (
                <button
                  onClick={() => {
                    handleAction(n.errorCode);
                    dismiss(n.id);
                  }}
                  className="mt-1 text-xs font-medium text-primary hover:underline"
                >
                  {action}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground text-sm"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
