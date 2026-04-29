import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Nango from "@nangohq/frontend";
import type { ConnectUI } from "@nangohq/frontend";
import type { ConnectUIEvent } from "@nangohq/frontend";
import type {
  NangoConnectSessionFieldErrors,
  NangoCreateConnectSessionRequest,
  NangoCreateConnectSessionResult,
} from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { buildConnectUIOptions } from "@/lib/connectUiOptions";
import { getFriendlyErrorMessage, getErrorTitle } from "@/lib/auth-errors";
import type { AuthErrorType } from "@nangohq/frontend";
import { SpinnerIcon, XIcon } from "@/components/icons";
import { SessionTokenPanel } from "./SessionTokenPanel";

type FormValues = {
  endUserId: string;
  endUserEmail: string;
  endUserDisplayName: string;
  /** Comma-separated list of integration keys (provider config keys). */
  allowedIntegrations: string;
};

const DEFAULT_FORM: FormValues = {
  endUserId: "local-user",
  endUserEmail: "",
  endUserDisplayName: "Local User",
  allowedIntegrations: "",
};

type Session = NangoCreateConnectSessionResult;

type ConnectState =
  | { kind: "form" }
  | { kind: "creating" }
  | { kind: "session"; session: Session }
  | { kind: "open"; session: Session }
  | { kind: "error"; message: string; title: string; errorType?: AuthErrorType };

interface ConnectModalProps {
  /** Called after a successful connection is made via the Connect UI. */
  onConnected?: (connectionId: string, providerConfigKey: string) => void;
  /** Called when the modal is closed without connecting. */
  onClose?: () => void;
  /** Pre-fill / lock the allowed_integrations list. */
  defaultAllowedIntegrations?: string[];
  children: (props: { open: () => void; isLoading: boolean }) => React.ReactNode;
}

/**
 * Connect Session Token UI.
 *
 * Renders children with an `open` callback that opens a form for entering
 * end-user details. Submitting calls POST /connect/sessions via IPC, then
 * displays the resulting token + connect_link with copy buttons. The user
 * can then open the embedded Nango Connect UI with the issued token.
 */
