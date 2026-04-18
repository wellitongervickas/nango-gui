import { useCallback, useEffect, useRef, useState } from "react";
import Nango from "@nangohq/frontend";
import type { ConnectUI, ConnectUIEvent } from "@nangohq/frontend";
import type { NangoConnectionDetail, NangoConnectionSummary, NangoSyncRecord } from "@nango-gui/shared";
import { navigate } from "@/lib/router";
import { useConnectionsStore } from "@/store/connectionsStore";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { StatusBadge } from "@/components/syncs/StatusBadge";
import {
  ChevronIcon,
  RefreshIcon,
  SpinnerIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const diff = new Date(iso).getTime() - Date.now();
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / 60_000);
    const hours = Math.floor(absDiff / 3_600_000);
    const days = Math.floor(absDiff / 86_400_000);
    if (diff < 0) {
      if (minutes < 1) return "just expired";
      if (hours < 1) return `expired ${minutes}m ago`;
      if (days < 1) return `expired ${hours}h ago`;
      return `expired ${days}d ago`;
    }
    if (minutes < 1) return "expires in < 1m";
    if (hours < 1) return `expires in ${minutes}m`;
    if (days < 1) return `expires in ${hours}h`;
    return `expires in ${days}d`;
  } catch {
    return iso!;
  }
}

function guessAuthType(detail: NangoConnectionDetail): string {
  const creds = detail.credentials as Record<string, unknown> | undefined;
  if (!creds) return "Unknown";
  if (creds.access_token) return "OAuth 2.0";
  if (creds.api_key) return "API Key";
  if (creds.username) return "Basic Auth";
  return "OAuth";
}

function getTokenExpiresAt(detail: NangoConnectionDetail): string | null {
  const creds = detail.credentials as Record<string, unknown> | undefined;
  if (!creds) return null;
  const raw = (creds.raw ?? creds) as Record<string, unknown> | undefined;
  const candidate =
    (creds.expires_at as string | undefined) ??
    (raw?.expires_at as string | undefined) ??
    (creds.expiry_date as string | undefined);
  return candidate ?? null;
}

function isTokenExpiredOrSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  try {
    return new Date(expiresAt).getTime() - Date.now() < 5 * 60_000;
  } catch {
    return false;
  }
}

// ── SectionHeader ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
      {title}
    </h2>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0 min-w-[96px]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] text-right min-w-0 flex-1">{children}</dd>
    </div>
  );
}

// ── Overview section ──────────────────────────────────────────────────────

interface OverviewSectionProps {
  connection: NangoConnectionSummary;
  detail: NangoConnectionDetail | null;
  isLoading: boolean;
  onRefreshToken: () => void;
  isRefreshing: boolean;
  onReAuthorize: () => void;
  isReAuthorizing: boolean;
}

function OverviewSection({
  connection,
  detail,
  isLoading,
  onRefreshToken,
  isRefreshing,
  onReAuthorize,
  isReAuthorizing,
}: OverviewSectionProps) {
  const expiresAt = detail ? getTokenExpiresAt(detail) : null;
  const expiredSoon = isTokenExpiredOrSoon(expiresAt);

  return (
    <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <SectionHeader title="Overview" />
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
              <div className="h-3 w-28 rounded bg-[var(--color-bg-overlay)]" />
            </div>
          ))}
        </div>
      ) : (
        <dl className="divide-y divide-[var(--color-border)]">
          <InfoRow label="Provider">
            <span className="font-medium">{connection.provider || connection.provider_config_key}</span>
          </InfoRow>
          <InfoRow label="Integration">
            <span className="font-mono text-xs">{connection.provider_config_key}</span>
          </InfoRow>
          <InfoRow label="Auth type">
            {detail ? guessAuthType(detail) : "—"}
          </InfoRow>
          <InfoRow label="Created">
            {formatDate(connection.created)}
          </InfoRow>
          {detail?.updated_at && (
            <InfoRow label="Last updated">
              {formatDate(detail.updated_at)}
            </InfoRow>
          )}
          {expiresAt && (
            <InfoRow label="Token expires">
              <span className={cn("font-mono text-xs", expiredSoon ? "text-[var(--color-warning)]" : "")}>
                {formatRelativeTime(expiresAt)}
              </span>
            </InfoRow>
          )}
        </dl>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
        {expiresAt && (
          <button
            onClick={onRefreshToken}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isRefreshing ? <SpinnerIcon /> : <RefreshIcon />}
            Refresh now
          </button>
        )}
        <button
          onClick={onReAuthorize}
          disabled={isReAuthorizing || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
        >
          {isReAuthorizing && <SpinnerIcon />}
          Re-authorize
        </button>
      </div>
    </section>
  );
}

