import type { NangoSyncStatus } from "@nango-gui/shared";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<NangoSyncStatus, { bg: string; text: string; dot: string }> = {
  RUNNING: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  SUCCESS: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  PAUSED:  { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]" },
  ERROR:   { bg: "bg-[var(--color-error)]/15",   text: "text-[var(--color-error)]",   dot: "bg-[var(--color-error)]" },
  STOPPED: { bg: "bg-[var(--color-text-secondary)]/15", text: "text-[var(--color-text-secondary)]", dot: "bg-[var(--color-text-secondary)]" },
};

export function StatusBadge({ status }: { status: NangoSyncStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.STOPPED;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", style.bg, style.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
      {status.toLowerCase()}
    </span>
  );
}
