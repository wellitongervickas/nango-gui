import { useCallback, useEffect, useState } from "react";
import type { McpToolEntry } from "@nango-gui/shared";

interface UseIntegrationMcpToolsResult {
  tools: McpToolEntry[];
  mcpEndpoint: string | null;
  providerConfigKey: string | null;
  isLoading: boolean;
  error: string | null;
  toggleTool: (tool: McpToolEntry) => Promise<void>;
}

/**
 * Fetches MCP tool configuration (Nango Actions) for a given provider key.
 * Provides a `toggleTool` callback to enable/disable individual tools.
 */
export function useIntegrationMcpTools(provider: string | null): UseIntegrationMcpToolsResult {
  const [tools, setTools] = useState<McpToolEntry[]>([]);
  const [mcpEndpoint, setMcpEndpoint] = useState<string | null>(null);
  const [providerConfigKey, setProviderConfigKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider) {
      setTools([]);
      setMcpEndpoint(null);
      setProviderConfigKey(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchTools() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await window.nango?.getMcpTools({ provider: provider! });
        if (cancelled) return;

        if (!res || res.status === "error") {
          setError(res?.error ?? "Failed to load MCP tools");
          setIsLoading(false);
          return;
        }

        setTools(res.data.tools);
        setMcpEndpoint(res.data.mcpEndpoint);
        setProviderConfigKey(res.data.providerConfigKey);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load MCP tools");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchTools();
    return () => { cancelled = true; };
  }, [provider]);

  const toggleTool = useCallback(async (tool: McpToolEntry) => {
    if (!provider || !providerConfigKey) return;

    const newEnabled = !tool.enabled;

    // Optimistic update
    setTools((prev) =>
      prev.map((t) =>
        t.id === tool.id ? { ...t, enabled: newEnabled } : t
      )
    );

    try {
      const res = await window.nango?.setMcpToolEnabled({
        flowId: tool.id,
        provider,
        providerConfigKey,
        scriptName: tool.name,
        enabled: newEnabled,
      });

      if (!res || res.status === "error") {
        // Revert on failure
        setTools((prev) =>
          prev.map((t) =>
            t.id === tool.id ? { ...t, enabled: tool.enabled } : t
          )
        );
        setError(res?.error ?? "Failed to update tool");
      }
    } catch (err) {
      // Revert on failure
      setTools((prev) =>
        prev.map((t) =>
          t.id === tool.id ? { ...t, enabled: tool.enabled } : t
        )
      );
      setError(err instanceof Error ? err.message : "Failed to update tool");
    }
  }, [provider, providerConfigKey]);

  return { tools, mcpEndpoint, providerConfigKey, isLoading, error, toggleTool };
}
