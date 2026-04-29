import type { UserRole } from "@nango-gui/shared";
import { useRbac } from "../../hooks/useRbac";
import { useRbacStore } from "../../store/rbacStore";

interface RoleStyle {
  dot: string;
  label: string;
  /** Tooltip shown on hover (used for custom/unknown roles per F6 spec). */
  tooltip?: string;
}

export const ROLE_STYLES: Record<UserRole, RoleStyle> = {
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
  custom: {
    dot: "bg-[var(--color-text-muted)]",
    label: "Custom Role",
    tooltip:
      "Custom Role — your Nango admin has assigned you a non-standard set of permissions. Contact your admin for details.",
  },
};

export function UserRoleBadge() {
  const { hasRbac, role } = useRbac();
  const currentUser = useRbacStore((s) => s.currentUser);

  if (!hasRbac) return null;

  const style = ROLE_STYLES[role] ?? ROLE_STYLES.custom;
  const displayName = currentUser?.name || "You";

  return (
    <div
      className="px-2 py-1.5 mb-1 flex items-center gap-1.5"
      title={style.tooltip}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
        aria-label={`Your role: ${style.label}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text)] truncate leading-tight">
          {displayName}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-tight flex items-center gap-1">
          <span>{style.label}</span>
          {style.tooltip && (
            <span
              aria-label={style.tooltip}
              className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-[var(--color-text-muted)] text-[8px] text-[var(--color-text-muted)] leading-none"
            >
              ?
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
