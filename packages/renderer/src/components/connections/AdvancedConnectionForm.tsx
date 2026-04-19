import { useCallback, useEffect, useState } from "react";
import type { AdvancedConnectionConfig } from "@nango-gui/shared";
import { ChevronIcon, XIcon } from "@/components/icons";

interface KVPair {
  key: string;
  value: string;
}

interface ValidationErrors {
  authParams?: string;
  userScopes?: string;
}

type HighlightField = "oauthClientId" | "oauthClientSecret" | "userScopes" | "authParams";

interface AdvancedConnectionFormProps {
  providerName: string;
  value: AdvancedConnectionConfig;
  onChange: (cfg: AdvancedConnectionConfig) => void;
  /** Client-side validation errors to surface inline. */
  errors?: ValidationErrors;
  /**
   * Field to visually highlight — set when the server identified a specific
   * field as the source of a validation error.
   */
  serverHighlightField?: HighlightField;
}

function kvPairsFromRecord(record: Record<string, string> | undefined): KVPair[] {
  if (!record || Object.keys(record).length === 0) return [{ key: "", value: "" }];
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function recordFromKvPairs(pairs: KVPair[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) result[key.trim()] = value;
  }
  return result;
}

/**
 * Validates the advanced connection config and returns a record of errors.
 * Returns an empty object when everything is valid.
 */
export function validateAdvancedConfig(cfg: AdvancedConnectionConfig): ValidationErrors {
  const errors: ValidationErrors = {};

  if (cfg.authParams) {
    const pairs = Object.entries(cfg.authParams);
    const hasEmptyKey = pairs.some(([k]) => !k.trim());
    if (hasEmptyKey) {
      errors.authParams = "Auth param keys must not be empty.";
    }
  }

  if (cfg.userScopes && cfg.userScopes.length > 0) {
    const invalid = cfg.userScopes.some((s) => !/^[\w:./\-*]+$/.test(s.trim()));
    if (invalid) {
      errors.userScopes =
        "Scopes must be alphanumeric and may include colons, dots, slashes, hyphens, or asterisks.";
    }
  }

  return errors;
}

/**
 * Collapsed/expanded advanced settings section for the connection wizard.
 * Exposes auth params (key-value), custom OAuth scopes, and developer app credentials.
 */
