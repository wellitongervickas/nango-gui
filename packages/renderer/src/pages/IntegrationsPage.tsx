import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { NangoProvider } from "@nango-gui/shared";
import { useIntegrationsStore } from "@/store/integrationsStore";
import { ConnectModal } from "@/components/connections/ConnectModal";
import { SearchIcon, XIcon, ExternalLinkIcon, GridIcon, SpinnerIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { cn, searchInputClass } from "@/lib/utils";

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
  isSelected: boolean;
  onClick: () => void;
}

function ProviderCard({ provider, isSelected, onClick }: ProviderCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "bg-[var(--color-bg-surface)] border rounded-xl p-4 cursor-pointer transition-all hover:border-[var(--color-brand-500)]/50 hover:bg-[var(--color-bg-raised)]",
        isSelected
          ? "border-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/30"
          : "border-[var(--color-border)]"
      )}
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

// ── Detail panel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  provider: NangoProvider;
  onClose: () => void;
}

function DetailPanel({ provider, onClose }: DetailPanelProps) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-12 bottom-6 z-40 w-[380px] bg-[var(--color-bg-surface)] border-l border-[var(--color-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={provider} size={44} />
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {provider.display_name}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono">
                {provider.name}
              </p>
            </div>
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
          {/* Auth info */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Details
            </h3>
            <dl className="space-y-2.5">
              <DetailRow label="Auth mode" value={provider.auth_mode} />
              <DetailRow label="Provider key" value={provider.name} mono />
            </dl>
          </section>

          {/* Categories */}
          {provider.categories && provider.categories.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                Categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {provider.categories.map((cat) => (
                  <span
                    key={cat}
                    className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Docs link */}
          {provider.docs && (
            <a
              href={provider.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--color-brand-400)] hover:underline"
            >
              <ExternalLinkIcon />
              View documentation
            </a>
          )}
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-[var(--color-border)] shrink-0">
          <ConnectModal>
            {({ open, isLoading }) => (
              <button
                onClick={open}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <SpinnerIcon />}
                Connect {provider.display_name}
              </button>
            )}
          </ConnectModal>
        </div>
      </aside>
    </>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd className={cn("text-sm text-[var(--color-text-primary)] text-right truncate", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

// ── Virtualized grid ───────────────────────────────────────────────────────

const COLS = 4;
const ROW_HEIGHT = 120; // px per row

interface VirtualGridProps {
  providers: NangoProvider[];
  selected: NangoProvider | null;
  onSelect: (p: NangoProvider) => void;
}

function VirtualGrid({ providers, selected, onSelect }: VirtualGridProps) {
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
                  isSelected={selected?.name === provider.name}
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

  const [selected, setSelected] = useState<NangoProvider | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

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

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Integrations</h1>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {!isLoading && `${filtered.length} providers`}
        </span>
        <div className="flex-1" />
        <div className="relative w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations…"
            className={searchInputClass}
          />
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

          {/* Empty state */}
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
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No providers match "{search}"
              </p>
              <button
                onClick={() => setSearch("")}
                className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Virtualized grid */}
          {!isLoading && filtered.length > 0 && (
            <VirtualGrid
              providers={filtered}
              selected={selected}
              onSelect={(p) => setSelected((s) => (s?.name === p.name ? null : p))}
            />
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          provider={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
