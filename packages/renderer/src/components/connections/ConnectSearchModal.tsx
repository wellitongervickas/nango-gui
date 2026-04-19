import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Nango from "@nangohq/frontend";
import type { ConnectUI } from "@nangohq/frontend";
import type { ConnectUIEvent } from "@nangohq/frontend";
import type { AdvancedConnectionConfig, NangoProvider, NangoConnectionSummary } from "@nango-gui/shared";
import { useConnectFlowStore } from "@/store/connectFlowStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { SearchIcon, SpinnerIcon, XIcon, PlugIcon, ChevronIcon } from "@/components/icons";
import { AdvancedConnectionForm, validateAdvancedConfig } from "./AdvancedConnectionForm";
import type { ConnectError } from "@/lib/auth-errors";
import { getFriendlyErrorMessage, getErrorHighlightField, getErrorTitle, extractProviderDetail } from "@/lib/auth-errors";
import { buildConnectUIOptions } from "@/lib/connectUiOptions";

const ADVANCED_CONFIG_KEY = "nango-gui:advanced-connection-config";

function loadAdvancedConfig(providerName: string): AdvancedConnectionConfig {
  try {
    const raw = localStorage.getItem(ADVANCED_CONFIG_KEY);
    if (!raw) return {};
    const store = JSON.parse(raw) as Record<string, AdvancedConnectionConfig>;
    return store[providerName] ?? {};
  } catch {
    return {};
  }
}

function saveAdvancedConfig(providerName: string, cfg: AdvancedConnectionConfig) {
  try {
    const raw = localStorage.getItem(ADVANCED_CONFIG_KEY);
    const store: Record<string, AdvancedConnectionConfig> = raw ? JSON.parse(raw) : {};
    const isEmpty =
      !cfg.oauthClientId &&
      !cfg.oauthClientSecret &&
      !(cfg.userScopes ?? []).length &&
      !Object.keys(cfg.authParams ?? {}).some(Boolean);
    if (isEmpty) {
      delete store[providerName];
    } else {
      store[providerName] = cfg;
    }
    localStorage.setItem(ADVANCED_CONFIG_KEY, JSON.stringify(store));
  } catch {
    // non-critical
  }
}

type FlowState =
  | { kind: "search" }
  | { kind: "configure"; provider: NangoProvider }
  | { kind: "connecting"; provider: NangoProvider }
  | { kind: "open"; provider: NangoProvider }
  | { kind: "error"; message: string };

interface SuccessToast {
  provider: string;
  syncCount: number;
}

export function ConnectSearchModal() {
  const isOpen = useConnectFlowStore((s) => s.isSearchOpen);
  const closeSearch = useConnectFlowStore((s) => s.closeSearch);

  if (!isOpen) return null;
  return <ConnectSearchModalInner onClose={closeSearch} />;
}

