import type { UserRole } from "@nango-gui/shared";
import { useRbac } from "../../hooks/useRbac";
import { useRbacStore } from "../../store/rbacStore";

const ROLE_STYLES: Record<UserRole, { dot: string; label: string }> = {
  full_access: {
    dot: "bg-[var(--color-success)]",
    label: "Full Access",
  },
  support: {
    dot: "bg-[var(--color-warning)]",
    label: "Support",
  },
  contributor: {
    dot: "bg-[var(--color-info)]",
    label: "Contributor",
  },
};

export function UserRoleBadge() {
  const { hasRbac, role } = useRbac();
  const currentUser = useRbacStore((s) => s.currentUser);

  if (!hasRbac) return null;

  const style = ROLE_STYLES[role];
  const displayName = currentUser?.name || "You";

  return (
    <div className="px-2 py-1.5 mb-1 flex items-center gap-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
        aria-label={`Your role: ${style.label}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text)] truncate leading-tight">
          {displayName}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">
          {style.label}
        </p>
      </div>
    </div>
  );
}