export function ConnectModal({
  onConnected,
  onClose,
  defaultAllowedIntegrations,
  children,
}: ConnectModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ConnectState>({ kind: "form" });
  const [form, setForm] = useState<FormValues>(() => ({
    ...DEFAULT_FORM,
    allowedIntegrations: defaultAllowedIntegrations?.join(", ") ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<NangoConnectSessionFieldErrors>({});

  const connectUIRef = useRef<ConnectUI | null>(null);
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections);
  const addConnection = useConnectionsStore((s) => s.addConnection);
  const connectUiTheme = useSettingsStore((s) => s.connectUiTheme);
  const connectUiPrimaryColor = useSettingsStore((s) => s.connectUiPrimaryColor);

  const closeModal = useCallback(() => {
    connectUIRef.current?.close();
    connectUIRef.current = null;
    setIsOpen(false);
    setState({ kind: "form" });
    setFieldErrors({});
    onClose?.();
  }, [onClose]);

  const open = useCallback(() => {
    setIsOpen(true);
    setState({ kind: "form" });
    setFieldErrors({});
  }, []);

  // Cleanup the embedded Connect UI on unmount.
  useEffect(() => {
    return () => {
      connectUIRef.current?.close();
    };
  }, []);

  // ESC closes whichever stage is active.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  const handleConnectUIEvent = useCallback(
    async (event: ConnectUIEvent) => {
      switch (event.type) {
        case "close":
          connectUIRef.current?.close();
          connectUIRef.current = null;
          setIsOpen(false);
          setState({ kind: "form" });
          onClose?.();
          break;

        case "connect": {
          const { connectionId, providerConfigKey } = event.payload;
          addConnection({
            id: 0,
            connection_id: connectionId,
            provider: providerConfigKey,
            provider_config_key: providerConfigKey,
            created: new Date().toISOString(),
            metadata: null,
            tags: null,
          });
          await fetchConnections();
          connectUIRef.current?.close();
          connectUIRef.current = null;
          setIsOpen(false);
          setState({ kind: "form" });
          onConnected?.(connectionId, providerConfigKey);
          break;
        }

        case "error": {
          const { errorType, errorMessage } = event.payload;
          setState({
            kind: "error",
            title: getErrorTitle(errorType),
            message: getFriendlyErrorMessage(errorType, errorMessage),
            errorType,
          });
          connectUIRef.current?.close();
          connectUIRef.current = null;
          break;
        }

        default:
          break;
      }
    },
    [addConnection, fetchConnections, onConnected, onClose]
  );

  const validateClientSide = useCallback((values: FormValues) => {
    const next: NangoConnectSessionFieldErrors = {};
    if (!values.endUserId.trim()) {
      next.endUserId = "End user ID is required.";
    }
    if (values.endUserEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.endUserEmail.trim())) {
      next.endUserEmail = "Enter a valid email address.";
    }
    return next;
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!window.nango) {
        setState({
          kind: "error",
          title: "Configuration error",
          message: "Nango API not available",
        });
        return;
      }
      const clientErrors = validateClientSide(form);
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        return;
      }
      setFieldErrors({});
      setState({ kind: "creating" });

      const allowed = form.allowedIntegrations
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const args: NangoCreateConnectSessionRequest = {
        endUserId: form.endUserId.trim(),
        ...(form.endUserEmail.trim() ? { endUserEmail: form.endUserEmail.trim() } : {}),
        ...(form.endUserDisplayName.trim()
          ? { endUserDisplayName: form.endUserDisplayName.trim() }
          : {}),
        ...(allowed.length > 0 ? { allowedIntegrations: allowed } : {}),
      };

      try {
        const res = await window.nango.createConnectSession(args);
        if (res.status === "error") {
          if (res.errorCode === "VALIDATION_ERROR" && res.fieldErrors) {
            setFieldErrors(res.fieldErrors as NangoConnectSessionFieldErrors);
            setState({ kind: "form" });
            return;
          }
          setState({ kind: "error", title: "Couldn't create session", message: res.error });
          return;
        }
        setState({ kind: "session", session: res.data });
      } catch (err) {
        setState({
          kind: "error",
          title: "Couldn't create session",
          message: err instanceof Error ? err.message : "Failed to create connect session",
        });
      }
    },
    [form, validateClientSide]
  );

  const launchConnectUI = useCallback(
    (session: Session) => {
      const nango = new Nango({ connectSessionToken: session.token });
      const ui = nango.openConnectUI({
        onEvent: handleConnectUIEvent,
        ...buildConnectUIOptions(connectUiTheme, connectUiPrimaryColor),
      });
      connectUIRef.current = ui;
      setState({ kind: "open", session });
      ui.open();
    },
    [connectUiTheme, connectUiPrimaryColor, handleConnectUIEvent]
  );

  const updateField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key as keyof NangoConnectSessionFieldErrors]) return prev;
      const next = { ...prev };
      delete next[key as keyof NangoConnectSessionFieldErrors];
      return next;
    });
  }, []);

  return (
    <>
      {children({ open, isLoading: state.kind === "creating" })}

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              title={
                state.kind === "session" || state.kind === "open"
                  ? "Connect session ready"
                  : "Create Connect session"
              }
              onClose={closeModal}
            />

            <div className="p-5 space-y-4">
              {/* Form stage */}
              {(state.kind === "form" || state.kind === "creating") && (
                <SessionForm
                  form={form}
                  fieldErrors={fieldErrors}
                  onChange={updateField}
                  onSubmit={handleSubmit}
                  isSubmitting={state.kind === "creating"}
                  onCancel={closeModal}
                  lockAllowedIntegrations={Boolean(defaultAllowedIntegrations?.length)}
                />
              )}

              {/* Session stage — token + link + launch CTA */}
              {state.kind === "session" && (
                <SessionTokenPanel
                  token={state.session.token}
                  connectLink={state.session.connectLink}
                  expiresAt={state.session.expiresAt}
                  action={
                    <button
                      type="button"
                      onClick={() => launchConnectUI(state.session)}
                      className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Open Connect UI
                    </button>
                  }
                />
              )}

              {/* Embedded UI is open — show a hint and a stop button */}
              {state.kind === "open" && (
                <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
                  <p>The Nango Connect UI is open. Complete the flow there.</p>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Error stage */}
              {state.kind === "error" && (
                <div role="alert" className="space-y-3">
                  <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-3">
                    <p className="font-medium text-[var(--color-error)] text-sm">{state.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                      {state.message}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setState({ kind: "form" })}
                      className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
      >
        <XIcon />
      </button>
    </div>
  );
}

interface SessionFormProps {
  form: FormValues;
  fieldErrors: NangoConnectSessionFieldErrors;
  onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  lockAllowedIntegrations: boolean;
}

function SessionForm({
  form,
  fieldErrors,
  onChange,
  onSubmit,
  isSubmitting,
  onCancel,
  lockAllowedIntegrations,
}: SessionFormProps) {
  const allowedChips = useMemo(
    () =>
      form.allowedIntegrations
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [form.allowedIntegrations]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        label="End user ID"
        required
        error={fieldErrors.endUserId}
        hint="Stable identifier for the end user (e.g. your app's user ID)."
      >
        <input
          type="text"
          value={form.endUserId}
          onChange={(e) => onChange("endUserId", e.target.value)}
          autoFocus
          className={inputClass(Boolean(fieldErrors.endUserId))}
        />
      </Field>

      <Field
        label="Email"
        error={fieldErrors.endUserEmail}
        hint="Optional. Used by Nango for end-user notifications."
      >
        <input
          type="email"
          value={form.endUserEmail}
          onChange={(e) => onChange("endUserEmail", e.target.value)}
          placeholder="user@example.com"
          className={inputClass(Boolean(fieldErrors.endUserEmail))}
        />
      </Field>

      <Field label="Display name" error={fieldErrors.endUserDisplayName}>
        <input
          type="text"
          value={form.endUserDisplayName}
          onChange={(e) => onChange("endUserDisplayName", e.target.value)}
          className={inputClass(Boolean(fieldErrors.endUserDisplayName))}
        />
      </Field>

      <Field
        label="Allowed integrations"
        error={fieldErrors.allowedIntegrations}
        hint="Optional. Comma-separated provider config keys (e.g. github, slack)."
      >
        <input
          type="text"
          value={form.allowedIntegrations}
          onChange={(e) => onChange("allowedIntegrations", e.target.value)}
          placeholder="github, slack"
          disabled={lockAllowedIntegrations}
          className={inputClass(Boolean(fieldErrors.allowedIntegrations))}
        />
        {allowedChips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {allowedChips.map((c) => (
              <span
                key={c}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand-400)]/15 text-[var(--color-brand-400)] font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting && <SpinnerIcon />}
          Create session
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
        {label}
        {required ? <span className="text-[var(--color-error)] ml-0.5">*</span> : null}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="text-xs text-[var(--color-error)] mt-1" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 opacity-80">{hint}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    "w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed";
  const border = hasError
    ? "border-[var(--color-error)] focus:ring-[var(--color-error)] focus:border-[var(--color-error)]"
    : "border-[var(--color-border)] focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)]";
  return `${base} ${border}`;
}
