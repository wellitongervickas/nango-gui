import { useEffect, useMemo, useState } from "react";
import type {
  NangoIntegration,
  NangoIntegrationCredentialsInput,
  NangoOAuthIntegrationCredentials,
} from "@nango-gui/shared";
import { useIntegrationsStore } from "@/store/integrationsStore";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GridIcon,
  PencilIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

// ── Provider logo ──────────────────────────────────────────────────────────

function ProviderLogo({
  logo,
  fallback,
  size = 56,
}: {
  logo: string;
  fallback: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!logo || failed) {
    return (
      <div
        className="rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)] uppercase shrink-0"
        style={{ width: size, height: size }}
      >
        {(fallback[0] ?? "?").toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={fallback}
      width={size}
      height={size}
      className="rounded-lg object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ── Detail row ─────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd
        className={cn(
          "text-sm text-[var(--color-text-primary)] text-right truncate",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ── Reveal field (masked client ID with toggle + copy) ────────────────────

function maskClientId(value: string | null): string {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return "••••••••" + value.slice(-4);
}

function RevealField({ value }: { value: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-sm text-[var(--color-text-secondary)]">—</span>;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-[var(--color-text-primary)] truncate max-w-[280px]">
        {revealed ? value : maskClientId(value)}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
        aria-label={revealed ? "Hide client ID" : "Reveal client ID"}
        title={revealed ? "Hide" : "Reveal"}
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
        aria-label="Copy client ID"
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

// ── Edit form ──────────────────────────────────────────────────────────────

interface EditFormProps {
  integration: NangoIntegration;
  onCancel: () => void;
  onSaved: (next: NangoIntegration) => void;
}

function EditForm({ integration, onCancel, onSaved }: EditFormProps) {
  const updateIntegration = useIntegrationsStore((s) => s.updateIntegration);
  const oauthCreds =
    integration.credentials && "client_id" in integration.credentials
      ? (integration.credentials as NangoOAuthIntegrationCredentials)
      : null;
  const isOAuth = !!oauthCreds;

  const [displayName, setDisplayName] = useState(integration.display_name);
  const [uniqueKey, setUniqueKey] = useState(integration.unique_key);
  const [forwardWebhooks, setForwardWebhooks] = useState(
    integration.forward_webhooks,
  );
  const [clientId, setClientId] = useState(oauthCreds?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [scopes, setScopes] = useState(oauthCreds?.scopes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    let credentials: NangoIntegrationCredentialsInput | undefined;
    if (isOAuth && (clientId || clientSecret || scopes)) {
      // Only send credentials when at least one OAuth field is touched.
      // The Nango API requires both client_id and client_secret together.
      if (!clientId || !clientSecret) {
        setError("Client ID and Client Secret are both required to update credentials.");
        setSaving(false);
        return;
      }
      credentials = {
        type: oauthCreds!.type,
        client_id: clientId,
        client_secret: clientSecret,
        ...(scopes ? { scopes } : {}),
      };
    }

    const next = await updateIntegration({
      uniqueKey: integration.unique_key,
      ...(uniqueKey !== integration.unique_key ? { unique_key: uniqueKey } : {}),
      ...(displayName !== integration.display_name
        ? { display_name: displayName }
        : {}),
      ...(forwardWebhooks !== integration.forward_webhooks
        ? { forward_webhooks: forwardWebhooks }
        : {}),
      ...(credentials ? { credentials } : {}),
    });

    setSaving(false);

    if (next) {
      onSaved(next);
    } else {
      setError("Failed to save changes. Check your input and try again.");
    }
  }

  const inputClass =
    "w-full px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand-500)]";

  return (
    <form
      onSubmit={handleSave}
      className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Edit integration
      </h2>

      <label className="block space-y-1">
        <span className="text-xs text-[var(--color-text-secondary)]">Display name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-[var(--color-text-secondary)]">Unique key</span>
        <input
          type="text"
          value={uniqueKey}
          onChange={(e) => setUniqueKey(e.target.value)}
          className={cn(inputClass, "font-mono text-xs")}
          required
        />
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          Renaming changes the provider config key — existing connections will
          continue to reference the new key.
        </span>
      </label>

      {isOAuth && (
        <>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--color-text-secondary)]">OAuth Client ID</span>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={cn(inputClass, "font-mono text-xs")}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--color-text-secondary)]">
              OAuth Client Secret
              <span className="ml-1 text-[var(--color-text-secondary)]">
                (leave blank to keep existing)
              </span>
            </span>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className={cn(inputClass, "font-mono text-xs")}
              autoComplete="off"
              placeholder="••••••••"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--color-text-secondary)]">Scopes</span>
            <input
              type="text"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              className={cn(inputClass, "font-mono text-xs")}
              placeholder="space separated, e.g. read:user repo"
            />
          </label>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
        <input
          type="checkbox"
          checked={forwardWebhooks}
          onChange={(e) => setForwardWebhooks(e.target.checked)}
          className="rounded border-[var(--color-border)]"
        />
        Forward provider webhooks to this integration
      </label>

      {error && (
        <p className="text-xs text-[var(--color-danger-500,#ef4444)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {saving && <SpinnerIcon />}
          Save changes
        </button>
      </div>
    </form>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────

interface DeleteModalProps {
  integration: NangoIntegration;
  connectionCount: number;
  onCancel: () => void;
  onDeleted: () => void;
}

function DeleteModal({
  integration,
  connectionCount,
  onCancel,
  onDeleted,
}: DeleteModalProps) {
  const deleteIntegration = useIntegrationsStore((s) => s.deleteIntegration);
  const requiresTypedConfirm = connectionCount > 0;
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = !requiresTypedConfirm || typed === "Delete";

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    const ok = await deleteIntegration(integration.unique_key);
    setDeleting(false);
    if (ok) {
      onDeleted();
    } else {
      setError("Failed to delete the integration.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5 w-full max-w-md shadow-xl"
      >
        <h2
          id="delete-dialog-title"
          className="text-base font-semibold text-[var(--color-text-primary)] mb-2"
        >
          Delete &quot;{integration.display_name}&quot;?
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {requiresTypedConfirm ? (
            <>
              This integration has{" "}
              <strong className="text-[var(--color-text-primary)]">
                {connectionCount} active connection{connectionCount === 1 ? "" : "s"}
              </strong>
              . Deleting it will revoke access for all linked connections. This
              action cannot be undone.
            </>
          ) : (
            <>
              This integration has no active connections. Deleting it removes its
              configuration from your Nango account.
            </>
          )}
        </p>

        {requiresTypedConfirm && (
          <label className="block space-y-1 mb-4">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Type <span className="font-mono">Delete</span> to confirm
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-500)] font-mono"
            />
          </label>
        )}

        {error && (
          <p className="text-xs text-[var(--color-danger-500,#ef4444)] mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-danger-500,#ef4444)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && <SpinnerIcon />}
            <TrashIcon />
            Delete integration
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface IntegrationDetailPageProps {
  /** The integration's unique key (provider config key). */
  providerKey: string;
}

export function IntegrationDetailPage({ providerKey }: IntegrationDetailPageProps) {
  const { integrations, fetchIntegrations, getIntegration } = useIntegrationsStore();
  const summary = useMemo(
    () => integrations.find((i) => i.unique_key === providerKey) ?? null,
    [integrations, providerKey],
  );

  const [integration, setIntegration] = useState<NangoIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Ensure list is populated for the connection count + breadcrumb.
  useEffect(() => {
    if (integrations.length === 0) {
      void fetchIntegrations();
    }
  }, [integrations.length, fetchIntegrations]);

  // Fetch full integration detail (with credentials + webhook).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getIntegration(providerKey).then((data) => {
      if (!cancelled) {
        setIntegration(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [providerKey, getIntegration]);

  if (loading && !integration) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
        <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
          <Breadcrumbs
            items={[
              { label: "Integrations", route: "integrations" },
              { label: "Loading..." },
            ]}
          />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <SpinnerIcon />
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
        <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
          <Breadcrumbs
            items={[
              { label: "Integrations", route: "integrations" },
              { label: providerKey },
            ]}
          />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
            <GridIcon />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Integration &quot;{providerKey}&quot; not found.
          </p>
        </div>
      </div>
    );
  }

  const oauthCreds =
    integration.credentials && "client_id" in integration.credentials
      ? (integration.credentials as NangoOAuthIntegrationCredentials)
      : null;
  const connectionCount = summary?.connectionCount ?? 0;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] overflow-y-auto">
      <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
        <Breadcrumbs
          items={[
            { label: "Integrations", route: "integrations" },
            { label: integration.display_name },
          ]}
        />
      </div>

      <div className="flex-1 px-6 py-6 max-w-3xl w-full mx-auto space-y-6">
        {/* Title + actions */}
        <div className="flex items-start gap-4">
          <ProviderLogo
            logo={integration.logo}
            fallback={integration.display_name}
            size={56}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              {integration.display_name}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] font-mono mt-0.5">
              {integration.unique_key}
            </p>
          </div>
          {!editing && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
              >
                <PencilIcon />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-danger-500,#ef4444)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
              >
                <TrashIcon />
                Delete
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <EditForm
            integration={integration}
            onCancel={() => setEditing(false)}
            onSaved={(next) => {
              setIntegration(next);
              setEditing(false);
              void fetchIntegrations();
            }}
          />
        ) : (
          <>
            {/* Details */}
            <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                Details
              </h2>
              <dl>
                <DetailRow label="Provider" value={integration.provider} mono />
                <DetailRow label="Unique key" value={integration.unique_key} mono />
                <DetailRow
                  label="Created"
                  value={
                    integration.created_at
                      ? new Date(integration.created_at).toLocaleString()
                      : "—"
                  }
                />
                <DetailRow
                  label="Updated"
                  value={
                    integration.updated_at
                      ? new Date(integration.updated_at).toLocaleString()
                      : "—"
                  }
                />
                <DetailRow
                  label="Active connections"
                  value={String(connectionCount)}
                />
                <DetailRow
                  label="Forward webhooks"
                  value={integration.forward_webhooks ? "Yes" : "No"}
                />
              </dl>
            </section>

            {/* OAuth credentials */}
            {oauthCreds && (
              <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                  OAuth credentials
                </h2>
                <dl>
                  <DetailRow label="Auth type" value={oauthCreds.type} mono />
                  <DetailRow
                    label="Client ID"
                    value={<RevealField value={oauthCreds.client_id} />}
                  />
                  <DetailRow
                    label="Client secret"
                    value={
                      oauthCreds.client_secret ? (
                        <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                          ••••••••
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                      )
                    }
                  />
                  <DetailRow
                    label="Scopes"
                    value={
                      oauthCreds.scopes ? (
                        <span className="font-mono text-xs text-[var(--color-text-primary)] text-right break-all">
                          {oauthCreds.scopes}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                      )
                    }
                  />
                </dl>
              </section>
            )}

            {/* Webhook URL */}
            <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                Webhook URL
              </h2>
              {integration.webhook_url ? (
                <p className="font-mono text-xs text-[var(--color-text-primary)] break-all">
                  {integration.webhook_url}
                </p>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Nango has not assigned an incoming webhook URL for this integration yet.
                </p>
              )}
            </section>

            {/* Provider config (full integration object for power users) */}
            <details className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <summary className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] cursor-pointer">
                Provider config (raw)
              </summary>
              <pre className="mt-3 text-[11px] font-mono text-[var(--color-text-primary)] overflow-x-auto bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md p-3">
                {JSON.stringify(integration, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>

      {showDelete && (
        <DeleteModal
          integration={integration}
          connectionCount={connectionCount}
          onCancel={() => setShowDelete(false)}
          onDeleted={() => {
            setShowDelete(false);
            navigate("integrations");
          }}
        />
      )}
    </div>
  );
}
