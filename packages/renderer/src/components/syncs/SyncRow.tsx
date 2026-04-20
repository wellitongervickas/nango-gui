import { useState, useRef, useEffect } from "react";
import type { NangoSyncRecord } from "@nango-gui/shared";
import { useSyncsStore } from "@/store/syncsStore";
import { PlayIcon, PauseIcon, SpinnerIcon } from "@/components/icons";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/common/PermissionGate";

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
  const { triggerSync, pauseSync, startSync, updateSyncFrequency, syncActionLoading } = useSyncsStore();
  const isBusy = !!syncActionLoading[sync.name];
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingFrequency, setEditingFrequency] = useState(false);
  const [frequencyDraft, setFrequencyDraft] = useState("");
  const frequencyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingFrequency) {
      frequencyInputRef.current?.focus();
      frequencyInputRef.current?.select();
    }
  }, [editingFrequency]);

  function handleFrequencyClick() {
    if (isBusy) return;
    setFrequencyDraft(sync.frequency ?? "");
    setEditingFrequency(true);
  }

  async function commitFrequency() {
    setEditingFrequency(false);
    const trimmed = frequencyDraft.trim();
    if (trimmed === (sync.frequency ?? "")) return;
    setActionError(null);
    try {
      await updateSyncFrequency(
        providerConfigKey,
        sync.name,
        connectionId,
        trimmed || null
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Frequency update failed");
    }
  }

  function handleFrequencyKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitFrequency();
    } else if (e.key === "Escape") {
      setEditingFrequency(false);
    }
  }

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
        {editingFrequency ? (
          <input
            ref={frequencyInputRef}
            type="text"
            value={frequencyDraft}
            onChange={(e) => setFrequencyDraft(e.target.value)}
            onBlur={commitFrequency}
            onKeyDown={handleFrequencyKeyDown}
            className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)]"
            placeholder="e.g. every 5m"
          />
        ) : (
          <button
            type="button"
            onClick={handleFrequencyClick}
            disabled={isBusy}
            className="text-left truncate w-full hover:text-[var(--color-brand-500)] hover:underline cursor-pointer disabled:cursor-default disabled:hover:no-underline disabled:hover:text-[var(--color-text-secondary)]"
            title="Click to edit frequency"
          >
            {sync.frequency ?? "\u2014"}
          </button>
        )}
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
        <PermissionGate permission="production_actions">
          <button
            onClick={handleTrigger}
            disabled={isBusy}
            title="Trigger sync"
            className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/10 transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100"
            aria-label="Trigger sync"
          >
            {isBusy ? <SpinnerIcon /> : <PlayIcon />}
          </button>
        </PermissionGate>

        <PermissionGate permission="production_actions">
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
        </PermissionGate>
      </div>
    </div>
  );
}
