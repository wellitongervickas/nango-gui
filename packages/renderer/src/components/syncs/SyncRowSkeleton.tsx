export function SyncRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 rounded bg-[var(--color-bg-overlay)]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-12 rounded bg-[var(--color-bg-overlay)]" />
      <div className="w-16" />
    </div>
  );
}