// ── Syncs section ─────────────────────────────────────────────────────────

function SyncMiniRow({
  sync,
  providerConfigKey,
  connectionId,
}: {
  sync: NangoSyncRecord;
  providerConfigKey: string;
  connectionId: string;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrigger(e: React.MouseEvent) {
    e.stopPropagation();
    if (isBusy || !window.nango) return;
    setError(null);
    setIsBusy(true);
    try {
      const res = await window.nango.triggerSync({ providerConfigKey, syncs: [sync.name], connectionId });
      if (res.status === "error") throw new Error(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTogglePause(e: React.MouseEvent) {
    e.stopPropagation();
    if (isBusy || !window.nango) return;
    setError(null);
    setIsBusy(true);
    try {
      if (sync.status === "PAUSED") {
        const res = await window.nango.startSync({ providerConfigKey, syncs: [sync.name], connectionId });
        if (res.status === "error") throw new Error(res.error);
      } else {
        const res = await window.nango.pauseSync({ providerConfigKey, syncs: [sync.name], connectionId });
        if (res.status === "error") throw new Error(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] last:border-0 group hover:bg-[var(--color-bg-overlay)]/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium font-mono text-[var(--color-text-primary)] truncate">{sync.name}</p>
        {sync.status === "ERROR" && sync.latestResult && (
          <p className="text-xs text-[var(--color-error)] mt-0.5">Last run had errors</p>
        )}
        {error && (
          <p className="text-xs text-[var(--color-error)] mt-0.5">{error}</p>
        )}
      </div>
      <div className="w-20 shrink-0">
        <StatusBadge status={sync.status} />
      </div>
      <div className="w-20 text-xs text-[var(--color-text-secondary)] shrink-0 whitespace-nowrap">
        {sync.frequency ?? "—"}
      </div>
      <div className="w-32 text-xs text-[var(--color-text-secondary)] shrink-0 whitespace-nowrap">
        {formatDate(sync.finishedAt)}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={handleTrigger}
          disabled={isBusy}
          title="Trigger sync"
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/10 transition-all cursor-pointer disabled:opacity-50"
        >
          {isBusy ? <SpinnerIcon /> : <PlayIcon />}
        </button>
        <button
          onClick={handleTogglePause}
          disabled={isBusy || sync.status === "STOPPED"}
          title={sync.status === "PAUSED" ? "Resume" : "Pause"}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded transition-all cursor-pointer disabled:opacity-50",
            sync.status === "PAUSED"
              ? "text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
              : "text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
          )}
        >
          {sync.status === "PAUSED" ? <PlayIcon /> : <PauseIcon />}
        </button>
      </div>
    </div>
  );
}

interface SyncsSectionProps {
  syncs: NangoSyncRecord[];
  isLoading: boolean;
  error: string | null;
  providerConfigKey: string;
  connectionId: string;
}

function SyncsSection({ syncs, isLoading, error, providerConfigKey, connectionId }: SyncsSectionProps) {
  return (
    <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)]">
        <SectionHeader title={`Syncs ${!isLoading && syncs.length > 0 ? `(${syncs.length})` : ""}`} />
      </div>

      {isLoading && (
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 flex-1 rounded bg-[var(--color-bg-overlay)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-bg-overlay)]" />
              <div className="h-4 w-20 rounded bg-[var(--color-bg-overlay)]" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && <ErrorBanner message={error} className="m-4" />}

      {!isLoading && !error && syncs.length === 0 && (
        <div className="flex items-center justify-center py-10 text-sm text-[var(--color-text-secondary)]">
          No syncs configured for this connection
        </div>
      )}

      {!isLoading && syncs.length > 0 && (
        <>
          <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-bg-overlay)]/40 text-xs font-medium text-[var(--color-text-secondary)]">
            <div className="flex-1">Name</div>
            <div className="w-20 shrink-0">Status</div>
            <div className="w-20 shrink-0">Frequency</div>
            <div className="w-32 shrink-0">Last run</div>
            <div className="w-14 shrink-0" />
          </div>
          {syncs.map((sync) => (
            <SyncMiniRow
              key={sync.id}
              sync={sync}
              providerConfigKey={providerConfigKey}
              connectionId={connectionId}
            />
          ))}
        </>
      )}
    </section>
  );
}

