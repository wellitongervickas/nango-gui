export function ErrorBanner({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] ${className}`}
    >
      {message}
    </div>
  );
}
