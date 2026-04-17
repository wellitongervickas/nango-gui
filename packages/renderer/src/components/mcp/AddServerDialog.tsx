import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Icons ─────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

// ── Env var row ───────────────────────────────────────────────────────────────

interface EnvRow {
  id: number;
  key: string;
  value: string;
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface AddServerDialogProps {
  onAdd: (name: string, command: string, args: string[], env?: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export function AddServerDialog({ onAdd, onClose }: AddServerDialogProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [argsRaw, setArgsRaw] = useState("");
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addEnvRow() {
    setEnvRows((rows) => [...rows, { id: Date.now(), key: "", value: "" }]);
  }

  function updateEnvRow(id: number, field: "key" | "value", val: string) {
    setEnvRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }

  function removeEnvRow(id: number) {
    setEnvRows((rows) => rows.filter((r) => r.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCmd = command.trim();
    if (!trimmedName) { setError("Name is required."); return; }
    if (!trimmedCmd) { setError("Command is required."); return; }

    // Parse args: split by whitespace respecting quoted strings
    const args = argsRaw.trim()
      ? argsRaw.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((a) => a.replace(/^["']|["']$/g, "")) ?? []
      : [];

    // Build env map from non-empty rows
    const envEntries = envRows.filter((r) => r.key.trim());
    const env = envEntries.length > 0
      ? Object.fromEntries(envEntries.map((r) => [r.key.trim(), r.value]))
      : undefined;

    setSubmitting(true);
    try {
      await onAdd(trimmedName, trimmedCmd, args, env);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Add MCP Server</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            {/* Name */}
            <Field label="Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-mcp-server"
                autoFocus
                className={inputCls}
              />
            </Field>

            {/* Command */}
            <Field label="Command" required hint="The executable to run (e.g. npx, node, python)">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
                className={inputCls}
              />
            </Field>

            {/* Args */}
            <Field label="Arguments" hint="Space-separated; use quotes for args with spaces">
              <input
                type="text"
                value={argsRaw}
                onChange={(e) => setArgsRaw(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-github"
                className={inputCls}
              />
            </Field>

            {/* Env vars */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">
                  Environment Variables
                </label>
                <button
                  type="button"
                  onClick={addEnvRow}
                  className="flex items-center gap-1 text-[10px] text-[var(--color-brand-500)] hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <PlusIcon /> Add
                </button>
              </div>
              {envRows.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic">No env vars — click Add to set one.</p>
              ) : (
                <div className="space-y-2">
                  {envRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => updateEnvRow(row.id, "key", e.target.value)}
                        placeholder="KEY"
                        className={cn(inputCls, "flex-1 font-mono")}
                      />
                      <span className="text-xs text-[var(--color-text-muted)]">=</span>
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => updateEnvRow(row.id, "value", e.target.value)}
                        placeholder="value"
                        className={cn(inputCls, "flex-1 font-mono")}
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvRow(row.id)}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
                <p className="text-xs text-[var(--color-error)]">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {submitting ? "Adding…" : "Add Server"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
        {label}{required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        {hint && <span className="ml-1.5 text-[10px] font-normal italic">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] transition-colors";
