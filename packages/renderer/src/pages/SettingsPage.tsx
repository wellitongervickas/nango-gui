import { useEffect, useState } from "react";
import type { AppTheme, NangoEnvironment } from "@nango-gui/shared";
import { useSettingsStore } from "@/store/settingsStore";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/router";
import { ErrorBanner } from "../components/common/ErrorBanner";

export function SettingsPage() {
  const {
    theme,
    environment,
    maskedKey,
    appVersion,
    electronVersion,
    nangoSdkVersion,
    isLoading,
    error,
    fetchSettings,
    updateTheme,
    updateEnvironment,
  } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (isLoading && !appVersion) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg)]">
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Settings</h1>

        {error && <ErrorBanner message={error} />}

        <ApiKeySection maskedKey={maskedKey} environment={environment} />
        <EnvironmentSection environment={environment} onUpdate={updateEnvironment} />
        <AppearanceSection theme={theme} onUpdate={updateTheme} />
        <AboutSection
          appVersion={appVersion}
          electronVersion={electronVersion}
          nangoSdkVersion={nangoSdkVersion}
        />
      </div>
    </div>
  );
}

// ── API Key (per-environment) ──────────────────────────────────────────────

const ENV_LABELS: Record<NangoEnvironment, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};

const ENV_COLORS: Record<NangoEnvironment, string> = {
  development: "var(--color-env-development)",
  staging: "var(--color-env-staging)",
  production: "var(--color-env-production)",
};

function ApiKeySection({
  maskedKey,
  environment,
}: {
  maskedKey: string | null;
  environment: NangoEnvironment;
}) {
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const environmentKeys = useSettingsStore((s) => s.environmentKeys);
  const [changeState, setChangeState] = useState<"idle" | "entering" | "validating">("idle");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  // Reset UI state when environment changes
  useEffect(() => {
    setChangeState("idle");
    setNewKey("");
    setKeyError(null);
    setRemoveConfirm(false);
  }, [environment]);

  async function handleValidateAndSave() {
    if (!newKey.trim()) return;
    if (!window.nango || !window.credentials) {
      setKeyError("Not running in Electron. Cannot save keys.");
      return;
    }
    setChangeState("validating");
    setKeyError(null);
    try {
      const validateRes = await window.nango.validateKey({ secretKey: newKey.trim() });
      if (validateRes.status === "error" || !validateRes.data.valid) {
        setKeyError("Invalid API key. Please check and try again.");
        setChangeState("entering");
        return;
      }
      const saveRes = await window.credentials.save({
        secretKey: newKey.trim(),
        environment,
      });
      if (saveRes.status === "error") {
        setKeyError(saveRes.error);
        setChangeState("entering");
        return;
      }
      setChangeState("idle");
      setNewKey("");
      await fetchSettings();
    } catch {
      setKeyError("Failed to save key. Please try again.");
      setChangeState("entering");
    }
  }

  async function handleRemove() {
    if (!window.credentials) return;
    const res = await window.credentials.clear();
    if (res.status === "error") return;
    navigate("setup");
    window.location.reload();
  }

  const configuredEnvs = (Object.keys(environmentKeys) as NangoEnvironment[]).filter(
    (e) => environmentKeys[e]
  );

  return (
    <Section title="API Keys">
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">
        Each environment uses its own Nango secret key.
        The key below is for the active <strong className="text-[var(--color-text)]">{ENV_LABELS[environment]}</strong> environment.
      </p>

      {/* Per-env key status indicators */}
      <div className="mb-4 flex gap-3">
        {(["development", "staging", "production"] as NangoEnvironment[]).map((env) => (
          <div key={env} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: ENV_COLORS[env] }}
            />
            <span className={cn(
              environmentKeys[env] ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
            )}>
              {ENV_LABELS[env]}
            </span>
            <span className={cn(
              "text-xs",
              environmentKeys[env] ? "text-green-500" : "text-[var(--color-text-muted)]"
            )}>
              {environmentKeys[env] ? "configured" : "not set"}
            </span>
          </div>
        ))}
      </div>

      {maskedKey ? (
        <div className="space-y-3">
          {changeState === "idle" ? (
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-sm text-[var(--color-text)]">{maskedKey}</span>
              <div className="flex gap-2">
                <ActionButton onClick={() => setChangeState("entering")}>Change Key</ActionButton>
                {configuredEnvs.length <= 1 ? (
                  removeConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)]">Remove key?</span>
                      <ActionButton variant="destructive" onClick={handleRemove}>
                        Yes, remove
                      </ActionButton>
                      <ActionButton onClick={() => setRemoveConfirm(false)}>Cancel</ActionButton>
                    </div>
                  ) : (
                    <ActionButton variant="destructive" onClick={() => setRemoveConfirm(true)}>
                      Remove Key
                    </ActionButton>
                  )
                ) : (
                  removeConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)]">Remove all keys?</span>
                      <ActionButton variant="destructive" onClick={handleRemove}>
                        Yes, remove all
                      </ActionButton>
                      <ActionButton onClick={() => setRemoveConfirm(false)}>Cancel</ActionButton>
                    </div>
                  ) : (
                    <ActionButton variant="destructive" onClick={() => setRemoveConfirm(true)}>
                      Remove All Keys
                    </ActionButton>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleValidateAndSave(); }}
                placeholder={`Enter secret key for ${ENV_LABELS[environment]}`}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)]"
                autoFocus
              />
              {keyError && (
                <p className="text-xs text-[var(--color-error)]">{keyError}</p>
              )}
              <div className="flex gap-2">
                <ActionButton
                  onClick={handleValidateAndSave}
                  disabled={!newKey.trim() || changeState === "validating"}
                >
                  {changeState === "validating" ? "Validating…" : "Save Key"}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setChangeState("idle");
                    setNewKey("");
                    setKeyError(null);
                  }}
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            No API key configured for <strong>{ENV_LABELS[environment]}</strong>.
          </p>
          {changeState === "entering" || changeState === "validating" ? (
            <div className="space-y-2">
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleValidateAndSave(); }}
                placeholder={`Enter secret key for ${ENV_LABELS[environment]}`}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)]"
                autoFocus
              />
              {keyError && (
                <p className="text-xs text-[var(--color-error)]">{keyError}</p>
              )}
              <div className="flex gap-2">
                <ActionButton
                  onClick={handleValidateAndSave}
                  disabled={!newKey.trim() || changeState === "validating"}
                >
                  {changeState === "validating" ? "Validating…" : "Save Key"}
                </ActionButton>
                <ActionButton onClick={() => { setChangeState("idle"); setNewKey(""); setKeyError(null); }}>
                  Cancel
                </ActionButton>
              </div>
            </div>
          ) : (
            <ActionButton onClick={() => setChangeState("entering")}>
              Configure Key
            </ActionButton>
          )}
        </div>
      )}
    </Section>
  );
}

