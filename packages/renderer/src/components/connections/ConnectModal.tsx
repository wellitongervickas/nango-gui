import { useCallback, useEffect, useRef, useState } from "react";
import Nango from "@nangohq/frontend";
import type { ConnectUI } from "@nangohq/frontend";
import type { ConnectUIEvent } from "@nangohq/frontend";
import { useConnectionsStore } from "@/store/connectionsStore";

type ConnectState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "open" }
  | { kind: "error"; message: string };

interface ConnectModalProps {
  /** Called after a successful connection is made. */
  onConnected?: (connectionId: string, providerConfigKey: string) => void;
  /** Called when the Connect UI is closed without connecting. */
  onClose?: () => void;
  children: (props: { open: () => void; isLoading: boolean }) => React.ReactNode;
}

/**
 * Renders children with an `open` callback. When called, opens the Nango
 * Connect UI iframe to let the user authenticate with an integration.
 */
export function ConnectModal({ onConnected, onClose, children }: ConnectModalProps) {
  const [state, setState] = useState<ConnectState>({ kind: "idle" });
  const connectUIRef = useRef<ConnectUI | null>(null);
  const closedRef = useRef(false);
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections);
  const addConnection = useConnectionsStore((s) => s.addConnection);

  const forceClose = useCallback(() => {
    connectUIRef.current?.close();
    connectUIRef.current = null;
    closedRef.current = true;
    setState({ kind: "idle" });
    onClose?.();
  }, [onClose]);

  // Clean up the Connect UI instance on unmount.
  useEffect(() => {
    return () => {
      connectUIRef.current?.close();
    };
  }, []);

  // ESC key to close the modal.
  useEffect(() => {
    if (state.kind !== "loading" && state.kind !== "open") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") forceClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.kind, forceClose]);

  const handleEvent = useCallback(
    async (event: ConnectUIEvent) => {
      switch (event.type) {
        case "close":
          closedRef.current = true;
          setState({ kind: "idle" });
          connectUIRef.current?.close();
          connectUIRef.current = null;
          onClose?.();
          break;

        case "connect": {
          const { connectionId, providerConfigKey } = event.payload;
          // Optimistically add a stub and then refresh the full list.
          addConnection({
            id: 0,
            connection_id: connectionId,
            provider: providerConfigKey,
            provider_config_key: providerConfigKey,
            created: new Date().toISOString(),
            metadata: null,
          });
          await fetchConnections();
          closedRef.current = true;
          setState({ kind: "idle" });
          connectUIRef.current?.close();
          connectUIRef.current = null;
          onConnected?.(connectionId, providerConfigKey);
          break;
        }

        case "error":
          closedRef.current = true;
          setState({ kind: "error", message: event.payload.errorMessage });
          connectUIRef.current?.close();
          connectUIRef.current = null;
          break;

        default:
          break;
      }
    },
    [addConnection, fetchConnections, onConnected, onClose]
  );

  const open = useCallback(async () => {
    if (!window.nango) {
      setState({ kind: "error", message: "Nango API not available" });
      return;
    }
    closedRef.current = false;
    setState({ kind: "loading" });

    try {
      const sessionPromise = window.nango.createConnectSession({
        endUserId: "local-user",
        endUserDisplayName: "Local User",
      });

      // Timeout after 15s so loading doesn't hang forever.
      const res = await Promise.race([
        sessionPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Connection timed out. Check that your Nango server is reachable.")), 15_000)
        ),
      ]);

      if (res.status === "error") {
        setState({ kind: "error", message: res.error });
        return;
      }

      // Guard: if the user cancelled while the session was being created,
      // don't open the Connect UI.
      if (closedRef.current) return;

      const nango = new Nango({ connectSessionToken: res.data.token });
      const connectUI = nango.openConnectUI({ onEvent: handleEvent });
      connectUIRef.current = connectUI;
      connectUI.open();

      // Guard: if a close/error event already fired synchronously during
      // open(), don't overwrite the resulting state.
      if (!closedRef.current) {
        setState({ kind: "open" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open Connect UI";
      setState({ kind: "error", message });
    }
  }, [handleEvent]);

  return (
    <>
      {children({ open, isLoading: state.kind === "loading" })}

      {/* Cancel overlay — visible during loading & open states */}
      {(state.kind === "loading" || state.kind === "open") && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center pb-6"
          onClick={forceClose}
        >
          <button
            onClick={(e) => { e.stopPropagation(); forceClose(); }}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-xl hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
          >
            {state.kind === "loading" ? "Cancel" : "Close"}
          </button>
        </div>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] shadow-lg"
        >
          <div className="flex items-start gap-2">
            <span className="flex-1">{state.message}</span>
            <button
              onClick={() => setState({ kind: "idle" })}
              className="shrink-0 text-[var(--color-error)]/70 hover:text-[var(--color-error)] cursor-pointer"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
