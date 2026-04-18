import { useEffect, useState } from "react";

/** Session-level cache: provider key → markdown (null = no readme). */
const readmeCache = new Map<string, string | null>();

interface UseIntegrationReadmeResult {
  markdown: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches and caches the integration readme for a given provider key.
 * The cache is kept in-memory for the session — re-opening the same
 * provider detail panel won't trigger a refetch.
 */
export function useIntegrationReadme(provider: string | null): UseIntegrationReadmeResult {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!provider) {
      setMarkdown(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Serve from cache if available
    if (readmeCache.has(provider)) {
      setMarkdown(readmeCache.get(provider) ?? null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchReadme() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await window.nango?.getIntegrationReadme({ provider: provider! });
        if (cancelled) return;

        if (!res || res.status === "error") {
          setError(res?.error ?? "Failed to load documentation");
          setIsLoading(false);
          return;
        }

        readmeCache.set(provider!, res.data.markdown);
        setMarkdown(res.data.markdown);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load documentation");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchReadme();
    return () => { cancelled = true; };
  }, [provider]);

  return { markdown, isLoading, error };
}