// ── Metadata section ──────────────────────────────────────────────────────

interface MetadataSectionProps {
  metadata: Record<string, unknown> | null;
  onSave: (metadata: Record<string, unknown>) => Promise<void>;
}

function MetadataSection({ metadata, onSave }: MetadataSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleEdit() {
    setDraft(JSON.stringify(metadata ?? {}, null, 2));
    setJsonError(null);
    setSaveError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setDraft("");
    setJsonError(null);
    setSaveError(null);
  }

  function handleChange(value: string) {
    setDraft(value);
    // Validate JSON on the fly
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  async function handleSave() {
    if (jsonError) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft) as Record<string, unknown>;
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(parsed);
      setIsEditing(false);
      setDraft("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  return (
    <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Metadata" />
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="text-xs px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            rows={8}
            spellCheck={false}
            className={cn(
              "w-full text-xs font-mono bg-[var(--color-bg-base)] border rounded-lg p-3 text-[var(--color-text-primary)] resize-y outline-none transition-colors",
              jsonError
                ? "border-[var(--color-error)] focus:border-[var(--color-error)]"
                : "border-[var(--color-border)] focus:border-[var(--color-brand-500)]"
            )}
          />
          {jsonError && (
            <p className="text-xs text-[var(--color-error)]">{jsonError}</p>
          )}
          {saveError && (
            <p className="text-xs text-[var(--color-error)]">{saveError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !!jsonError}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {isSaving && <SpinnerIcon />}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-4 overflow-auto max-h-48 text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(metadata ?? {}, null, 2)}
        </pre>
      )}
    </section>
  );
}

// ── Danger Zone section ───────────────────────────────────────────────────

interface DangerZoneSectionProps {
  connectionId: string;
  onDelete: () => void;
  isDeleting: boolean;
}

function DangerZoneSection({ connectionId, onDelete, isDeleting }: DangerZoneSectionProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleBeginDelete() {
    setStep(2);
    setInputValue("");
    setError(null);
  }

  function handleCancel() {
    setStep(1);
    setInputValue("");
    setError(null);
  }

  async function handleConfirmDelete() {
    if (inputValue !== connectionId) {
      setError(`Type the exact connection ID: "${connectionId}"`);
      return;
    }
    onDelete();
  }

  const canConfirm = inputValue === connectionId;

  return (
    <section className="border border-[var(--color-error)]/30 rounded-xl p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-error)] mb-3">
        Danger Zone
      </h2>

      {step === 1 ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Delete this connection</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Permanently removes all credentials and synced data. This cannot be undone.
            </p>
          </div>
          <button
            onClick={handleBeginDelete}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer shrink-0"
          >
            <TrashIcon />
            Delete connection
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            To confirm, type{" "}
            <span className="font-mono bg-[var(--color-bg-overlay)] px-1 py-0.5 rounded text-xs">
              {connectionId}
            </span>{" "}
            below:
          </p>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setError(null); }}
            placeholder={connectionId}
            autoFocus
            className="w-full text-sm font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-error)]"
          />
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting || !canConfirm}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <SpinnerIcon />}
              <TrashIcon />
              Delete connection
            </button>
            <button
              onClick={handleCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Timeline section ──────────────────────────────────────────────────��───

type TimelineEventKind = "created" | "sync_run" | "token_refresh" | "error" | "manual_trigger" | "webhook";

interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  timestamp: string;
  label: string;
  detail?: string;
}

const KIND_STYLES: Record<TimelineEventKind, { dot: string; text: string }> = {
  created:        { dot: "bg-[var(--color-brand-500)]",  text: "text-[var(--color-brand-500)]" },
  sync_run:       { dot: "bg-[var(--color-success)]",    text: "text-[var(--color-success)]" },
  token_refresh:  { dot: "bg-[var(--color-info)]",       text: "text-[var(--color-info)]" },
  manual_trigger: { dot: "bg-[var(--color-warning)]",    text: "text-[var(--color-warning)]" },
  error:          { dot: "bg-[var(--color-error)]",      text: "text-[var(--color-error)]" },
  webhook:        { dot: "bg-[var(--color-text-secondary)]", text: "text-[var(--color-text-secondary)]" },
};

