import { useCallback, useEffect, useState } from "react";
import type { SuggestedScope } from "@/lib/scope-discovery";
import { XIcon } from "@/components/icons";

interface ScopeSuggestionPanelProps {
  providerName: string;
  scopes: SuggestedScope[];
  onAccept: (selectedScopes: string[]) => void;
  onEditManually: (selectedScopes: string[]) => void;
  onDismiss: () => void;
}

/**
 * Inline checklist panel that renders AI-suggested OAuth2 scopes.
 * Recommended scopes are pre-checked; optional scopes are unchecked.
 * The counter in "Accept selected (n)" updates live as checkboxes toggle.
 *
 * Keyboard: Tab/Space navigate and toggle checkboxes; Esc closes the panel.
 */
export function ScopeSuggestionPanel({
  providerName,
  scopes,
  onAccept,
  onEditManually,
  onDismiss,
}: ScopeSuggestionPanelProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(scopes.filter((s) => s.recommended).map((s) => s.scope))
  );

  // Esc closes the panel and restores the original textarea content.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  const toggle = useCallback((scope: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  const selectedScopes = scopes
    .filter((s) => checked.has(s.scope))
    .map((s) => s.scope);

  return (
    <div
      role="region"
      aria-label="Suggested scopes"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]">
        {/* Muted green checkmark */}
        <span className="text-[var(--color-success)] shrink-0" aria-hidden="true">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className="flex-1 text-xs font-medium text-[var(--color-text-primary)]">
          AI suggested {scopes.length} scope{scopes.length !== 1 ? "s" : ""} for{" "}
          {providerName}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          aria-label="Dismiss suggestions"
        >
          <XIcon />
        </button>
      </div>

      {/* Scrollable checklist */}
      <ul
        role="list"
        className="overflow-y-auto divide-y divide-[var(--color-border)]/40"
        style={{ maxHeight: "320px" }}
      >
        {scopes.map((s) => {
          const isChecked = checked.has(s.scope);
          const id = `scope-${s.scope.replace(/[^a-z0-9]/gi, "_")}`;
          return (
            <li
              key={s.scope}
              role="listitem"
              onClick={() => toggle(s.scope)}
              className="flex items-start gap-2.5 px-3 py-2 hover:bg-[var(--color-bg-base)]/30 cursor-pointer select-none"
            >
              <input
                id={id}
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(s.scope)}
                onClick={(e) => e.stopPropagation()}
                tabIndex={0}
                className="mt-0.5 shrink-0 cursor-pointer accent-[var(--color-brand-400)]"
                aria-checked={isChecked}
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={id}
                  className="font-mono text-xs text-[var(--color-text-primary)] cursor-pointer break-all"
                >
                  {s.scope}
                </label>
                {s.description && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-0.5">
                    {s.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-t border-[var(--color-border)]">
        <button
          type="button"
          disabled={selectedScopes.length === 0}
          onClick={() => onAccept(selectedScopes)}
          title={
            selectedScopes.length === 0
              ? "Select at least one scope"
              : undefined
          }
          className="flex-1 py-1.5 px-3 text-xs font-medium rounded-md bg-[var(--color-brand-400)] text-white hover:bg-[var(--color-brand-400)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          aria-label={`Accept ${selectedScopes.length} selected scope${selectedScopes.length !== 1 ? "s" : ""}`}
        >
          Accept selected ({selectedScopes.length})
        </button>
        <button
          type="button"
          onClick={() => onEditManually(selectedScopes)}
          className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer shrink-0"
        >
          Edit manually
        </button>
      </div>
    </div>
  );
}
