import { useEffect, useMemo, useState } from "react";
import type { NangoConnectionDetail, NangoConnectionSummary, ConnectionHealthStatus, McpToolEntry, McpIntegrationSummary } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useCredentialHealthStore } from "@/store/credentialHealthStore";
import { useMcpIntegrations } from "@/hooks/useMcpIntegrations";
import { useIntegrationMcpTools } from "@/hooks/useIntegrationMcpTools";
import { ConnectModal } from "@/components/connections/ConnectModal";
import { cn, searchInputClass } from "@/lib/utils";
import { SearchIcon, ChevronIcon, XIcon, TrashIcon, RefreshIcon, PlugIcon, SpinnerIcon, ShieldCheckIcon, ShieldAlertIcon, ShieldQuestionIcon, CopyIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/common/ErrorBanner";

// ── Types ──────────────────────────────────────────────────────────────────

type SortKey = "provider" | "connection_id" | "created";
type SortDir = "asc" | "desc";

// ── Skeleton ───────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
      <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-[var(--color-bg-overlay)]" />
        <div className="h-3 w-24 rounded bg-[var(--color-bg-overlay)]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
    </div>
  );
}

// ── Delete confirmation ────────────────────────────────────────────────────

interface DeleteDialogProps {
  connection: NangoConnectionSummary;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteDialog({ connection, onConfirm, onCancel, isDeleting }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Delete connection?
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          This will permanently delete the connection{" "}
          <span className="font-mono text-[var(--color-text-primary)]">
            {connection.connection_id}
          </span>{" "}
          for <span className="font-medium text-[var(--color-text-primary)]">{connection.provider_config_key}</span>.
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && <SpinnerIcon />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credential Health Badge ────────────────────────────────────────────────

const HEALTH_CONFIG: Record<ConnectionHealthStatus, { label: string; colorClass: string; Icon: () => React.JSX.Element }> = {
  valid: { label: "Valid", colorClass: "bg-[var(--color-success)]/15 text-[var(--color-success)]", Icon: ShieldCheckIcon },
  invalid: { label: "Invalid", colorClass: "bg-[var(--color-error)]/15 text-[var(--color-error)]", Icon: ShieldAlertIcon },
  unchecked: { label: "Unchecked", colorClass: "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]", Icon: ShieldQuestionIcon },
};

function CredentialHealthBadge({ status }: { status: ConnectionHealthStatus }) {
  const { label, colorClass, Icon } = HEALTH_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", colorClass)}>
      <Icon />
      {label}
    </span>
  );
}

// ── Credential Health Section (detail panel) ──────────────────────────────

function CredentialHealthSection({
  providerConfigKey,
  connectionId,
}: {
  providerConfigKey: string;
  connectionId: string;
}) {
  const { validate, getEntry, validating } = useCredentialHealthStore();
  const entry = getEntry(providerConfigKey, connectionId);
  const isValidating = validating.has(`${providerConfigKey}:${connectionId}`);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!entry) {
      validate(providerConfigKey, connectionId);
    }
  }, [providerConfigKey, connectionId, entry, validate]);

  const status = entry?.status ?? "unchecked";

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
        Credential Health
      </h3>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => entry?.output && setExpanded((e) => !e)}
            className={cn(
              "flex items-center gap-1.5",
              entry?.output ? "cursor-pointer" : "cursor-default"
            )}
          >
            <CredentialHealthBadge status={status} />
            {entry?.output && (
              <ChevronIcon direction={expanded ? "up" : "down"} />
            )}
          </button>
          <button
            onClick={() => validate(providerConfigKey, connectionId)}
            disabled={isValidating}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isValidating ? <SpinnerIcon /> : <RefreshIcon />}
            Re-validate
          </button>
        </div>
        {entry?.lastChecked && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Last checked: {formatDate(entry.lastChecked)}
          </p>
        )}
        {expanded && entry?.output && (
          <pre className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-3 overflow-auto max-h-32 text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap break-words">
            {entry.output.slice(0, 500)}
          </pre>
        )}
      </div>
    </section>
  );
}