function buildTimeline(
  connection: NangoConnectionSummary,
  syncs: NangoSyncRecord[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Connection created
  events.push({
    id: "created",
    kind: "created",
    timestamp: connection.created,
    label: "Connection created",
    detail: connection.provider_config_key,
  });

  // Sync last run events
  for (const sync of syncs) {
    if (sync.finishedAt) {
      events.push({
        id: `sync-${sync.id}`,
        kind: sync.status === "ERROR" ? "error" : "sync_run",
        timestamp: sync.finishedAt,
        label: sync.status === "ERROR" ? `Sync error: ${sync.name}` : `Sync completed: ${sync.name}`,
        detail: sync.latestResult
          ? `+${sync.latestResult.added} ~${sync.latestResult.updated} -${sync.latestResult.deleted}`
          : undefined,
      });
    }
  }

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => {
    try {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } catch {
      return 0;
    }
  });

  // Keep only events from the last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return events.filter((e) => {
    try {
      return new Date(e.timestamp).getTime() >= cutoff;
    } catch {
      return true;
    }
  });
}

interface TimelineSectionProps {
  connection: NangoConnectionSummary;
  syncs: NangoSyncRecord[];
}

function TimelineSection({ connection, syncs }: TimelineSectionProps) {
  const events = buildTimeline(connection, syncs);

  return (
    <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <SectionHeader title="Connection Timeline" />
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        Events for this connection over the last 30 days
      </p>

      {events.length === 0 ? (
        <div className="text-sm text-[var(--color-text-secondary)] text-center py-6">
          No timeline events in the last 30 days
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border)]" />
          <ul className="space-y-4">
            {events.map((event) => {
              const style = KIND_STYLES[event.kind];
              return (
                <li key={event.id} className="flex gap-3 relative pl-4">
                  <span className={cn("absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-bg-surface)]", style.dot)} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={cn("text-xs font-medium", style.text)}>
                      {event.label}
                    </p>
                    {event.detail && (
                      <p className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">{event.detail}</p>
                    )}
                    <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">
                      {formatDate(event.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Main ConnectionDetailPage ──────────────────────────────────────────────

interface ConnectionDetailPageProps {
  providerConfigKey: string;
  connectionId: string;
}

export function ConnectionDetailPage({ providerConfigKey, connectionId }: ConnectionDetailPageProps) {
  const { connections, fetchConnections, deleteConnection } = useConnectionsStore();
  const [detail, setDetail] = useState<NangoConnectionDetail | null>(null);
  const [syncs, setSyncs] = useState<NangoSyncRecord[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(true);
  const [isSyncsLoading, setIsSyncsLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [syncsError, setSyncsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReAuthorizing, setIsReAuthorizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const connectUIRef = useRef<ConnectUI | null>(null);

  // Find connection summary from store (or wait for it)
  const connection = connections.find(
    (c) => c.provider_config_key === providerConfigKey && c.connection_id === connectionId
  ) ?? null;

  // Fetch connections if store is empty
  useEffect(() => {
    if (connections.length === 0) {
      fetchConnections();
    }
  }, [connections.length, fetchConnections]);

  // Fetch connection detail
  const loadDetail = useCallback(async (forceRefresh = false) => {
    if (!window.nango) return;
    if (!forceRefresh) setIsDetailLoading(true);
    setDetailError(null);
    try {
      const res = await window.nango.getConnection({ providerConfigKey, connectionId, forceRefresh });
      if (res.status === "error") {
        setDetailError(res.error);
      } else {
        setDetail(res.data);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load connection details");
    } finally {
      setIsDetailLoading(false);
    }
  }, [providerConfigKey, connectionId]);

  // Fetch syncs
  const loadSyncs = useCallback(async () => {
    if (!window.nango) return;
    setIsSyncsLoading(true);
    setSyncsError(null);
    try {
      const res = await window.nango.listSyncs({ providerConfigKey, connectionId });
      if (res.status === "error") {
        setSyncsError(res.error);
      } else {
        setSyncs(res.data);
      }
    } catch (err) {
      setSyncsError(err instanceof Error ? err.message : "Failed to load syncs");
    } finally {
      setIsSyncsLoading(false);
    }
  }, [providerConfigKey, connectionId]);

  useEffect(() => {
    loadDetail();
    loadSyncs();
  }, [loadDetail, loadSyncs]);

  // Cleanup Connect UI on unmount
  useEffect(() => {
    return () => {
      connectUIRef.current?.close();
    };
  }, []);

  // Refresh token
  async function handleRefreshToken() {
    setIsRefreshing(true);
    try {
      await loadDetail(true);
    } finally {
      setIsRefreshing(false);
    }
  }

  // Re-authorize via reconnect session
  async function handleReAuthorize() {
    if (!window.nango) return;
    setIsReAuthorizing(true);
    try {
      const res = await window.nango.createReconnectSession({
        providerConfigKey,
        connectionId,
        endUserId: "local-user",
        endUserDisplayName: "Local User",
      });
      if (res.status === "error") {
        // Fall back to standard connect session restricted to this integration
        const fallbackRes = await window.nango.createConnectSession({
          endUserId: "local-user",
          endUserDisplayName: "Local User",
          allowedIntegrations: [providerConfigKey],
        });
        if (fallbackRes.status === "error") {
          setDetailError(fallbackRes.error);
          return;
        }
        const nango = new Nango({ connectSessionToken: fallbackRes.data.token });
        const ui = nango.openConnectUI({ onEvent: handleConnectUIEvent });
        connectUIRef.current = ui;
        ui.open();
        return;
      }
      const nango = new Nango({ connectSessionToken: res.data.token });
      const ui = nango.openConnectUI({ onEvent: handleConnectUIEvent });
      connectUIRef.current = ui;
      ui.open();
    } catch {
      // Final fallback: standard connect session
      try {
        const fallbackRes = await window.nango.createConnectSession({
          endUserId: "local-user",
          endUserDisplayName: "Local User",
          allowedIntegrations: [providerConfigKey],
        });
        if (fallbackRes.status === "error") {
          setDetailError(fallbackRes.error);
          return;
        }
        const nango = new Nango({ connectSessionToken: fallbackRes.data.token });
        const ui = nango.openConnectUI({ onEvent: handleConnectUIEvent });
        connectUIRef.current = ui;
        ui.open();
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Failed to open re-auth dialog");
      }
    } finally {
      setIsReAuthorizing(false);
    }
  }

  function handleConnectUIEvent(event: ConnectUIEvent) {
    if (event.type === "close" || event.type === "connect") {
      connectUIRef.current?.close();
      connectUIRef.current = null;
      if (event.type === "connect") {
        // Refresh detail after re-auth
        loadDetail(true);
      }
    }
  }

  // Save metadata
  async function handleSaveMetadata(newMetadata: Record<string, unknown>) {
    if (!window.nango) throw new Error("Nango API not available");
    const res = await window.nango.setMetadata({ providerConfigKey, connectionId, metadata: newMetadata });
    if (res.status === "error") throw new Error(res.error);
    // Update local state
    setDetail((prev) => prev ? { ...prev, metadata: newMetadata } : prev);
    await fetchConnections();
  }

  // Delete connection
  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteConnection(providerConfigKey, connectionId);
      navigate("connections");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
      setIsDeleting(false);
    }
  }

  // Current metadata: prefer from detail (fresher), fall back to connection summary
  const currentMetadata = detail?.metadata ?? connection?.metadata ?? null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("connections")}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          <ChevronIcon direction="left" />
          Connections
        </button>
        <span className="text-[var(--color-border)]">/</span>
        <span className="text-xs font-mono text-[var(--color-text-primary)] truncate max-w-xs">
          {connectionId}
        </span>
        <div className="flex-1" />
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)] font-medium">
          active
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-6 space-y-6 max-w-3xl w-full mx-auto">
        {/* Page title */}
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] font-mono">{connectionId}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{providerConfigKey}</p>
        </div>

        {/* Global errors */}
        {detailError && <ErrorBanner message={detailError} />}
        {deleteError && <ErrorBanner message={deleteError} />}

        {/* Overview */}
        {connection && (
          <OverviewSection
            connection={connection}
            detail={detail}
            isLoading={isDetailLoading}
            onRefreshToken={handleRefreshToken}
            isRefreshing={isRefreshing}
            onReAuthorize={handleReAuthorize}
            isReAuthorizing={isReAuthorizing}
          />
        )}

        {/* Syncs */}
        <SyncsSection
          syncs={syncs}
          isLoading={isSyncsLoading}
          error={syncsError}
          providerConfigKey={providerConfigKey}
          connectionId={connectionId}
        />

        {/* Metadata */}
        <MetadataSection
          metadata={currentMetadata}
          onSave={handleSaveMetadata}
        />

        {/* Timeline */}
        {connection && (
          <TimelineSection
            connection={connection}
            syncs={syncs}
          />
        )}

        {/* Danger Zone */}
        <DangerZoneSection
          connectionId={connectionId}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
