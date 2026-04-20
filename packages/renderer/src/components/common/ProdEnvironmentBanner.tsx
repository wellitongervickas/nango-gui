import { useEnvironmentStore } from "../../store/environmentStore";
import { useRbac } from "../../hooks/useRbac";

export function ProdEnvironmentBanner() {
  const current = useEnvironmentStore((s) => s.current);
  const { hasRbac, role, isAdmin } = useRbac();

  if (current !== "production") return null;

  const ROLE_LABELS: Record<string, string> = {
    support: "Support",
    contributor: "Contributor",
  };
  const roleLabel = ROLE_LABELS[role];

  return (
    <div
      role="status"
      className="bg-[var(--color-warning)]/10 border-b border-[var(--color-warning)]/20 px-4 py-2 text-xs text-[var(--color-text)] shrink-0"
    >
      <span className="font-medium">Production environment</span>
      {" — "}
      {isAdmin || !hasRbac ? (
        <span>all actions affect live data</span>
      ) : (
        <span>
          changes affect live data. You have {roleLabel} role: destructive actions are disabled.
        </span>
      )}
    </div>
  );
}
