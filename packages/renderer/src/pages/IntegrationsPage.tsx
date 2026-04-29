import { useEffect, useRef, useState } from "react";
import type { NangoIntegrationSummary } from "@nango-gui/shared";
import { useIntegrationsStore } from "@/store/integrationsStore";
import { useConnectFlowStore } from "@/store/connectFlowStore";
import { navigate } from "@/lib/router";
import { SearchIcon, XIcon, GridIcon, PlusIcon, SpinnerIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { searchInputClass } from "@/lib/utils";

// ── Debounce hook ─────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ── Provider logo ──────────────────────────────────────────────────────────

function ProviderLogo({
  logo,
  fallback,
  size = 36,
}: {
  logo: string;
  fallback: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!logo || failed) {
    return (
      <div
        className="rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)] uppercase shrink-0"
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
      className="rounded-md object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ── Date formatting ────────────────────────────────────────────────────────

function formatCreated(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Integration row ────────────────────────────────────────────────────────

interface IntegrationRowProps {
  integration: NangoIntegrationSummary;
  onClick: () => void;
}

function IntegrationRow({ integration, onClick }: IntegrationRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] cursor-pointer transition-colors"
    >
      <ProviderLogo logo={integration.logo} fallback={integration.display_name} size={32} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {integration.display_name}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
          {integration.unique_key}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] tabular-nums">
        <span
          className={
            integration.connectionCount > 0
              ? "inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-brand-500)]"
              : "inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-bg-overlay)]"
          }
        />
        {integration.connectionCount} connection
        {integration.connectionCount === 1 ? "" : "s"}
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] tabular-nums whitespace-nowrap">
        {formatCreated(integration.created_at)}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const {
    integrations,
    isLoading,
    error,
    search,
    fetchIntegrations,
    setSearch,
    filteredIntegrations,
  } = useIntegrationsStore();

  const openSearch = useConnectFlowStore((s) => s.openSearch);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebouncedValue(localSearch, 200);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Sync debounced value to store.
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  // Focus search input on Ctrl+F / Cmd+F within the page.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = filteredIntegrations();

  function handleSelectIntegration(i: NangoIntegrationSummary) {
    navigate(`integrations/detail/${encodeURIComponent(i.unique_key)}`);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Integrations</h1>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {!isLoading &&
            `${filtered.length} integration${filtered.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex-1" />

        {/* New Connection CTA */}
        <button
          onClick={openSearch}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          <PlusIcon />
          New Connection
        </button>

        {/* Search */}
        <div className="relative w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            <SearchIcon />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search integrations..."
            className={searchInputClass}
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} className="mx-6 mt-4 shrink-0" />}

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <SpinnerIcon />
        </div>
      )}

      {/* Empty state — no configured integrations */}
      {!isLoading && integrations.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-5 px-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
            <GridIcon />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              No integrations yet
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Browse the provider catalog and connect your first integration to start
              syncing data with Nango.
            </p>
          </div>
          <button
            onClick={openSearch}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <PlusIcon />
            Browse providers
          </button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && integrations.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
            <SearchIcon />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              No results for &quot;{localSearch}&quot;
            </p>
          </div>
          <button
            onClick={() => setLocalSearch("")}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Integration list */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 sticky top-0 text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
            <div className="w-8" />
            <div>Integration</div>
            <div>Connections</div>
            <div>Created</div>
          </div>
          {filtered.map((i) => (
            <IntegrationRow
              key={i.unique_key}
              integration={i}
              onClick={() => handleSelectIntegration(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