// ── Environment ────────────────────────────────────────────────────────────

function EnvironmentSection({
  environment,
  onUpdate,
}: {
  environment: NangoEnvironment;
  onUpdate: (env: NangoEnvironment) => Promise<void>;
}) {
  const [switching, setSwitching] = useState(false);
  const [pendingEnv, setPendingEnv] = useState<NangoEnvironment | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);

  async function handleSwitch(env: NangoEnvironment) {
    if (env === environment) return;
    if (pendingEnv !== null) return;
    setPendingEnv(env);
    setEnvError(null);
    setSwitching(true);
    try {
      await onUpdate(env);
    } catch (err) {
      setEnvError(err instanceof Error ? err.message : "Failed to switch environment");
    } finally {
      setSwitching(false);
      setPendingEnv(null);
    }
  }

  return (
    <Section title="Environment">
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">
        Switch between Nango environments. Switching will affect all API calls.
      </p>
      <div className="flex gap-2">
        {(["development", "staging", "production"] as NangoEnvironment[]).map((env) => {
          const label = env === "development" ? "Dev" : env === "staging" ? "Staging" : "Prod";
          return (
            <button
              key={env}
              onClick={() => handleSwitch(env)}
              disabled={switching}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium capitalize transition-colors",
                environment === env
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-400)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-focus)] hover:text-[var(--color-text)]",
                switching && "cursor-not-allowed opacity-50"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {envError && (
        <p className="mt-2 text-xs text-[var(--color-error)]">{envError}</p>
      )}
    </Section>
  );
}

// ── Appearance ─────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: AppTheme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function AppearanceSection({
  theme,
  onUpdate,
}: {
  theme: AppTheme;
  onUpdate: (theme: AppTheme) => Promise<void>;
}) {
  const [themeError, setThemeError] = useState<string | null>(null);

  async function handleTheme(t: AppTheme) {
    if (t === theme) return;
    setThemeError(null);
    try {
      await onUpdate(t);
    } catch (err) {
      setThemeError(err instanceof Error ? err.message : "Failed to save theme");
    }
  }

  return (
    <Section title="Appearance">
      <div className="flex gap-2">
        {THEME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleTheme(value)}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              theme === value
                ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-400)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-focus)] hover:text-[var(--color-text)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {themeError && (
        <p className="mt-2 text-xs text-[var(--color-error)]">{themeError}</p>
      )}
    </Section>
  );
}

// ── About ──────────────────────────────────────────────────────────────────

function AboutSection({
  appVersion,
  electronVersion,
  nangoSdkVersion,
}: {
  appVersion: string;
  electronVersion: string;
  nangoSdkVersion: string;
}) {
  return (
    <Section title="About">
      <dl className="space-y-2 text-sm">
        <AboutRow label="App version" value={appVersion || "—"} />
        <AboutRow label="Electron" value={electronVersion || "—"} />
        <AboutRow label="Nango SDK" value={nangoSdkVersion ? `v${nangoSdkVersion}` : "—"} />
        <div className="pt-1">
          <a
            href="https://github.com/wellitongervickas/nango-gui"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-brand-500)] hover:underline"
          >
            View on GitHub
          </a>
        </div>
      </dl>
    </Section>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="font-mono text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        variant === "destructive"
          ? "border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          : "border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}
