import { useEffect, useState } from "react";
import { useMcpStore } from "@/store/mcpStore";
import { McpServerCard } from "@/components/mcp/McpServerCard";
import { AddServerDialog } from "@/components/mcp/AddServerDialog";

// ── Icons ─────────────────────────────────────────────────────────────────────

function McpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="m9 8 3 3-3 3" />
      <path d="M15 11h2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function McpPage() {
  const configs = useMcpStore((s) => s.configs);
  const configFiles = useMcpStore((s) => s.configFiles);
  const selectedServer = useMcpStore((s) => s.selectedServer);
  const isLoading = useMcpStore((s) => s.isLoading);
  const error = useMcpStore((s) => s.error);
  const fetchConfigs = useMcpStore((s) => s.fetchConfigs);
  const addConfig = useMcpStore((s) => s.addConfig);
  const removeConfig = useMcpStore((s) => s.removeConfig);
  const startServer = useMcpStore((s) => s.startServer);
  const stopServer = useMcpStore((s) => s.stopServer);
  const selectServer = useMcpStore((s) => s.selectServer);
  const handleStatusChange = useMcpStore((s) => s.handleStatusChange);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Initial load
  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  // Subscribe to real-time status changes from main process
  useEffect(() => {
    if (!window.mcp) return;
    window.mcp.onStatusChange(handleStatusChange);
    return () => {
      window.mcp.removeAllStatusChangeListeners();
    };
  }, [handleStatusChange]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetchConfigs();
    } finally {
      setRefreshing(false);
    }
  }

  const runningCount = configs.filter((c) => c.status === "running").length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold text-[var(--color-text)]">MCP Servers</h1>
            {configs.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {configs.length} server{configs.length !== 1 ? "s" : ""}
                {runningCount > 0 && (
                  <span className="ml-2 text-[var(--color-sync)]">
                    {runningCount} running
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex-1" />

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isLoading || refreshing}
            title="Refresh server list"
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshIcon />
          </button>

          {/* Add server */}
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <PlusIcon />
            Add Server
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && configs.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-muted)]">
            Loading MCP servers…
          </div>
        ) : configs.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-4 py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
              <McpIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text)] mb-1">No MCP servers found</p>
              <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                Add a server manually, or place an MCP config at one of the scanned paths below.
              </p>
            </div>
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              <PlusIcon />
              Add your first server
            </button>
          </div>
        ) : (
          /* Server cards */
          <div className="p-6 space-y-3">
            {configs.map((server) => (
              <McpServerCard
                key={server.config.name}
                server={server}
                selected={selectedServer === server.config.name}
                onSelect={() => selectServer(
                  selectedServer === server.config.name ? null : server.config.name
                )}
                onStart={() => startServer(server.config.name)}
                onStop={() => stopServer(server.config.name)}
                onRemove={() => removeConfig(server.config.name)}
              />
            ))}
          </div>
        )}

        {/* Config files footer */}
        {configFiles.length > 0 && (
          <div className="px-6 pb-6">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Scanned config files
              </h3>
              <ul className="space-y-1">
                {configFiles.map((path) => (
                  <li
                    key={path}
                    className="text-xs font-mono text-[var(--color-text-muted)] truncate"
                    title={path}
                  >
                    {path}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Add dialog */}
      {showAddDialog && (
        <AddServerDialog
          onAdd={addConfig}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}
