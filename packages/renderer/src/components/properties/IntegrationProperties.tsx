import { useProjectStore } from "../../store/projectStore";
import { inputBaseClass } from "../../lib/utils";
import type {
  NangoAuthType,
  NangoEnvironment,
  NangoErrorHandling,
} from "../../types/flow";

const AUTH_TYPES: { value: NangoAuthType; label: string }[] = [
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "api_key", label: "API Key" },
  { value: "basic", label: "Basic Auth" },
  { value: "none", label: "None" },
];

const ENVIRONMENTS: { value: NangoEnvironment; label: string }[] = [
  { value: "development", label: "Development" },
  { value: "production", label: "Production" },
];

const RETRY_OPTIONS: { value: NangoErrorHandling["retryOn"][number]; label: string }[] = [
  { value: "5xx", label: "Server errors (5xx)" },
  { value: "4xx", label: "Client errors (4xx)" },
  { value: "timeout", label: "Timeouts" },
  { value: "network", label: "Network failures" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}


export function IntegrationProperties() {
  const project = useProjectStore((s) => s.project);
  const updateProject = useProjectStore((s) => s.updateProject);

  const toggleRetry = (option: NangoErrorHandling["retryOn"][number]) => {
    const current = project.errorHandling.retryOn;
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    updateProject({ errorHandling: { ...project.errorHandling, retryOn: next } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
        <span className="text-sm font-semibold text-[var(--color-primary)]">
          Integration
        </span>
      </div>

      <Field label="Name">
        <input
          className={inputBaseClass}
          value={project.name}
          onChange={(e) => updateProject({ name: e.target.value })}
          placeholder="My Integration"
        />
      </Field>

      <Field label="Provider">
        <input
          className={inputBaseClass}
          value={project.provider}
          onChange={(e) => updateProject({ provider: e.target.value })}
          placeholder="e.g. github, slack, salesforce"
        />
      </Field>

      <Field label="Auth Type">
        <select
          className={inputBaseClass}
          value={project.authType}
          onChange={(e) =>
            updateProject({ authType: e.target.value as NangoAuthType })
          }
        >
          {AUTH_TYPES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Environment">
        <select
          className={inputBaseClass}
          value={project.environment}
          onChange={(e) =>
            updateProject({
              environment: e.target.value as NangoEnvironment,
            })
          }
        >
          {ENVIRONMENTS.map((env) => (
            <option key={env.value} value={env.value}>
              {env.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="pt-2 border-t border-[var(--color-border)]">
        <Field label="Error Handling">
          <div className="space-y-2 mt-1">
            <div className="space-y-1.5">
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Retry on:
              </span>
              {RETRY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-xs text-[var(--color-text)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={project.errorHandling.retryOn.includes(opt.value)}
                    onChange={() => toggleRetry(opt.value)}
                    className="accent-[var(--color-primary)]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <Field label="Max Retries">
              <input
                type="number"
                className={inputBaseClass}
                min={0}
                max={10}
                value={project.errorHandling.maxRetries}
                onChange={(e) =>
                  updateProject({
                    errorHandling: {
                      ...project.errorHandling,
                      maxRetries: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
          </div>
        </Field>
      </div>

      {project.filePath && (
        <div className="pt-2 border-t border-[var(--color-border)]">
          <p className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">
            {project.filePath}
          </p>
        </div>
      )}
    </div>
  );
}
