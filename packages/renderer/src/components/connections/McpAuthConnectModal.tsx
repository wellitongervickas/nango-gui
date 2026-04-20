import { useCallback, useEffect, useState } from "react";
import { useConnectionsStore } from "@/store/connectionsStore";
import { SpinnerIcon, XIcon } from "@/components/icons";

type ModalState =
  | { kind: "idle" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "success"; connectionId: string }
  | { kind: "error"; message: string };

interface McpAuthConnectModalProps {
  /** The integration ID (providerConfigKey) configured for MCP Auth. */
  providerConfigKey: string;
  /** Display name shown in the modal header. */
  displayName: string;
  /** Called after a successful connection is created. */
  onConnected?: (connectionId: string, providerConfigKey: string) => void;
  /** Called when the modal is closed. */
  onClose?: () => void;
  children: (props: { open: () => void; isLoading: boolean }) => React.ReactNode;
}

const fieldClass =
  "w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand-500)] transition-colors font-mono";

const labelClass =
  "block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5";

/**
 * Modal form that collects MCP Auth credentials (bearer token / API key)
 * and creates a connection via the Nango REST API.
 */
export function McpAuthConnectModal({
  providerConfigKey,
  displayName,
  onConnected,
  onClose,
  children,
}: McpAuthConnectModalProps) {
  const [state, setState] = useState<ModalState>({ kind: "idle" });
  const [connectionId, setConnectionId] = useState("");
  const [token, setToken] = useState("");
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections);

  const isOpen = state.kind !== "idle";

  const close = useCallback(() => {
    setState({ kind: "idle" });
    setConnectionId("");
    setToken("");
    onClose?.();
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  const canSubmit =
    connectionId.trim().length > 0 &&
    token.trim().length > 0 &&
    state.kind === "open";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !window.nango) return;

    setState({ kind: "submitting" });

    try {
      const res = await window.nango.createMcpConnection({
        connectionId: connectionId.trim(),
        providerConfigKey,
        token: token.trim(),
      });

      if (res.status === "error") {
        setState({ kind: "error", message: res.error });
        return;
      }

      await fetchConnections();
      setState({ kind: "success", connectionId: res.data.connectionId });
      onConnected?.(res.data.connectionId, res.data.providerConfigKey);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to create connection",
      });
    }
  }

  return (
    <>
      {children({ open: () => setState({ kind: "open" }), isLoading: state.kind === "submitting" })}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Connect {displayName}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  MCP Auth — AI agent authentication
                </p>
              </div>
              <button
                onClick={close}
                className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            {/* Success state */}
            {state.kind === "success" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3">
                  <p className="text-sm text-[var(--color-success)] font-medium">
                    MCP Auth connection created successfully
                  </p>
                  <p className="text-xs text-[var(--color-success)]/80 mt-1 font-mono">
                    {state.connectionId}
                  </p>
                </div>
                <button
                  onClick={close}
                  className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {/* Form */}
            {(state.kind === "open" || state.kind === "submitting" || state.kind === "error") && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Connection ID */}
                <div>
                  <label className={labelClass} htmlFor="mcp-connection-id">
                    Connection ID
                  </label>
                  <input
                    id="mcp-connection-id"
                    type="text"
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    placeholder="e.g. my-agent-prod"
                    className={fieldClass}
                    disabled={state.kind === "submitting"}
                    autoFocus
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                    A unique identifier for this connection.
                  </p>
                </div>

                {/* Token */}
                <div>
                  <label className={labelClass} htmlFor="mcp-token">
                    Access Token
                  </label>
                  <textarea
                    id="mcp-token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Bearer token or API key"
                    rows={3}
                    className={`${fieldClass} resize-y text-xs leading-relaxed`}
                    disabled={state.kind === "submitting"}
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                    The bearer token or API key your AI agent will use for authentication.
                  </p>
                </div>

                {/* Error */}
                {state.kind === "error" && (
                  <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3">
                    <p className="text-sm text-[var(--color-error)]">{state.message}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={state.kind === "submitting"}
                    className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit && state.kind !== "error"}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {state.kind === "submitting" && <SpinnerIcon />}
                    Connect
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
