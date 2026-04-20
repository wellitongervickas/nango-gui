import { useCallback, useEffect, useRef, useState } from "react";
import { discoverScopes, type SuggestedScope } from "@/lib/scope-discovery";
import { ScopeSuggestionPanel } from "./ScopeSuggestionPanel";
import { SpinnerIcon, ExternalLinkIcon } from "@/components/icons";

// Auth modes that support scope auto-discovery (OAuth2 family).
const OAUTH2_AUTH_MODES = ["OAUTH2", "OAUTH2_CC"];

function isOAuth2(authMode?: string): boolean {
  if (!authMode) return false;
  const upper = authMode.toUpperCase();
  return OAUTH2_AUTH_MODES.some((m) => upper.includes(m));
}

type SuggestionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "suggestions"; scopes: SuggestedScope[] }
  | { kind: "fallback"; docsUrl?: string }
  | { kind: "error" };

interface ScopesFieldProps {
  /**
   * Provider display name shown in the suggestion panel header
   * (e.g. "GitHub", "Slack").
   */
  providerName: string;
  /**
   * Nango provider key used for the IPC scope discovery call
   * (e.g. "github", "slack"). Leave empty when no provider is selected yet.
   */
  providerKey: string;
  /**
   * Provider auth mode (e.g. "OAUTH2", "API_KEY"). The "Suggest scopes"
   * button is only rendered for OAuth2 providers.
   */
  authMode?: string;
  /**
   * Current scopes value as a raw string (space- or comma-separated).
   * Controlled by the parent.
   */
  value: string;
  /** Called whenever the user edits the textarea or accepts suggestions. */
  onChange: (value: string) => void;
  /** Client-side validation error message to display below the field. */
  error?: string;
  /** When true, wraps the field with a red focus ring to indicate a server error. */
  hasServerError?: boolean;
  /** Disables the Suggest button (e.g. before a provider is selected). */
  disabled?: boolean;
}

/**
 * Scopes input field with optional "Suggest scopes" AI discovery button.
 *
 * States:
 *   idle       — textarea + Suggest button (OAuth2 only)
 *   loading    — spinner/label in button; textarea read-only; Cancel after 1 s
 *   suggestions — ScopeSuggestionPanel replaces textarea
 *   fallback   — info note + docs link; textarea remains editable
 *   error      — toast (bottom-right) with "Try again"; button resets to idle
 *
 * Keyboard: Tab/Space/Esc as per WCAG checklist row conventions.
 * No color-only indicators — checked state uses checkbox icon + color.
 */
