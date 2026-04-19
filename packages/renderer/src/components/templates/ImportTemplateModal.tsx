import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NangoProvider } from "@nango-gui/shared";
import { SearchIcon, SpinnerIcon, XIcon, DownloadIcon } from "@/components/icons";

const TEMPLATE_CACHE_KEY = "nango-gui:template-providers-cache";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedProviders {
  providers: NangoProvider[];
  fetchedAt: number;
}

function loadCachedProviders(): NangoProvider[] | null {
  try {
    const raw = localStorage.getItem(TEMPLATE_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedProviders = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached.providers;
  } catch {
    return null;
  }
}

function saveCachedProviders(providers: NangoProvider[]) {
  try {
    const data: CachedProviders = { providers, fetchedAt: Date.now() };
    localStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // non-critical
  }
}

type CloneState =
  | { kind: "idle" }
  | { kind: "choosingDir" }
  | { kind: "cloning"; lines: string[]; targetDir: string }
  | { kind: "success"; targetDir: string; providerName: string }
  | { kind: "error"; message: string };

interface ImportTemplateModalProps {
  onClose: () => void;
}

export function ImportTemplateModal({ onClose }: ImportTemplateModalProps) {
  const [query, setQuery] = useState("");
  const [providers, setProviders] = useState<NangoProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [selected, setSelected] = useState<NangoProvider | null>(null);
  const [cloneState, setCloneState] = useState<CloneState>({ kind: "idle" });
  const [highlightIdx, setHighlightIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef<string | null>(null);

  // Load providers — try live, fall back to cache
  useEffect(() => {
    if (!window.nango) {
      const cached = loadCachedProviders();
      if (cached) {
        setProviders(cached);
        setIsOffline(true);
      } else {
        setIsOffline(true);
      }
      setIsLoadingProviders(false);
      return;
    }

    setIsLoadingProviders(true);
    window.nango
      .listProviders()
      .then((res) => {
        if (res.status === "ok") {
          setProviders(res.data);
          saveCachedProviders(res.data);
          setIsOffline(false);
        } else {
          const cached = loadCachedProviders();
          if (cached) {
            setProviders(cached);
            setIsOffline(true);
          } else {
            setIsOffline(true);
          }
        }
      })
      .catch(() => {
        const cached = loadCachedProviders();
        if (cached) {
          setProviders(cached);
          setIsOffline(true);
        } else {
          setIsOffline(true);
        }
      })
      .finally(() => setIsLoadingProviders(false));
  }, []);

  // Auto-focus search input
  useEffect(() => {
    if (cloneState.kind === "idle") inputRef.current?.focus();
  }, [cloneState.kind]);

  // Clean up CLI listeners on unmount
  useEffect(() => {
    return () => {
      window.cli?.removeAllOutputListeners();
      window.cli?.removeAllExitListeners();
      if (runIdRef.current) {
        window.cli?.abort({ runId: runIdRef.current }).catch(() => {});
      }
    };
  }, []);

  // Filtered provider list
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.display_name.toLowerCase().includes(q) ||
        (p.categories ?? []).some((c) => c.toLowerCase().includes(q))
    );
  }, [providers, query]);

  // Reset highlight on filter change
  useEffect(() => {
    setHighlightIdx(0);
  }, [filtered.length, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  // ESC to go back / close
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (cloneState.kind === "cloning") return; // prevent close during clone
      if (selected && cloneState.kind === "idle") {
        setSelected(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [cloneState.kind, selected, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selected || cloneState.kind !== "idle") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[highlightIdx]) {
        e.preventDefault();
        setSelected(filtered[highlightIdx]);
      }
    },
    [selected, cloneState.kind, filtered, highlightIdx]
  );

  const handleImport = useCallback(async () => {
    if (!selected || !window.project || !window.cli) return;

    setCloneState({ kind: "choosingDir" });

    // Ask user to pick a target directory
    const dirResult = await window.project.showDirectoryDialog();
    if (dirResult.status !== "ok" || !dirResult.data.filePath) {
      setCloneState({ kind: "idle" });
      return;
    }

    const targetDir = dirResult.data.filePath;
    setCloneState({ kind: "cloning", lines: [], targetDir });

    // Wire up CLI output/exit listeners
    const outputLines: string[] = [];

    window.cli.removeAllOutputListeners();
    window.cli.removeAllExitListeners();

    window.cli.onOutput((event) => {
      outputLines.push(event.line);
      setCloneState((s) =>
        s.kind === "cloning" ? { ...s, lines: [...outputLines] } : s
      );
    });

    window.cli.onExit((event) => {
      if (event.code === 0) {
        setCloneState({
          kind: "success",
          targetDir,
          providerName: selected.display_name,
        });
      } else {
        const errLine =
          outputLines.filter((l) => l.toLowerCase().includes("error")).at(-1) ??
          `Process exited with code ${event.code ?? "unknown"}`;
        setCloneState({ kind: "error", message: errLine });
      }
      runIdRef.current = null;
      window.cli.removeAllOutputListeners();
      window.cli.removeAllExitListeners();
    });

    try {
      const res = await window.cli.run({
        command: "nango",
        args: ["clone", selected.name],
        cwd: targetDir,
      });

      if (res.status === "ok") {
        runIdRef.current = res.data.runId;
      } else {
        setCloneState({ kind: "error", message: res.error ?? "Failed to start nango clone" });
        window.cli.removeAllOutputListeners();
        window.cli.removeAllExitListeners();
      }
    } catch (err) {
      setCloneState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to start nango clone",
      });
      window.cli.removeAllOutputListeners();
      window.cli.removeAllExitListeners();
    }
  }, [selected]);

  // ── Result states ──────────────────────────────────────────────────────────

  if (cloneState.kind === "success") {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-10 px-6 text-center">
          <span className="w-14 h-14 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center text-2xl text-[var(--color-success)]">
            ✓
          </span>
          <div>
            <p className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              Template imported!
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              <strong>{cloneState.providerName}</strong> template cloned into:
            </p>
            <p className="mt-1 text-xs font-mono text-[var(--color-text-secondary)] break-all">
              {cloneState.targetDir}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-[var(--color-brand-400)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </ModalShell>
    );
  }

  if (cloneState.kind === "cloning") {
    return (
      <ModalShell onClose={onClose} noDismiss>
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
            <SpinnerIcon />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Cloning template into{" "}
              <span className="font-mono text-xs">{cloneState.targetDir}</span>…
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-[var(--color-text-secondary)] space-y-0.5 bg-[var(--color-bg-base)]">
            {cloneState.lines.length === 0 && (
              <p className="animate-pulse">Starting nango clone…</p>
            )}
            {cloneState.lines.map((line, i) => (
              <p key={i} className="leading-5">{line}</p>
            ))}
          </div>
        </div>
      </ModalShell>
    );
  }

  if (cloneState.kind === "error") {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-10 px-6 text-center">
          <span className="w-14 h-14 rounded-full bg-[var(--color-error)]/15 flex items-center justify-center text-xl text-[var(--color-error)]">
            ✕
          </span>
          <div>
            <p className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              Import failed
            </p>
            <p className="text-sm text-[var(--color-error)] break-words">{cloneState.message}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCloneState({ kind: "idle" })}
              className="px-5 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-colors cursor-pointer"
            >
              Try again
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[var(--color-brand-400)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── Browse / detail view ───────────────────────────────────────────────────

  return (
    <ModalShell onClose={onClose}>
      <div className="flex h-full" onKeyDown={handleKeyDown}>
        {/* Left: search + list */}
        <div className="w-72 shrink-0 border-r border-[var(--color-border)] flex flex-col">
          {/* Search header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-secondary)] shrink-0">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              >
                <XIcon />
              </button>
            )}
          </div>

          {/* Offline badge */}
          {isOffline && (
            <div className="px-3 py-1.5 text-[10px] bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-b border-[var(--color-border)]">
              {providers.length > 0
                ? "Showing cached catalog — connect to Nango to refresh."
                : "Not connected. Connect a Nango API key to fetch templates."}
            </div>
          )}

          {/* Provider list */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-1">
            {isLoadingProviders && (
              <div className="flex items-center justify-center py-8 gap-2 text-[var(--color-text-secondary)]">
                <SpinnerIcon />
                <span className="text-xs">Loading…</span>
              </div>
            )}

            {!isLoadingProviders && filtered.length === 0 && (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-8 px-4">
                {query ? `No templates match "${query}"` : "No templates available."}
              </p>
            )}

            {filtered.map((provider, idx) => (
              <button
                key={provider.name}
                onClick={() => setSelected(provider)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                  selected?.name === provider.name
                    ? "bg-[var(--color-brand-400)]/15 text-[var(--color-brand-400)]"
                    : idx === highlightIdx
                    ? "bg-[var(--color-bg-surface)]"
                    : "hover:bg-[var(--color-bg-surface)]/60"
                }`}
              >
                {provider.logo_url ? (
                  <img
                    src={provider.logo_url}
                    alt=""
                    className="w-6 h-6 rounded object-contain bg-white shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-[var(--color-bg-overlay)] flex items-center justify-center text-[10px] font-semibold uppercase text-[var(--color-text-secondary)] shrink-0">
                    {provider.display_name[0] ?? "?"}
                  </div>
                )}
                <span className="text-sm truncate text-[var(--color-text-primary)]">
                  {provider.display_name}
                </span>
              </button>
            ))}
          </div>

          {/* Footer count */}
          <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)] tabular-nums">
            {!isLoadingProviders && `${filtered.length} template${filtered.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {/* Right: detail / empty state */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <span className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <DownloadIcon />
              </span>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Select a template
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Choose a provider on the left to preview its integration template,
                then import it into your workspace with <code className="font-mono">nango clone</code>.
              </p>
            </div>
          ) : (
            <TemplateDetail
              provider={selected}
              isChoosingDir={cloneState.kind === "choosingDir"}
              onImport={handleImport}
            />
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Template detail panel ──────────────────────────────────────────────────

interface TemplateDetailProps {
  provider: NangoProvider;
  isChoosingDir: boolean;
  onImport: () => void;
}

function TemplateDetail({ provider, isChoosingDir, onImport }: TemplateDetailProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Provider header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
        {provider.logo_url ? (
          <img
            src={provider.logo_url}
            alt=""
            className="w-10 h-10 rounded-lg object-contain bg-white shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)] uppercase shrink-0">
            {provider.display_name[0] ?? "?"}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{provider.display_name}</p>
          <p className="text-xs text-[var(--color-text-secondary)] font-mono">{provider.name}</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-5 py-4 flex-1 space-y-4 overflow-y-auto">
        <DetailRow label="Auth mode" value={provider.auth_mode} />
        {provider.categories?.length ? (
          <DetailRow label="Categories" value={provider.categories.join(", ")} />
        ) : null}
        {provider.docs && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">Docs</dt>
            <dd>
              <a
                href={provider.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-brand-400)] hover:underline"
              >
                View provider docs ↗
              </a>
            </dd>
          </div>
        )}

        {/* What gets cloned */}
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-3 text-xs text-[var(--color-text-secondary)] space-y-1.5">
          <p className="font-semibold text-[var(--color-text-primary)] mb-2">What gets imported</p>
          <p>
            Running <code className="font-mono text-[var(--color-brand-400)]">nango clone {provider.name}</code> downloads
            the official integration template into your chosen directory, including:
          </p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>Sync and action scripts</li>
            <li><code className="font-mono">nango.yaml</code> configuration</li>
            <li>TypeScript type definitions</li>
          </ul>
          <p className="mt-2">
            After importing, run{" "}
            <code className="font-mono text-[var(--color-brand-400)]">nango deploy</code>{" "}
            to push the integration to your Nango instance.
          </p>
        </div>
      </div>

      {/* Import CTA */}
      <div className="px-5 py-3 border-t border-[var(--color-border)] shrink-0">
        <button
          onClick={onImport}
          disabled={isChoosingDir}
          className="w-full py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-400)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isChoosingDir ? <SpinnerIcon /> : <DownloadIcon />}
          {isChoosingDir ? "Choosing directory…" : `Import ${provider.display_name} template`}
        </button>
        <p className="text-center text-[10px] text-[var(--color-text-secondary)] mt-1.5">
          You will be asked to choose a target directory.
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] text-right truncate">{value}</dd>
    </div>
  );
}

// ── Modal shell ────────────────────────────────────────────────────────────

function ModalShell({
  children,
  onClose,
  noDismiss = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  noDismiss?: boolean;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={noDismiss ? undefined : onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
        <div
          className="w-full max-w-3xl h-[520px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)] shrink-0">
            <span className="flex-1 text-sm font-semibold text-[var(--color-text-primary)]">
              Import Integration Template
            </span>
            {!noDismiss && (
              <button
                onClick={onClose}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <XIcon />
              </button>
            )}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
