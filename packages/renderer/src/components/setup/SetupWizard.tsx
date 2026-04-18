import { useState, type FormEvent } from "react";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import type { NangoEnvironment } from "@nango-gui/shared";
import { Button } from "@/components/ui/button";
import { navigate } from "@/lib/router";

type Step = "welcome" | "api-key" | "validate" | "done";

const STEPS: Step[] = ["welcome", "api-key", "validate", "done"];
const VISIBLE_STEPS: Step[] = ["welcome", "api-key", "validate"];
const STEP_LABELS: Record<Step, string> = {
  welcome: "Welcome",
  "api-key": "Connect",
  validate: "Confirm",
  done: "Done",
};

export function SetupWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [secretKey, setSecretKey] = useState("");
  const [environment, setEnvironment] = useState<NangoEnvironment>("development");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    if (!window.nango) { setError("Nango API not available."); return; }
    setValidating(true);
    setError(null);
    try {
      const res = await window.nango.validateKey({ secretKey, environment });
      if (res.status === "error") {
        setError(res.error);
        return;
      }
      if (!res.data.valid) {
        setError("Invalid API key. Please check and try again.");
        return;
      }
      setStep("validate");
    } catch {
      setError("Failed to connect. Check your internet connection.");
    } finally {
      setValidating(false);
    }
  }

  async function handleSave() {
    if (!window.credentials) { setError("Credentials API not available."); return; }
    setValidating(true);
    setError(null);
    try {
      const res = await window.credentials.save({ secretKey, environment });
      if (res.status === "error") {
        setError(res.error);
        return;
      }
      setStep("done");
    } catch {
      setError("Failed to save credentials.");
    } finally {
      setValidating(false);
    }
  }

  function handleDone() {
    navigate("/");
    window.location.reload();
  }

  function handleBack() {
    setError(null);
    if (step === "api-key") setStep("welcome");
    if (step === "validate") setStep("api-key");
  }

  const currentIndex = STEPS.indexOf(step);
  const canGoBack = step === "api-key" || step === "validate";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg-base)]">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        {step !== "done" && (
          <div className="mb-6 flex items-center justify-center gap-2">
            {VISIBLE_STEPS.map((visibleStep, i) => {
              const idx = STEPS.indexOf(visibleStep);
              const isCompleted = idx < currentIndex;
              const isCurrent = visibleStep === step;
              return (
                <div key={visibleStep} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={[
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        isCompleted
                          ? "bg-[var(--color-brand-500)] text-white"
                          : isCurrent
                          ? "border-2 border-[var(--color-brand-500)] text-[var(--color-brand-400)]"
                          : "border border-[var(--color-border-base)] text-[var(--color-text-secondary)]",
                      ].join(" ")}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={[
                        "text-[10px] font-medium",
                        isCurrent
                          ? "text-[var(--color-brand-400)]"
                          : "text-[var(--color-text-secondary)]",
                      ].join(" ")}
                    >
                      {STEP_LABELS[visibleStep]}
                    </span>
                  </div>
                  {i < VISIBLE_STEPS.length - 1 && (
                    <div
                      className={[
                        "mb-4 h-px w-10 transition-colors",
                        isCompleted
                          ? "bg-[var(--color-brand-500)]"
                          : "bg-[var(--color-border-subtle)]",
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Card */}
        <div className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-8 shadow-lg">
          {step === "welcome" && <WelcomeStep onNext={() => setStep("api-key")} />}
          {step === "api-key" && (
            <ApiKeyStep
              secretKey={secretKey}
              environment={environment}
              onSecretKeyChange={setSecretKey}
              onEnvironmentChange={setEnvironment}
              onNext={handleValidate}
              validating={validating}
              error={error}
            />
          )}
          {step === "validate" && (
            <ValidateStep
              secretKey={secretKey}
              environment={environment}
              onConfirm={handleSave}
              validating={validating}
              error={error}
            />
          )}
          {step === "done" && <DoneStep onDone={handleDone} />}

          {/* Back navigation */}
          {canGoBack && (
            <div className="mt-4 text-center">
              <button
                onClick={handleBack}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Logomark */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-500)]/15 ring-1 ring-[var(--color-brand-500)]/30">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="var(--color-brand-400)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Welcome to Nango GUI
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            A visual interface to build, generate, and deploy Nango integrations.
            Connect your Nango account to get started.
          </p>
        </div>
      </div>
      <Button onClick={onNext} className="w-full" size="lg">
        Get Started
      </Button>
    </div>
  );
}

function ApiKeyStep({
  secretKey,
  environment,
  onSecretKeyChange,
  onEnvironmentChange,
  onNext,
  validating,
  error,
}: {
  secretKey: string;
  environment: NangoEnvironment;
  onSecretKeyChange: (v: string) => void;
  onEnvironmentChange: (v: NangoEnvironment) => void;
  onNext: () => void;
  validating: boolean;
  error: string | null;
}) {
  const [showKey, setShowKey] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (secretKey && !validating) onNext();
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Connect your Nango account
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Enter your secret key from the Nango dashboard under{" "}
          <span className="font-medium text-[var(--color-text-primary)]">
            Settings → API
          </span>
          .
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium text-[var(--color-text-primary)]"
            htmlFor="secret-key"
          >
            Secret Key
          </label>
          <div className="relative">
            <input
              id="secret-key"
              type={showKey ? "text" : "password"}
              value={secretKey}
              onChange={(e) => onSecretKeyChange(e.target.value)}
              placeholder="nango_sk_..."
              autoFocus
              className="w-full rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-raised)] px-3 py-2 pr-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)]/40"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label={showKey ? "Hide secret key" : "Show secret key"}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium text-[var(--color-text-primary)]"
            htmlFor="environment"
          >
            Environment
          </label>
          <div className="flex gap-2">
            {(["development", "production"] as NangoEnvironment[]).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => onEnvironmentChange(env)}
                className={[
                  "flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors",
                  environment === env
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-400)]"
                    : "border-[var(--color-border-base)] bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)] hover:text-[var(--color-text-primary)]",
                ].join(" ")}
              >
                {env === "development" ? "Development" : "Production"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <Button
        type="submit"
        disabled={!secretKey || validating}
        className="w-full"
        size="lg"
      >
        {validating ? "Validating…" : "Validate Key"}
      </Button>
    </form>
  );
}

function ValidateStep({
  secretKey,
  environment,
  onConfirm,
  validating,
  error,
}: {
  secretKey: string;
  environment: NangoEnvironment;
  onConfirm: () => void;
  validating: boolean;
  error: string | null;
}) {
  const maskedKey =
    secretKey.length > 8
      ? secretKey.slice(0, 8) + "•".repeat(Math.min(secretKey.length - 8, 16))
      : "•".repeat(secretKey.length);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Key validated
          </h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Review your credentials below, then save to open the dashboard.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-raised)] divide-y divide-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            Secret Key
          </span>
          <span className="font-mono text-sm text-[var(--color-text-primary)]">
            {maskedKey}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            Environment
          </span>
          <span className="text-sm font-medium capitalize text-[var(--color-text-primary)]">
            {environment}
          </span>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <Button
        onClick={onConfirm}
        disabled={validating}
        className="w-full"
        size="lg"
      >
        {validating ? "Saving…" : "Save & Open Dashboard"}
      </Button>
    </div>
  );
}

function DoneStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/15 ring-1 ring-[var(--color-success)]/30">
        <CheckCircle className="h-8 w-8 text-[var(--color-success)]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          You're all set!
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Your Nango account is connected. The app will remember your key for
          future launches.
        </p>
      </div>
      <Button onClick={onDone} className="w-full" size="lg">
        Open Dashboard
      </Button>
    </div>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2.5 text-sm text-[var(--color-error)]">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </div>
  );
}
