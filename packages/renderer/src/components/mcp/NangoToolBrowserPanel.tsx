import { useEffect, useState } from "react";
import { useNangoMcpStore, type NangoMcpToolState } from "@/store/nangoMcpStore";
import { useConnectFlowStore } from "@/store/connectFlowStore";
import { cn, searchInputClass } from "@/lib/utils";
import { SearchIcon, RefreshIcon, ChevronIcon, ExternalLinkIcon } from "@/components/icons";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ToolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

// ── Provider logo ─────────────────────────────────────────────────────────────

function ProviderLogo({ logoUrl, displayName }: { logoUrl: string; displayName: string }) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <div className="w-8 h-8 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase shrink-0">
        {(displayName[0] ?? "?").toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={displayName}
      width={32}
      height={32}
      className="rounded-md object-contain shrink-0 w-8 h-8"
      onError={() => setFailed(true)}
    />
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(); }}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none cursor-pointer",
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Tool card ─────────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: NangoMcpToolState;
  onToggle: () => void;
  onConnect: () => void;
}

function ToolCard({ tool, onToggle, onConnect }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { provider, enabled, connections } = tool;
  const isConnected = connections.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        enabled
          ? "border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-3">
        <ProviderLogo logoUrl={provider.logo_url} displayName={provider.display_name} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--color-text)] truncate">
              {provider.display_name}
            </span>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-sync)]/15 text-[var(--color-sync)]">
                <CheckIcon />
                {connections.length} connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-border)] text-[var(--color-text-muted)]">
                Not connected
              </span>
            )}
          </div>

          {provider.categories && provider.categories.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {provider.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-1.5 py-0.5 rounded-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isConnected && (
            <button
              onClick={(e) => { e.stopPropagation(); onConnect(); }}
              className="px-2 py-1 text-[10px] font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] transition-colors cursor-pointer"
            >
              Connect
            </button>
          )}
          <ToggleSwitch checked={enabled} onChange={onToggle} />
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            title="View details"
          >
            <ChevronIcon direction={expanded ? "up" : "down"} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-3">
          {/* Auth mode */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-20 shrink-0">
              Auth mode
            </span>
            <span className="text-xs font-mono text-[var(--color-text)] px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
              {provider.auth_mode}
            </span>
          </div>

          {/* MCP tool name */}
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-20 shrink-0 pt-0.5">
              Tool name
            </span>
            <span className="text-xs font-mono text-[var(--color-text)] px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
              {provider.name}
            </span>
          </div>

          {/* Active connections */}
          {connections.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-20 shrink-0 pt-0.5">
                Connections
              </span>
              <div className="flex flex-wrap gap-1">
                {connections.map((conn) => (
                  <span
                    key={conn.connection_id}
                    className="px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-muted)]"
                  >
                    {conn.connection_id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Docs link */}
          {provider.docs && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] w-20 shrink-0">
                Docs
              </span>
              <a
                href={provider.docs}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                View docs
                <ExternalLinkIcon />
              </a>
            </div>
          )}

          {/* MCP Auth notice */}
          {!isConnected && (
            <div className="rounded-md bg-[var(--color-action)]/10 border border-[var(--color-action)]/20 p-2.5">
              <p className="text-xs text-[var(--color-action)] font-medium mb-0.5">MCP Auth required</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Connect this integration to authorize AI agents to use it as an MCP tool.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onConnect(); }}
                className="mt-2 px-3 py-1 text-xs font-medium rounded-md bg-[var(--color-action)]/15 text-[var(--color-action)] border border-[var(--color-action)]/30 hover:bg-[var(--color-action)]/25 transition-colors cursor-pointer"
              >
                Connect now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MCP server URL banner ─────────────────────────────────────────────────────

function McpServerUrlBanner({ enabledCount }: { enabledCount: number }) {
  const [copied, setCopied] = useState(false);
  const mcpUrl = "http://localhost:3003/mcp";

  function handleCopy() {
    navigator.clipboard.writeText(mcpUrl).catch(() => {/* ignore */});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-6 mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] shrink-0">
          <LinkIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--color-text)] mb-0.5">Nango MCP Server</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
            Point your AI client (Claude, Cursor, etc.) at this endpoint to expose your enabled integrations as tools.
            {enabledCount > 0 && (
              <span className="ml-1 font-medium text-[var(--color-sync)]">
                {enabledCount} tool{enabledCount !== 1 ? "s" : ""} enabled.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] font-mono px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)]">
              {mcpUrl}
            </code>
            <button
              onClick={handleCopy}
              title="Copy URL"
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] transition-colors cursor-pointer text-[10px] font-medium"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function NangoToolBrowserPanel() {
  const tools = useNangoMcpStore((s) => s.tools);
  const isLoading = useNangoMcpStore((s) => s.isLoading);
  const error = useNangoMcpStore((s) => s.error);
  const search = useNangoMcpStore((s) => s.search);
  const filterConnected = useNangoMcpStore((s) => s.filterConnected);
  const fetchTools = useNangoMcpStore((s) => s.fetchTools);
  const toggleTool = useNangoMcpStore((s) => s.toggleTool);
  const enableAll = useNangoMcpStore((s) => s.enableAll);
  const disableAll = useNangoMcpStore((s) => s.disableAll);
  const setSearch = useNangoMcpStore((s) => s.setSearch);
  const setFilterConnected = useNangoMcpStore((s) => s.setFilterConnected);
  const filteredTools = useNangoMcpStore((s) => s.filteredTools);
  const openConnect = useConnectFlowStore((s) => s.openSearch);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchTools();
    } finally {
      setRefreshing(false);
    }
  }

  const visible = filteredTools();
  const enabledCount = tools.filter((t) => t.enabled).length;
  const connectedCount = tools.filter((t) => t.connections.length > 0).length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(searchInputClass, "pl-8 w-full")}
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filterConnected}
            onChange={(e) => setFilterConnected(e.target.checked)}
            className="rounded border-[var(--color-border)] cursor-pointer"
          />
          Connected only
        </label>

        <div className="flex-1" />

        <span className="text-[11px] text-[var(--color-text-muted)]">
          {connectedCount} connected · {enabledCount} enabled
        </span>

        <button
          onClick={enableAll}
          disabled={isLoading || tools.length === 0}
          className="px-2.5 py-1.5 text-[10px] font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] transition-colors cursor-pointer disabled:opacity-50"
        >
          Enable all
        </button>

        <button
          onClick={disableAll}
          disabled={isLoading || enabledCount === 0}
          className="px-2.5 py-1.5 text-[10px] font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] transition-colors cursor-pointer disabled:opacity-50"
        >
          Disable all
        </button>

        <button
          onClick={handleRefresh}
          disabled={isLoading || refreshing}
          title="Refresh"
          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshIcon />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* MCP URL banner */}
        <McpServerUrlBanner enabledCount={enabledCount} />

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 px-4 py-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && tools.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-muted)]">
            Loading integrations…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
              <ToolIcon />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)] mb-0.5">
                {search || filterConnected ? "No integrations match" : "No integrations found"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {search || filterConnected
                  ? "Try adjusting your search or filter."
                  : "Nango integrations will appear here once your API key is configured."}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-2">
            {visible.map((tool) => (
              <ToolCard
                key={tool.provider.name}
                tool={tool}
                onToggle={() => toggleTool(tool.provider.name)}
                onConnect={() => openConnect()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