// ── MCP badge ─────────────────────────────────────────────────────────────

function McpBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand-500)]/15 text-[var(--color-brand-400)] font-medium">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
      </svg>
      MCP
    </span>
  );
}

// ── MCP Endpoint Section (detail panel) ───────────────────────────────────

function McpEndpointSection({ mcpEndpoint }: { mcpEndpoint: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(mcpEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
        MCP Endpoint
      </h3>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text-primary)] truncate">
          {mcpEndpoint}
        </code>
        <button
          onClick={handleCopy}
          title="Copy MCP endpoint URL"
          className="shrink-0 p-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      {copied && (
        <p className="text-[10px] text-[var(--color-brand-400)] mt-1">Copied!</p>
      )}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── MCP Tools Section (detail panel) ──────────────────────────────────────

function McpToolsSection({ providerConfigKey }: { providerConfigKey: string }) {
  const { tools, isLoading, error, toggleTool } = useIntegrationMcpTools(providerConfigKey);

  if (isLoading) {
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
          MCP Tools
        </h3>
        <div className="space-y-2 animate-pulse">
          <div className="h-8 rounded bg-[var(--color-bg-overlay)]" />
          <div className="h-8 rounded bg-[var(--color-bg-overlay)]" />
          <div className="h-8 rounded bg-[var(--color-bg-overlay)]" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
          MCP Tools
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)]">{error}</p>
      </section>
    );
  }

  if (tools.length === 0) return null;

  const enabledCount = tools.filter((t) => t.enabled).length;

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
        MCP Tools
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
        {enabledCount} of {tools.length} action{tools.length !== 1 ? "s" : ""} enabled
      </p>
      <div className="space-y-1.5">
        {tools.map((tool) => (
          <McpToolToggle key={tool.id} tool={tool} onToggle={toggleTool} />
        ))}
      </div>
    </section>
  );
}

function McpToolToggle({ tool, onToggle }: { tool: McpToolEntry; onToggle: (t: McpToolEntry) => Promise<void> }) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try { await onToggle(tool); } finally { setToggling(false); }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{tool.name}</p>
        {tool.description && (
          <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">{tool.description}</p>
        )}
      </div>
      {tool.preBuilt && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] shrink-0">
          pre-built
        </span>
      )}
      <button
        onClick={handleToggle}
        disabled={toggling || tool.id === 0}
        title={tool.enabled ? "Disable MCP tool" : "Enable MCP tool"}
        className={cn(
          "relative shrink-0 w-8 h-[18px] rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          tool.enabled
            ? "bg-[var(--color-brand-500)]"
            : "bg-[var(--color-bg-overlay)] border border-[var(--color-border)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform bg-white shadow-sm",
            tool.enabled ? "translate-x-[17px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ── MCP Connection Card ───────────────────────────────────────────────────

function McpConnectionCard({
  connection,
  summary,
  isSelected,
  onClick,
  onDelete,
}: {
  connection: NangoConnectionSummary;
  summary: McpIntegrationSummary | null;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const healthEntry = useCredentialHealthStore(
    (s) => s.entries[`${connection.provider_config_key}:${connection.connection_id}`]
  );
  const validate = useCredentialHealthStore((s) => s.validate);

  useEffect(() => {
    if (!healthEntry) {
      validate(connection.provider_config_key, connection.connection_id);
    }
  }, [connection.provider_config_key, connection.connection_id, healthEntry, validate]);

  const status = healthEntry?.status ?? "unchecked";
  const toolCount = summary?.toolCount ?? 0;
  const enabledCount = summary?.enabledCount ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "relative flex flex-col gap-3 p-4 rounded-xl border transition-all cursor-pointer group",
        isSelected
          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 shadow-sm"
          : "border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-brand-500)]/40 hover:shadow-sm"
      )}
    >
      {/* Header row: avatar + provider name + delete */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-500)]/10 flex items-center justify-center text-xs font-bold text-[var(--color-brand-400)] uppercase shrink-0">
          {(connection.provider_config_key[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {connection.provider_config_key}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {connection.provider || connection.connection_id}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all cursor-pointer"
          aria-label="Delete connection"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Status + tool count row */}
      <div className="flex items-center gap-2 flex-wrap">
        <CredentialHealthBadge status={status} />
        {toolCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] font-medium">
            <ToolsIcon />
            {enabledCount}/{toolCount} tools
          </span>
        )}
      </div>

      {/* Last checked timestamp */}
      {healthEntry?.lastChecked && (
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          Last checked {formatDate(healthEntry.lastChecked)}
        </p>
      )}
    </div>
  );
}

function ToolsIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  connection: NangoConnectionSummary;
  isMcp: boolean;
  mcpEndpoint: string | null;
  onClose: () => void;
  onDelete: (connection: NangoConnectionSummary) => void;
}

function DetailPanel({ connection, isMcp, mcpEndpoint, onClose, onDelete }: DetailPanelProps) {
  const [detail, setDetail] = useState<NangoConnectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    window.nango
      .getConnection({ providerConfigKey: connection.provider_config_key, connectionId: connection.connection_id })
      .then((res) => {
        if (res.status === "error") {
          setError(res.error);
        } else {
          setDetail(res.data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [connection.provider_config_key, connection.connection_id]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed right-0 top-12 bottom-6 z-40 w-[420px] bg-[var(--color-bg-surface)] border-l border-[var(--color-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)] font-medium">
                active
              </span>
              {isMcp && <McpBadge />}
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] font-mono">
              {connection.connection_id}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              {connection.provider_config_key}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Details
            </h3>
            <dl className="space-y-2.5">
              <Row label="Provider" value={connection.provider || connection.provider_config_key} />
              <Row label="Auth type" value={detail ? guessAuthType(detail) : "—"} />
              <Row label="Created" value={formatDate(connection.created)} />
              {detail?.updated_at && (
                <Row label="Last updated" value={formatDate(detail.updated_at)} />
              )}
            </dl>
          </section>

          {/* Credential Health */}
          <CredentialHealthSection
            providerConfigKey={connection.provider_config_key}
            connectionId={connection.connection_id}
          />

          {/* MCP Endpoint */}
          {isMcp && mcpEndpoint && (
            <McpEndpointSection mcpEndpoint={mcpEndpoint} />
          )}

          {/* MCP Tools */}
          {isMcp && (
            <McpToolsSection providerConfigKey={connection.provider_config_key} />
          )}

          {/* Raw metadata */}
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-16 rounded bg-[var(--color-bg-overlay)]" />
              <div className="h-32 rounded-lg bg-[var(--color-bg-overlay)]" />
            </div>
          ) : error ? (
            <ErrorBanner message={error} />
          ) : detail ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                Metadata
              </h3>
              <pre className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-4 overflow-auto max-h-60 text-[var(--color-text-secondary)] font-mono">
                {JSON.stringify(detail.credentials ?? {}, null, 2)}
              </pre>
            </section>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[var(--color-border)] flex gap-2 shrink-0">
          <ConnectModal>
            {({ open, isLoading: connectLoading }) => (
              <button
                onClick={open}
                disabled={connectLoading}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connectLoading && <SpinnerIcon />}
                Re-authorize
              </button>
            )}
          </ConnectModal>
          <button
            onClick={() => onDelete(connection)}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer flex items-center gap-2"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] text-right truncate">{value}</dd>
    </div>
  );
}

