export function StatusBar() {
  return (
    <footer className="h-7 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center px-4 shrink-0">
      <span className="text-[10px] text-[var(--color-text-muted)]">
        Nango Builder v0.1.0
      </span>
      <div className="flex-1" />
      <span className="text-[10px] text-[var(--color-text-muted)]">Ready</span>
    </footer>
  );
}
