import { useRbac } from "../../hooks/useRbac";

/**
 * Persistent banner shown across every page when the connected Nango
 * environment is flagged as production AND the underlying account has RBAC
 * enabled. It is intentionally environment-scoped — not user-scoped — because
 * the desktop app cannot identify which Nango user is at the keyboard
 * (authentication uses a secret key, not a user session).
 */
export function ProdEnvironmentBanner() {
  const { hasRbac, isProduction } = useRbac();

  if (!hasRbac || !isProduction) return null;

  return (
    <div
      role="status"
      data-testid="prod-environment-banner"
      className="bg-[var(--color-warning)]/10 border-b border-[var(--color-warning)]/20 px-4 py-2 text-xs text-[var(--color-text)] shrink-0"
    >
      <span className="font-medium">Production environment</span>
      {" — all actions affect live data."}
    </div>
  );
}
