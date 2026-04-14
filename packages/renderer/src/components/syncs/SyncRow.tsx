import { useState } from "react";
import type { NangoSyncRecord } from "@nango-gui/shared";
import { useSyncsStore } from "@/store/syncsStore";
import { PlayIcon, PauseIcon, SpinnerIcon } from "@/components/icons";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SyncRow({
  sync,
  providerConfigKey,
  connectionId,
}: {
  sync: NangoSyncRecord;
  providerConfigKey: string;
  connectionId: string;
}) {
  const { triggerSync, pauseSync, startSync, syncActionLoading } = useSyncsStore();
  const isBusy = !!syncActionLoading[sync.name];
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleTrigger() {
    setActionError(null);
    try {
      await triggerSync(providerConfigKey, sync.name, connectionId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Trigger failed");
    }
  }

  async function handleTogglePause() {
    setActionError(null);
    try {
      if (sync.status === "PAUSED") {
        await startSync(providerConfigKey, sync.name, connectionId);
      } else {
        await pauseSync(providerConfigKey, sync.name, connectionId);
      }
    } catch (err) {
      const action = sync.status === "PAUSED" ? "start" : "pause";
      setActionError(err instanceof Error ? err.message : `${action} failed`);
    }
  }

  const recordCount = sync.latestResult
    ? sync.latestResult.added + sync.latestResult.updated + sync.latestResult.deleted
    : null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] font-mono truncate">
          {sync.name}
        </p>
        {actionError && (
          <p className="text-xs text-[var(--color-error)] mt-0.5 truncate">{actionError}</p>
        )}
      </div>

      <div className="w-24">
        <StatusBadge status={sync.status} />
      </div>

      <div className="w-28 text-xs text-[var(--color-text-secondary)] truncate">
        {sync.frequency ?? "\u2014"}
      </div>

      <div className="w-40 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDate(sync.finishedAt)}
      </div>

      <div className="w-40 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDate(sync.nextScheduledSyncAt)}
      </div>

      <div className="w-20 text-xs text-[var(--color-text-secondary)] text-right tabular-nums">
        {recordCount != null ? recordCount.toLocaleString() : "\u2014"}
      </div>

      <div className="w-20 flex items-center gap-1 justify-end">
        <button
          onClick={handleTrigger}
          disabled={isBusy}
          title="Trigger sync"
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/10 transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100"
          aria-label="Trigger sync"
        >
          {isBusy ? <SpinnerIcon /> : <PlayIcon />}
        </button>

        <button
          onClick={handleTogglePause}
          disabled={isBusy || sync.status === "STOPPED"}
          title={sync.status === "PAUSED" ? "Resume sync" : "Pause sync"}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100",
            sync.status === "PAUSED"
              ? "text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
              : "text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
          )}
          aria-label={sync.status === "PAUSED" ? "Resume sync" : "Pause sync"}
        >
          {isBusy ? (
            <SpinnerIcon />
          ) : sync.status === "PAUSED" ? (
            <PlayIcon />
          ) : (
            <PauseIcon />
          )}
        </button>
      </div>
    </div>
  );
}