export function AdvancedConnectionForm({
  providerName,
  value,
  onChange,
  errors = {},
  serverHighlightField,
}: AdvancedConnectionFormProps) {
  // Auto-expand when the server identified a specific field that needs attention.
  const [isOpen, setIsOpen] = useState(() => serverHighlightField !== undefined);

  // If serverHighlightField changes (e.g. new error arrives), expand the form.
  useEffect(() => {
    if (serverHighlightField !== undefined) setIsOpen(true);
  }, [serverHighlightField]);

  // Local state for the key-value auth params editor
  const [kvPairs, setKvPairs] = useState<KVPair[]>(() =>
    kvPairsFromRecord(value.authParams)
  );
  // Local state for scopes as a comma-separated string
  const [scopesInput, setScopesInput] = useState<string>(
    () => (value.userScopes ?? []).join(", ")
  );

  const updateKvPairs = useCallback(
    (next: KVPair[]) => {
      setKvPairs(next);
      onChange({ ...value, authParams: recordFromKvPairs(next) });
    },
    [value, onChange]
  );

  const handleKvChange = (idx: number, field: "key" | "value", val: string) => {
    const next = kvPairs.map((p, i) => (i === idx ? { ...p, [field]: val } : p));
    updateKvPairs(next);
  };

  const handleAddKv = () => {
    updateKvPairs([...kvPairs, { key: "", value: "" }]);
  };

  const handleRemoveKv = (idx: number) => {
    const next = kvPairs.filter((_, i) => i !== idx);
    updateKvPairs(next.length > 0 ? next : [{ key: "", value: "" }]);
  };

  const handleScopesChange = (raw: string) => {
    setScopesInput(raw);
    const scopes = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...value, userScopes: scopes });
  };

  const handleClientIdChange = (clientId: string) => {
    onChange({ ...value, oauthClientId: clientId || undefined });
  };

  const handleClientSecretChange = (clientSecret: string) => {
    onChange({ ...value, oauthClientSecret: clientSecret || undefined });
  };

  const hasContent =
    Object.values(value.authParams ?? {}).some(Boolean) ||
    (value.userScopes ?? []).length > 0 ||
    value.oauthClientId ||
    value.oauthClientSecret;

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)]/50 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">Advanced</span>
          {!isOpen && hasContent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand-400)]/15 text-[var(--color-brand-400)] font-medium">
              configured
            </span>
          )}
        </span>
        <span aria-hidden>
          <ChevronIcon direction={isOpen ? "up" : "down"} />
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-5 border-t border-[var(--color-border)]">
          {/* ── Auth Params ─────────────────────────────────────────────── */}
          <div className={`mt-4 space-y-2 rounded-md transition-colors ${serverHighlightField === "authParams" ? "ring-1 ring-[var(--color-error)] p-2 -m-2" : ""}`}>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Auth Params
              </label>
              <Tooltip text={`Additional key-value pairs appended to the ${providerName} authorization URL. Useful for provider-specific parameters (e.g. tenant_id). See Nango docs for details.`} />
            </div>

            <div className="space-y-1.5">
              {kvPairs.map((pair, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => handleKvChange(idx, "key", e.target.value)}
                    placeholder="key"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)]"
                  />
                  <input
                    type="text"
                    value={pair.value}
                    onChange={(e) => handleKvChange(idx, "value", e.target.value)}
                    placeholder="value"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveKv(idx)}
                    aria-label="Remove param"
                    className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                    disabled={kvPairs.length === 1 && !pair.key && !pair.value}
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>

            {errors.authParams && (
              <p className="text-xs text-[var(--color-error)]">{errors.authParams}</p>
            )}

            <button
              type="button"
              onClick={handleAddKv}
              className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer"
            >
              + Add param
            </button>
          </div>

          {/* ── Custom OAuth Scopes ──────────────────────────────────────── */}
          <div className={`space-y-1.5 rounded-md transition-colors ${serverHighlightField === "userScopes" ? "ring-1 ring-[var(--color-error)] p-2 -m-2" : ""}`}>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Custom OAuth Scopes
              </label>
              <Tooltip text={`Override the default OAuth scopes requested from ${providerName}. Enter scopes as a comma-separated list (e.g. read:user, repo). See Nango docs for your provider's scope reference.`} />
            </div>
            <input
              type="text"
              value={scopesInput}
              onChange={(e) => handleScopesChange(e.target.value)}
              placeholder="e.g. read:user, repo, gist"
              className="w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)]"
            />
            {errors.userScopes && (
              <p className="text-xs text-[var(--color-error)]">{errors.userScopes}</p>
            )}
          </div>

          {/* ── Developer App Credentials ────────────────────────────────── */}
          <div className={`space-y-1.5 rounded-md transition-colors ${(serverHighlightField === "oauthClientId" || serverHighlightField === "oauthClientSecret") ? "ring-1 ring-[var(--color-error)] p-2 -m-2" : ""}`}>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Developer App Credentials
              </label>
              <Tooltip text={`Override the ${providerName} OAuth client ID and secret registered in your Nango integration. Use this to test with your own developer app. Leave blank to use the values from your Nango dashboard.`} />
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={value.oauthClientId ?? ""}
                onChange={(e) => handleClientIdChange(e.target.value)}
                placeholder="Client ID (leave blank to use dashboard value)"
                className="w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)]"
                autoComplete="off"
              />
              <input
                type="password"
                value={value.oauthClientSecret ?? ""}
                onChange={(e) => handleClientSecretChange(e.target.value)}
                placeholder="Client Secret (leave blank to use dashboard value)"
                className="w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-400)] focus:border-[var(--color-brand-400)]"
                autoComplete="new-password"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tooltip helper ────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-default"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        tabIndex={0}
        aria-label="More info"
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute left-5 top-0 z-50 w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-lg leading-relaxed"
        >
          {text}{" "}
          <a
            href="https://docs.nango.dev/integrate/guides/authorize-an-api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-400)] hover:underline"
          >
            Nango docs ↗
          </a>
        </span>
      )}
    </span>
  );
}
