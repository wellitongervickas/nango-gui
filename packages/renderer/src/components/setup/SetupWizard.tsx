import { useState } from "react";
import type { NangoEnvironment } from "@nango-gui/shared";

type Step = "welcome" | "api-key" | "validate" | "done";

export function SetupWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [secretKey, setSecretKey] = useState("");
  const [environment, setEnvironment] = useState<NangoEnvironment>("development");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
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
    // Reload so main process can pick up stored credentials and show dashboard
    window.location.hash = "/";
    window.location.reload();
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
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
            onConfirm={handleSave}
            validating={validating}
            error={error}
          />
        )}
        {step === "done" && <DoneStep onDone={handleDone} />}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome to Nango GUI</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A visual interface to build, generate, and deploy Nango integrations.
          Connect your Nango account to get started.
        </p>
      </div>
      <button
        onClick={onNext}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Get Started
      </button>
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
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Connect your Nango account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your Nango secret key. You can find it in the Nango dashboard
          under Settings → API.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="secret-key">
            Secret Key
          </label>
          <input
            id="secret-key"
            type="password"
            value={secretKey}
            onChange={(e) => onSecretKeyChange(e.target.value)}
            placeholder="nango_sk_..."
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="environment">
            Environment
          </label>
          <select
            id="environment"
            value={environment}
            onChange={(e) =>
              onEnvironmentChange(e.target.value as NangoEnvironment)
            }
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="development">Development</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!secretKey || validating}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {validating ? "Validating…" : "Validate Key"}
      </button>
    </div>
  );
}

function ValidateStep({
  onConfirm,
  validating,
  error,
}: {
  onConfirm: () => void;
  validating: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Key validated</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your API key is valid. Click below to save it securely and open the
          dashboard.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={validating}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {validating ? "Saving…" : "Save & Continue"}
      </button>
    </div>
  );
}

function DoneStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">You're all set!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Nango account is connected. The app will remember your key for
          future launches.
        </p>
      </div>
      <button
        onClick={onDone}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Open Dashboard
      </button>
    </div>
  );
}
