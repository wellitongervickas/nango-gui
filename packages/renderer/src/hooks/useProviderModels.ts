import { useCallback, useEffect, useState } from "react";
import type { ModelDownloadFormat } from "@nango-gui/shared";

/** Session-level cache: provider key → whether models exist. */
const modelsExistCache = new Map<string, boolean>();

interface UseProviderModelsResult {
  hasModels: boolean | null;
  isChecking: boolean;
  isDownloading: boolean;
  download: (format: ModelDownloadFormat) => Promise<void>;
}

/**
 * Checks whether a provider has typed models and exposes a download helper.
 * The existence check is cached per session to avoid repeated fetches.
 */
export function useProviderModels(provider: string | null): UseProviderModelsResult {
  const [hasModels, setHasModels] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!provider) {
      setHasModels(null);
      setIsChecking(false);
      return;
    }

    if (modelsExistCache.has(provider)) {
      setHasModels(modelsExistCache.get(provider)!);
      setIsChecking(false);
      return;
    }

    let cancelled = false;

    async function check() {
      setIsChecking(true);
      try {
        // Probe with json-schema format just to check existence
        const res = await window.nango?.getProviderModels({
          provider: provider!,
          format: "json-schema",
        });
        if (cancelled) return;

        const exists = res?.status === "ok" && res.data.hasModels;
        modelsExistCache.set(provider!, exists);
        setHasModels(exists);
      } catch {
        if (cancelled) return;
        setHasModels(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [provider]);

  const download = useCallback(async (format: ModelDownloadFormat) => {
    if (!provider) return;

    setIsDownloading(true);
    try {
      const res = await window.nango?.getProviderModels({ provider, format });
      if (!res || res.status === "error" || !res.data.hasModels) return;

      const blob = new Blob([res.data.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [provider]);

  return { hasModels, isChecking, isDownloading, download };
}