function guessAuthType(detail: NangoConnectionDetail): string {
  const creds = detail.credentials as Record<string, unknown> | undefined;
  if (!creds) return "Unknown";
  if (creds.access_token) return "OAuth 2.0";
  if (creds.api_key) return "API Key";
  if (creds.username) return "Basic Auth";
  return "OAuth";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ConnectionsPage() {
  const { connections, isLoading, error, fetchConnections, deleteConnection } =
    useConnectionsStore();
  const { mcpProviderKeys, mcpSummaries, mcpEndpoint } = useMcpIntegrations();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<NangoConnectionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NangoConnectionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return connections
      .filter((c) =>
        !q ||
        c.connection_id.toLowerCase().includes(q) ||
        c.provider_config_key.toLowerCase().includes(q) ||
        (c.provider ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let av = "", bv = "";
        if (sortKey === "provider") { av = a.provider_config_key; bv = b.provider_config_key; }
        else if (sortKey === "connection_id") { av = a.connection_id; bv = b.connection_id; }
        else { av = a.created; bv = b.created; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [connections, search, sortKey, sortDir]);

  const { mcpConnections, standardConnections } = useMemo(() => {
    const mcp: NangoConnectionSummary[] = [];
    const standard: NangoConnectionSummary[] = [];
    for (const c of filtered) {
      if (mcpProviderKeys.has(c.provider_config_key)) mcp.push(c);
      else standard.push(c);
    }
    return { mcpConnections: mcp, standardConnections: standard };
  }, [filtered, mcpProviderKeys]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteConnection(pendingDelete.provider_config_key, pendingDelete.connection_id);
      setPendingDelete(null);
      if (selected?.connection_id === pendingDelete.connection_id) setSelected(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] relative">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Connections
        </h1>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {!isLoading && `${filtered.length} of ${connections.length}`}
        </span>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className={searchInputClass}
          />
        </div>
        {/* Refresh */}
        <button
          onClick={() => fetchConnections()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshIcon />
          Refresh
        </button>
        {/* Connect new */}
        <ConnectModal onConnected={() => fetchConnections()}>
          {({ open, isLoading: connectLoading }) => (
            <button
              onClick={open}
              disabled={connectLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {connectLoading ? (
                <SpinnerIcon />
              ) : (
                <span className="text-base leading-none">+</span>
              )}
              Connect
            </button>
          )}
        </ConnectModal>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} className="mx-6 mt-4 shrink-0" />}
      {deleteError && <ErrorBanner message={deleteError} className="mx-6 mt-4 shrink-0" />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
          </>
        )}

        {/* Empty state */}
        {!isLoading && connections.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <PlugIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                No connections yet
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Connect your first integration to get started.
              </p>
            </div>
            <ConnectModal onConnected={() => fetchConnections()}>
              {({ open, isLoading: connectLoading }) => (
                <button
                  onClick={open}
                  disabled={connectLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Connect your first integration
                </button>
              )}
            </ConnectModal>
          </div>
        )}

        {/* No search results */}
        {!isLoading && connections.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">No connections match &ldquo;{search}&rdquo;</p>
            <button onClick={() => setSearch("")} className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer">
              Clear search
            </button>
          </div>
        )}

        {/* ── AI / MCP Section ─────────────────────────────────────────── */}
        {!isLoading && mcpConnections.length > 0 && (
          <section className="px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <McpBadge />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                AI / MCP
              </h2>
              <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                {mcpConnections.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mcpConnections.map((conn) => (
                <McpConnectionCard
                  key={`mcp-${conn.provider_config_key}:${conn.connection_id}`}
                  connection={conn}
                  summary={mcpSummaries.get(conn.provider_config_key) ?? null}
                  isSelected={
                    selected?.connection_id === conn.connection_id &&
                    selected?.provider_config_key === conn.provider_config_key
                  }
                  onClick={() =>
                    setSelected((s) =>
                      s?.connection_id === conn.connection_id &&
                      s?.provider_config_key === conn.provider_config_key
                        ? null
                        : conn
                    )
                  }
                  onDelete={() => setPendingDelete(conn)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Standard Connections Table ────────────────────────────────── */}
        {!isLoading && standardConnections.length > 0 && (
          <>
            {mcpConnections.length > 0 && (
              <div className="px-6 pb-2 pt-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Standard Connections
                </h2>
              </div>
            )}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] sticky top-0 z-10">
              <div className="w-8 shrink-0" />
              <SortHeader label="Provider" sortKey="provider" current={sortKey} dir={sortDir} onToggle={toggleSort} className="flex-1" />
              <SortHeader label="Connection ID" sortKey="connection_id" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-48" />
              <div className="w-28 text-xs text-[var(--color-text-secondary)]">Status</div>
              <SortHeader label="Created" sortKey="created" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-36" />
            </div>
            {standardConnections.map((conn) => (
              <ConnectionRow
                key={`${conn.provider_config_key}:${conn.connection_id}`}
                connection={conn}
                isMcp={false}
                isSelected={selected?.connection_id === conn.connection_id && selected?.provider_config_key === conn.provider_config_key}
                onClick={() => setSelected((s) =>
                  s?.connection_id === conn.connection_id && s?.provider_config_key === conn.provider_config_key ? null : conn
                )}
                onDelete={() => setPendingDelete(conn)}
              />
            ))}
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          connection={selected}
          isMcp={mcpProviderKeys.has(selected.provider_config_key)}
          mcpEndpoint={mcpEndpoint}
          onClose={() => setSelected(null)}
          onDelete={(c) => { setSelected(null); setPendingDelete(c); }}
        />
      )}

      {/* Delete dialog */}
      {pendingDelete && (
        <DeleteDialog
          connection={pendingDelete}
          onConfirm={handleDelete}
          onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}

// ── SortHeader ─────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey: key,
  current,
  dir,
  onToggle,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onToggle: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === key;
  return (
    <button
      onClick={() => onToggle(key)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors",
        active
          ? "text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        className
      )}
    >
      {label}
      {active && <ChevronIcon direction={dir === "asc" ? "up" : "down"} />}
    </button>
  );
}

// ── ConnectionRow ──────────────────────────────────────────────────────────

function ConnectionRow({
  connection,
  isMcp,
  isSelected,
  onClick,
  onDelete,
}: {
  connection: NangoConnectionSummary;
  isMcp: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const healthEntry = useCredentialHealthStore(
    (s) => s.entries[`${connection.provider_config_key}:${connection.connection_id}`]
  );
  const isInvalid = healthEntry?.status === "invalid";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex flex-col border-b border-[var(--color-border)] cursor-pointer transition-colors group",
        isSelected
          ? "bg-[var(--color-brand-500)]/10"
          : "hover:bg-[var(--color-bg-surface)]"
      )}
    >
      {/* Warning banner for invalid credentials */}
      {isInvalid && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-error)]/10 text-[var(--color-error)] text-xs border-b border-[var(--color-error)]/20">
          <ShieldAlertIcon />
          <span>Credential validation failed</span>
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-3">
        {/* Provider avatar */}
        <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)] uppercase shrink-0">
          {(connection.provider_config_key[0] ?? "?").toUpperCase()}
        </div>

        {/* Provider name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {connection.provider_config_key}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {connection.provider || "—"}
          </p>
        </div>

        {/* Connection ID */}
        <div className="w-48 min-w-0">
          <p className="text-sm font-mono text-[var(--color-text-secondary)] truncate">
            {connection.connection_id}
          </p>
        </div>

        {/* Status */}
        <div className="w-28 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            active
          </span>
          {isMcp && <McpBadge />}
        </div>

        {/* Created */}
        <div className="w-36 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
          {formatDate(connection.created)}
        </div>

        {/* Row actions */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all cursor-pointer"
          aria-label="Delete connection"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
