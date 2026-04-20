import { useCallback, useEffect, useState } from "react";
import { useConnectionsStore } from "@/store/connectionsStore";
import { SpinnerIcon, XIcon } from "@/components/icons";

type ModalState =
  | { kind: "idle" }
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "success"; connectionId: string }
  | { kind: "error"; message: string };

interface JwtBearerConnectModalProps {
  /** The integration ID (providerConfigKey) configured for JWT Bearer auth. */
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
 * Modal form that collects Salesforce JWT Bearer credentials
 * (private key, username) and creates a connection via the Nango REST API.
 */
export function JwtBearerConnectModal({
  providerConfigKey,
  displayName,
  onConnected,
  onClose,
  children,
}: JwtBearerConnectModalProps) {
  const [state, setState] = useState<ModalState>({ kind: "idle" });
  const [connectionId, setConnectionId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [username, setUsername] = useState("");
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections);

  const isOpen = state.kind !== "idle";

  const close = useCallback(() => {
    setState({ kind: "idle" });
    setConnectionId("");
    setPrivateKey("");
    setUsername("");
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
    privateKey.trim().length > 0 &&
    username.trim().length > 0 &&
    state.kind === "open";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !window.nango) return;

    setState({ kind: "submitting" });

    try {
      const res = await window.nango.createJwtConnection({
        connectionId: connectionId.trim(),
        providerConfigKey,
        privateKey: privateKey.trim(),
        username: username.trim(),
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
                  JWT Bearer authentication (server-to-server)
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
                    Connection created successfully
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
                  <label className={labelClass} htmlFor="jwt-connection-id">
                    Connection ID
                  </label>
                  <input
                    id="jwt-connection-id"
                    type="text"
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    placeholder="e.g. salesforce-prod"
                    className={fieldClass}
                    disabled={state.kind === "submitting"}
                    autoFocus
                  />
                </div>

                {/* Username */}
                <div>
                  <label className={labelClass} htmlFor="jwt-username">
                    Salesforce Username
                  </label>
                  <input
                    id="jwt-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="api-user@company.com"
                    className={fieldClass}
                    disabled={state.kind === "submitting"}
                  />
                </div>

                {/* Private Key */}
                <div>
                  <label className={labelClass} htmlFor="jwt-private-key">
                    Private Key (PEM)
                  </label>
                  <textarea
                    id="jwt-private-key"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                    rows={5}
                    className={`${fieldClass} resize-y text-xs leading-relaxed`}
                    disabled={state.kind === "submitting"}
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                    Paste the full PEM-encoded RSA private key from your Salesforce connected app certificate.
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