function ConnectSearchModalInner({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [providers, setProviders] = useState<NangoProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [flowState, setFlowState] = useState<FlowState>({ kind: "search" });
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [toast, setToast] = useState<SuccessToast | null>(null);
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConnectionConfig>({});
  const [advancedErrors, setAdvancedErrors] = useState<ReturnType<typeof validateAdvancedConfig>>({});
  const [connectError, setConnectError] = useState<ConnectError | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const connectUIRef = useRef<ConnectUI | null>(null);
  const closedRef = useRef(false);
  /** Tracks the full provider object during connecting/open so we can return to configure on error. */
  const lastProviderRef = useRef<NangoProvider | null>(null);

  const connections = useConnectionsStore((s) => s.connections);
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections);
  const addConnection = useConnectionsStore((s) => s.addConnection);
  const connectUiTheme = useSettingsStore((s) => s.connectUiTheme);
  const connectUiPrimaryColor = useSettingsStore((s) => s.connectUiPrimaryColor);

  // Load providers on mount
  useEffect(() => {
    if (!window.nango) return;
    setIsLoadingProviders(true);
    window.nango
      .listProviders()
      .then((res) => {
        if (res.status === "ok") setProviders(res.data);
      })
      .finally(() => setIsLoadingProviders(false));
  }, []);

  // Auto-focus input when in search state
  useEffect(() => {
    if (flowState.kind === "search") {
      inputRef.current?.focus();
    }
  }, [flowState.kind]);

  // Clean up ConnectUI on unmount
  useEffect(() => {
    return () => {
      connectUIRef.current?.close();
    };
  }, []);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  // Filter providers
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

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [filtered.length, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  // Existing connections keyed by provider name for Smart Connect
  const connectedProviders = useMemo(() => {
    const map = new Map<string, NangoConnectionSummary[]>();
    for (const c of connections) {
      const key = (c.provider ?? c.provider_config_key).toLowerCase();
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [connections]);

  const handleEvent = useCallback(
    async (event: ConnectUIEvent) => {
      switch (event.type) {
        case "close":
          closedRef.current = true;
          connectUIRef.current?.close();
          connectUIRef.current = null;
          setFlowState({ kind: "search" });
          break;

        case "connect": {
          const { connectionId, providerConfigKey } = event.payload;
          addConnection({
            id: 0,
            connection_id: connectionId,
            provider: providerConfigKey,
            provider_config_key: providerConfigKey,
            created: new Date().toISOString(),
            metadata: null,
          });
          // Fetch full connections list and count syncs
          await fetchConnections();
          closedRef.current = true;
          connectUIRef.current?.close();
          connectUIRef.current = null;

          // Count syncs for the toast
          let syncCount = 0;
          try {
            const syncsRes = await window.nango?.listSyncs({
              providerConfigKey,
              connectionId,
            });
            if (syncsRes?.status === "ok") {
              syncCount = syncsRes.data.length;
            }
          } catch {
            // non-critical — just show 0
          }

          setToast({ provider: providerConfigKey, syncCount });
          break;
        }

        case "error": {
          closedRef.current = true;
          connectUIRef.current?.close();
          connectUIRef.current = null;
          const { errorType, errorMessage } = event.payload;
          const err: ConnectError = {
            errorType,
            message: getFriendlyErrorMessage(errorType, errorMessage),
            providerError: extractProviderDetail(errorType, errorMessage),
            highlightField: getErrorHighlightField(errorType, errorMessage),
          };
          // Return to the configure step so the user can adjust settings and retry.
          if (lastProviderRef.current) {
            setConnectError(err);
            setFlowState({ kind: "configure", provider: lastProviderRef.current });
          } else {
            setFlowState({ kind: "error", message: err.message });
          }
          break;
        }
      }
    },
    [addConnection, fetchConnections]
  );

  // Select a provider → show configure step
  const selectProvider = useCallback((provider: NangoProvider) => {
    const saved = loadAdvancedConfig(provider.name);
    setAdvancedConfig(saved);
    setAdvancedErrors({});
    setConnectError(null);
    lastProviderRef.current = provider;
    setFlowState({ kind: "configure", provider });
  }, []);

  // Launch ConnectUI after configure step
  const launchConnect = useCallback(
    async (provider: NangoProvider, cfg: AdvancedConnectionConfig) => {
      if (!window.nango) {
        setFlowState({ kind: "error", message: "Nango API not available" });
        return;
      }

      // Validate before proceeding
      const errs = validateAdvancedConfig(cfg);
      if (Object.keys(errs).length > 0) {
        setAdvancedErrors(errs);
        return;
      }

      // Persist for reconnection flows
      saveAdvancedConfig(provider.name, cfg);

      closedRef.current = false;
      setConnectError(null);
      lastProviderRef.current = provider;
      setFlowState({ kind: "connecting", provider });

      try {
        // Build integrationsConfigDefaults only when advanced config is non-empty
        const hasAdvanced =
          cfg.oauthClientId ||
          cfg.oauthClientSecret ||
          (cfg.userScopes ?? []).length > 0 ||
          Object.keys(cfg.authParams ?? {}).some(Boolean);

        const res = await Promise.race([
          window.nango.createConnectSession({
            endUserId: "local-user",
            endUserDisplayName: "Local User",
            allowedIntegrations: [provider.name],
            ...(hasAdvanced
              ? { integrationsConfigDefaults: { [provider.name]: cfg } }
              : {}),
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Connection timed out. Check that your Nango server is reachable.")),
              15_000
            )
          ),
        ]);

        if (res.status === "error") {
          setFlowState({ kind: "error", message: res.error });
          return;
        }

        if (closedRef.current) return;

        const nango = new Nango({ connectSessionToken: res.data.token });
        const connectUI = nango.openConnectUI({
          onEvent: handleEvent,
          ...buildConnectUIOptions(connectUiTheme, connectUiPrimaryColor),
        });
        connectUIRef.current = connectUI;
        connectUI.open();

        if (!closedRef.current) {
          setFlowState({ kind: "open", provider });
        }
      } catch (err) {
        setFlowState({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to connect",
        });
      }
    },
    [handleEvent]
  );

  // Keyboard navigation (search state only)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flowState.kind !== "search") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[highlightIdx]) {
        e.preventDefault();
        selectProvider(filtered[highlightIdx]);
      }
    },
    [flowState.kind, filtered, highlightIdx, selectProvider]
  );

  // ESC handling
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (flowState.kind === "error") {
          setFlowState({ kind: "search" });
        } else if (flowState.kind === "configure") {
          setFlowState({ kind: "search" });
        } else if (flowState.kind === "open" || flowState.kind === "connecting") {
          connectUIRef.current?.close();
          connectUIRef.current = null;
          closedRef.current = true;
          setFlowState({ kind: "search" });
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [flowState.kind, onClose]);

  // Success toast overlay
  if (toast) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-success)]/30 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 animate-in slide-in-from-top-2">
          <span className="w-8 h-8 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center text-[var(--color-success)]">
            <PlugIcon />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {toast.provider} connected
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {toast.syncCount > 0
                ? `${toast.syncCount} sync${toast.syncCount === 1 ? " is" : "s are"} now running.`
                : "No syncs configured yet."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Connecting / open overlay — show cancel button over the Nango iframe
  if (flowState.kind === "connecting" || flowState.kind === "open") {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-end justify-center pb-6"
        onClick={() => {
          connectUIRef.current?.close();
          connectUIRef.current = null;
          closedRef.current = true;
          setFlowState({ kind: "search" });
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            connectUIRef.current?.close();
            connectUIRef.current = null;
            closedRef.current = true;
            setFlowState({ kind: "search" });
          }}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-xl hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
        >
          {flowState.kind === "connecting" ? "Cancel" : "Close"}
        </button>
      </div>
    );
  }

  // Configure step — show provider info + advanced section before launching
  if (flowState.kind === "configure") {
    const { provider } = flowState;
    const existing = connectedProviders.get(provider.name.toLowerCase());

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setFlowState({ kind: "search" })}
        />

        {/* Modal */}
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div
            className="w-full max-w-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
              <button
                onClick={() => setFlowState({ kind: "search" })}
                className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                aria-label="Back to search"
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">
                Configure connection
              </span>
              <button
                onClick={onClose}
                className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            {/* Provider summary */}
            <div className="px-4 pt-4 flex items-center gap-3">
              {provider.logo_url ? (
                <img
                  src={provider.logo_url}
                  alt=""
                  className="w-10 h-10 rounded-lg object-contain bg-white p-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)] uppercase">
                  {provider.display_name[0] ?? "?"}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {provider.display_name}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {provider.auth_mode}
                  {provider.categories?.length
                    ? ` · ${provider.categories.slice(0, 2).join(", ")}`
                    : ""}
                </p>
              </div>
              {existing && existing.length > 0 && (
                <span className="ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)] font-medium">
                  {existing.length} connected
                </span>
              )}
            </div>

            {/* Inline validation error — shown when Connect UI returns an error */}
            {connectError && (
              <div className="mx-4 mt-3 px-3 py-2.5 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-sm text-[var(--color-error)] space-y-1">
                <p className="font-medium">{getErrorTitle(connectError.errorType)}</p>
                <p className="text-xs leading-relaxed opacity-90">{connectError.message}</p>
              </div>
            )}

            {/* Advanced section */}
            <div className="px-4 pt-3 pb-4">
              <AdvancedConnectionForm
                providerName={provider.display_name}
                value={advancedConfig}
                onChange={(cfg) => {
                  setAdvancedConfig(cfg);
                  setAdvancedErrors({});
                }}
                errors={advancedErrors}
                serverHighlightField={connectError?.highlightField}
              />
            </div>

            {/* Connect button (changes label to "Retry" after an error) */}
            <div className="px-4 pb-4">
              <button
                onClick={() => launchConnect(provider, advancedConfig)}
                className="w-full py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-400)] text-white hover:bg-[var(--color-brand-400)]/90 transition-colors cursor-pointer"
              >
                {connectError ? `Retry — ${provider.display_name}` : `Connect to ${provider.display_name}`}
              </button>
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
              <span>
                <kbd className="font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] px-1 rounded">esc</kbd> back
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        onKeyDown={handleKeyDown}
      >
        <div
          className="w-full max-w-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-secondary)]">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search integrations…"
              className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded">
              ESC
            </kbd>
          </div>

          {/* Error banner */}
          {flowState.kind === "error" && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-sm text-[var(--color-error)] flex items-center gap-2">
              <span className="flex-1">{flowState.message}</span>
              <button
                onClick={() => setFlowState({ kind: "search" })}
                className="shrink-0 text-[var(--color-error)]/70 hover:text-[var(--color-error)] cursor-pointer"
              >
                <XIcon />
              </button>
            </div>
          )}

          {/* Provider list */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1">
            {isLoadingProviders && (
              <div className="flex items-center justify-center py-8 text-[var(--color-text-secondary)]">
                <SpinnerIcon />
                <span className="ml-2 text-sm">Loading integrations…</span>
              </div>
            )}

            {!isLoadingProviders && filtered.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {query ? `No integrations match "${query}"` : "No integrations available"}
                </p>
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}

            {filtered.map((provider, idx) => {
              const existing = connectedProviders.get(provider.name.toLowerCase());
              const isHighlighted = idx === highlightIdx;

              return (
                <button
                  key={provider.name}
                  onClick={() => selectProvider(provider)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                    isHighlighted
                      ? "bg-[var(--color-primary)]/10"
                      : "hover:bg-[var(--color-bg-base)]/50"
                  }`}
                >
                  {/* Provider logo */}
                  {provider.logo_url ? (
                    <img
                      src={provider.logo_url}
                      alt=""
                      className="w-8 h-8 rounded-md object-contain bg-white p-0.5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                      {provider.display_name[0] ?? "?"}
                    </div>
                  )}

                  {/* Provider info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {provider.display_name}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                      {provider.auth_mode}
                      {provider.categories?.length
                        ? ` · ${provider.categories.slice(0, 2).join(", ")}`
                        : ""}
                    </p>
                  </div>

                  {/* Smart Connect — duplicate badge */}
                  {existing && existing.length > 0 && (
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)] font-medium whitespace-nowrap">
                      {existing.length} connected
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-text-secondary)]">
            <span>
              <kbd className="font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] px-1 rounded">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] px-1 rounded">↵</kbd> connect
            </span>
            <span>
              <kbd className="font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] px-1 rounded">esc</kbd> close
            </span>
            <span className="ml-auto tabular-nums">
              {!isLoadingProviders && `${filtered.length} integration${filtered.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
