import { useCallback, useEffect, useState } from "react";
import type { McpIntegrationSummary } from "@nango-gui/shared";

interface UseMcpIntegrationsResult {
  /** Set of providerConfigKeys that have MCP actions. */
  mcpProviderKeys: Set<string>;
  /** Full summaries keyed by providerConfigKey. */
  mcpSummaries: Map<string, McpIntegrationSummary>;
  /** The MCP server endpoint URL. */
  mcpEndpoint: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches a summary of all integrations that have MCP-capable actions.
 * Returns a Set of providerConfigKeys for O(1) lookup in connection lists.
 */
export function useMcpIntegrations(): UseMcpIntegrationsResult {
  const [mcpProviderKeys, setMcpProviderKeys] = useState<Set<string>>(new Set());
  const [mcpSummaries, setMcpSummaries] = useState<Map<string, McpIntegrationSummary>>(new Map());
  const [mcpEndpoint, setMcpEndpoint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await window.nango?.listMcpIntegrations();
        if (cancelled) return;

        if (!res || res.status === "error") {
          setError(res?.error ?? "Failed to load MCP integrations");
          return;
        }

        const keys = new Set<string>(res.data.integrations.map((i: McpIntegrationSummary) => i.providerConfigKey));
        const summaries = new Map<string, McpIntegrationSummary>(res.data.integrations.map((i: McpIntegrationSummary) => [i.providerConfigKey, i] as const));
        setMcpProviderKeys(keys);
        setMcpSummaries(summaries);
        setMcpEndpoint(res.data.mcpEndpoint);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load MCP integrations");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [version]);

  return { mcpProviderKeys, mcpSummaries, mcpEndpoint, isLoading, error, refresh };
}
