import { ChevronSortIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type SyncSortKey = "name" | "status" | "frequency" | "finishedAt" | "nextScheduledSyncAt";
export type SortDir = "asc" | "desc";

export function SortHeader({
  label,
  sortKey: key,
  current,
  dir,
  onToggle,
  className,
}: {
  label: string;
  sortKey: SyncSortKey;
  current: SyncSortKey;
  dir: SortDir;
  onToggle: (k: SyncSortKey) => void;
  className?: string;
}) {
  const active = current === key;
  return (
    <button
      onClick={() => onToggle(key)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors",
        active
          ? "text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        className
      )}
    >
      {label}
      {active && <ChevronSortIcon direction={dir === "asc" ? "up" : "down"} />}
    </button>
  );
}