export function ScopesField({
  providerName,
  providerKey,
  authMode,
  value,
  onChange,
  error,
  hasServerError,
  disabled,
}: ScopesFieldProps) {
  const [state, setState] = useState<SuggestionState>({ kind: "idle" });
  const [showCancel, setShowCancel] = useState(false);
  const [showDelayNote, setShowDelayNote] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [acceptedNote, setAcceptedNote] = useState(false);

  const cancelledRef = useRef(false);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** The value present before the loading state begins, used for Cancel. */
  const originalValueRef = useRef(value);

  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, []);

  const handleSuggest = useCallback(async () => {
    if (!providerKey) return;
    cancelledRef.current = false;
    originalValueRef.current = value;
    setState({ kind: "loading" });
    setShowCancel(false);
    setShowDelayNote(false);

    // Cancel button appears after 1 s.
    cancelTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) setShowCancel(true);
    }, 1000);

    // Delay sub-label appears after 2 s.
    delayTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) setShowDelayNote(true);
    }, 2000);

    try {
      const result = await discoverScopes(providerKey);
      if (cancelledRef.current) return;

      clearTimeout(cancelTimerRef.current!);
      clearTimeout(delayTimerRef.current!);
      setShowCancel(false);
      setShowDelayNote(false);

      if (!result.supported) {
        setState({ kind: "fallback", docsUrl: result.docsUrl });
      } else {
        setState({ kind: "suggestions", scopes: result.scopes });
      }
    } catch (err) {
      if (cancelledRef.current) return;
      clearTimeout(cancelTimerRef.current!);
      clearTimeout(delayTimerRef.current!);
      setShowCancel(false);
      setShowDelayNote(false);
      setState({ kind: "idle" });
      const msg =
        err instanceof Error ? err.message : "Scope discovery failed";
      setErrorToast(msg);
    }
  }, [providerKey, value]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    setState({ kind: "idle" });
    setShowCancel(false);
    setShowDelayNote(false);
    // Restore the text that was present before discovery started.
    onChange(originalValueRef.current);
  }, [onChange]);

  const handleAccept = useCallback(
    (selectedScopes: string[]) => {
      onChange(selectedScopes.join(" "));
      setState({ kind: "idle" });
      setAcceptedNote(true);
      noteTimerRef.current = setTimeout(() => setAcceptedNote(false), 5000);
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [onChange]
  );

  const handleEditManually = useCallback(
    (selectedScopes: string[]) => {
      onChange(selectedScopes.join(" "));
      setState({ kind: "idle" });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [onChange]
  );

  const handleDismiss = useCallback(() => {
    setState({ kind: "idle" });
    onChange(originalValueRef.current);
  }, [onChange]);

  const handleTextareaChange = useCallback(
    (raw: string) => {
      onChange(raw);
      // Dismiss the "Populated from AI suggestions" note on first keystroke.
      if (acceptedNote) setAcceptedNote(false);
      // Dismiss the fallback note when the user starts typing.
      if (state.kind === "fallback") setState({ kind: "idle" });
    },
    [onChange, acceptedNote, state.kind]
  );

  const showSuggestButton = isOAuth2(authMode);
  const isLoading = state.kind === "loading";
  const showPanel = state.kind === "suggestions";

  return (
    <div
      className={`space-y-1.5 rounded-md transition-colors ${
        hasServerError ? "ring-1 ring-[var(--color-error)] p-2 -m-2" : ""
      }`}
    >
      {/* ── Label row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Custom OAuth Scopes
        </span>

        {/* Suggest scopes button — OAuth2 only, hidden while panel is open */}
        {showSuggestButton && !showPanel && state.kind !== "fallback" && (
          <div className="flex items-center gap-2 shrink-0">
            {isLoading && showCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isLoading || disabled || !providerKey}
              aria-label="Auto-discover OAuth2 scopes for this provider"
              aria-busy={isLoading}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-brand-400)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  Discovering scopes...
                </>
              ) : (
                <>
                  {/* Sparkles icon */}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                  Suggest scopes
                </>
              )}
            </button>
          </div>
        )}

        {/* "View scopes" link — shown only in fallback state */}
        {state.kind === "fallback" && (
          <a
            href={state.docsUrl ?? "https://docs.nango.dev/integrate/guides/authorize-an-api"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--color-brand-400)] hover:underline shrink-0"
          >
            View scopes
            <ExternalLinkIcon />
          </a>
        )}
      </div>

      {/* ── Delay sub-label ───────────────────────────────────────────── */}
      {isLoading && showDelayNote && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Analyzing provider capabilities...
        </p>
      )}

      {/* ── Suggestion panel (replaces textarea) ─────────────────────── */}
      {showPanel ? (
        <ScopeSuggestionPanel
          providerName={providerName}
          scopes={(state as { kind: "suggestions"; scopes: SuggestedScope[] }).scopes}
          onAccept={handleAccept}
          onEditManually={handleEditManually}
          onDismiss={handleDismiss}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleTextareaChange(e.target.value)}
          placeholder="e.g. read:user repo gist"
          rows={2}
          readOnly={isLoading}
          className={`w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)] resize-none${
            isLoading ? " opacity-50 pointer-events-none" : ""
          }`}
        />
      )}

      {/* ── Fallback note ─────────────────────────────────────────────── */}
      {state.kind === "fallback" && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          {providerName} is not yet supported for auto-discovery.{" "}
          <a
            href={state.docsUrl ?? "https://docs.nango.dev/integrate/guides/authorize-an-api"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-400)] hover:underline"
          >
            View scope docs ↗
          </a>
        </p>
      )}

      {/* ── Accepted note ─────────────────────────────────────────────── */}
      {acceptedNote && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Populated from AI suggestions. You can edit these.
        </p>
      )}

      {/* ── Validation error ──────────────────────────────────────────── */}
      {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}

      {/* ── Error toast (bottom-right fixed overlay) ──────────────────── */}
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-bg-surface)] px-4 py-3 text-sm shadow-lg"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <p className="font-medium text-[var(--color-error)]">
                Scope discovery failed
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {errorToast}. Please try again or enter scopes manually.
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorToast(null);
                  handleSuggest();
                }}
                className="mt-1.5 text-xs font-medium text-[var(--color-brand-400)] hover:underline cursor-pointer"
              >
                Try again
              </button>
            </div>
            <button
              type="button"
              onClick={() => setErrorToast(null)}
              className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
