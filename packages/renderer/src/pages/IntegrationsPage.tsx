import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { NangoProvider } from "@nango-gui/shared";
import { useIntegrationsStore } from "@/store/integrationsStore";
import { useConnectFlowStore } from "@/store/connectFlowStore";
import { navigate } from "@/lib/router";
import { SearchIcon, XIcon, GridIcon, PlusIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { cn, searchInputClass } from "@/lib/utils";

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

function ProviderLogo({ provider, size = 32 }: { provider: NangoProvider; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!provider.logo_url || failed) {
    return (
      <div
        className="rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)] uppercase shrink-0"
        style={{ width: size, height: size }}
      >
        {(provider.display_name[0] ?? "?").toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={provider.logo_url}
      alt={provider.display_name}
      width={size}
      height={size}
      className="rounded-md object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ── Category list ──────────────────────────────────────────────────────────

interface CategorySidebarProps {
  categories: string[];
  active: string | null;
  onSelect: (cat: string | null) => void;
  counts: Record<string, number>;
}

function CategorySidebar({ categories, active, onSelect, counts }: CategorySidebarProps) {
  return (
    <aside className="w-44 shrink-0 border-r border-[var(--color-border)] overflow-y-auto py-3">
      <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Category
      </p>
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-1.5 text-sm transition-colors cursor-pointer",
          !active
            ? "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-400)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
        )}
      >
        <span>All</span>
        <span className="text-xs tabular-nums">{counts._all ?? 0}</span>
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-1.5 text-sm transition-colors cursor-pointer",
            active === cat
              ? "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-400)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
          )}
        >
          <span className="truncate">{cat}</span>
          <span className="text-xs tabular-nums ml-2 shrink-0">{counts[cat] ?? 0}</span>
        </button>
      ))}
    </aside>
  );
}

// ── Skeleton card ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-md bg-[var(--color-bg-overlay)] shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-[var(--color-bg-overlay)]" />
          <div className="h-3 w-16 rounded bg-[var(--color-bg-overlay)]" />
        </div>
      </div>
      <div className="h-3 w-20 rounded-full bg-[var(--color-bg-overlay)]" />
    </div>
  );
}

// ── Provider card ──────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: NangoProvider;
  onClick: () => void;
}

function ProviderCard({ provider, onClick }: ProviderCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--color-brand-500)]/50 hover:bg-[var(--color-bg-raised)]"
    >
      <div className="flex items-start gap-3 mb-3">
        <ProviderLogo provider={provider} size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {provider.display_name}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {provider.auth_mode}
          </p>
        </div>
      </div>
      {provider.categories && provider.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {provider.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]"
            >
              {cat}
            </span>
          ))}
          {provider.categories.length > 2 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]">
              +{provider.categories.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Virtualized grid ───────────────────────────────────────────────────────

const COLS = 4;
const ROW_HEIGHT = 120; // px per row

interface VirtualGridProps {
  providers: NangoProvider[];
  onSelect: (p: NangoProvider) => void;
}

function VirtualGrid({ providers, onSelect }: VirtualGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Group providers into rows of COLS items.
  const rows = useMemo(() => {
    const r: NangoProvider[][] = [];
    for (let i = 0; i < providers.length; i += COLS) {
      r.push(providers.slice(i, i + COLS));
    }
    return r;
  }, [providers]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT + 12, // row + gap
    overscan: 4,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-4 py-3">
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                gap: "0.75rem",
              }}
            >
              {row?.map((provider) => (
                <ProviderCard
                  key={provider.name}
                  provider={provider}
                  onClick={() => onSelect(provider)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const {
    isLoading,
    error,
    search,
    activeCategory,
    fetchProviders,
    setSearch,
    setActiveCategory,
    filteredProviders,
    providers,
  } = useIntegrationsStore();

  const openSearch = useConnectFlowStore((s) => s.openSearch);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebouncedValue(localSearch, 200);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Sync debounced value to store
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  // Focus search input on Ctrl+F / Cmd+F within the page
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

  const filtered = filteredProviders();

  // Build category list and counts from all providers.
  const { categories, counts } = useMemo(() => {
    const catSet = new Set<string>();
    const catCounts: Record<string, number> = { _all: 0 };
    for (const p of providers) {
      catCounts._all = (catCounts._all ?? 0) + 1;
      for (const c of p.categories ?? []) {
        catSet.add(c);
        catCounts[c] = (catCounts[c] ?? 0) + 1;
      }
    }
    return {
      categories: Array.from(catSet).sort(),
      counts: catCounts,
    };
  }, [providers]);

  function handleSelectProvider(provider: NangoProvider) {
    navigate(`integrations/detail/${encodeURIComponent(provider.name)}`);
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Integrations</h1>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {!isLoading && `${filtered.length} provider${filtered.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex-1" />

        {/* New Connection button */}
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
              onClick={() => { setLocalSearch(""); searchInputRef.current?.focus(); }}
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

      <div className="flex flex-1 overflow-hidden">
        {/* Category sidebar */}
        {!isLoading && providers.length > 0 && (
          <CategorySidebar
            categories={categories}
            active={activeCategory}
            onSelect={setActiveCategory}
            counts={counts}
          />
        )}

        {/* Grid area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Loading */}
          {isLoading && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
                {Array.from({ length: 16 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            </div>
          )}

          {/* Empty state — no providers at all */}
          {!isLoading && providers.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <GridIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  No integrations found
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Connect a Nango API key to browse the catalog.
                </p>
              </div>
            </div>
          )}

          {/* No search results */}
          {!isLoading && providers.length > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <SearchIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  No results for "{localSearch}"
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                  {activeCategory
                    ? `Try a different search or clear the "${activeCategory}" filter.`
                    : "Try a different search term or browse by category."}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLocalSearch("")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
                >
                  Clear search
                </button>
                {activeCategory && (
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
                  >
                    Clear category
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Virtualized grid */}
          {!isLoading && filtered.length > 0 && (
            <VirtualGrid
              providers={filtered}
              onSelect={handleSelectProvider}
            />
          )}
        </div>
      </div>
    </div>
  );
}
