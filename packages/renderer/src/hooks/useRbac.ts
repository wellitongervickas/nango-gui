import { useSettingsStore } from "../store/settingsStore";
import { useRbacStore } from "../store/rbacStore";
import type { UserRole } from "@nango-gui/shared";

/**
 * Returns the current RBAC state derived from the connected Nango server
 * and the local rbacStore.
 *
 * - `hasRbac`: true when RBAC is enabled on the Nango server.
 * - `isAdmin`: true when the current user has `full_access` role.
 * - `role`: the current user's role (`full_access`, `support`, `contributor`).
 *
 * Permission booleans mirror the rbacStore — when `hasRbac` is false,
 * all permissions are granted unconditionally.
 */
export function useRbac(): {
  hasRbac: boolean;
  isAdmin: boolean;
  role: UserRole;
  canTriggerProductionActions: boolean;
  canManageTeam: boolean;
  canDeleteConnection: boolean;
  canDeployProduction: boolean;
  canTriggerDevActions: boolean;
} {
  const hasRbac = useSettingsStore((s) => s.hasRbac);
  const currentUser = useRbacStore((s) => s.currentUser);
  const canTriggerProductionActions = useRbacStore((s) => s.canTriggerProductionActions);
  const canManageTeam = useRbacStore((s) => s.canManageTeam);
  const canDeleteConnection = useRbacStore((s) => s.canDeleteConnection);
  const canDeployProduction = useRbacStore((s) => s.canDeployProduction);
  const canTriggerDevActions = useRbacStore((s) => s.canTriggerDevActions);

  const role = currentUser?.role ?? "full_access";

  // When RBAC is disabled, grant all permissions
  if (!hasRbac) {
    return {
      hasRbac: false,
      isAdmin: true,
      role: "full_access",
      canTriggerProductionActions: true,
      canManageTeam: true,
      canDeleteConnection: true,
      canDeployProduction: true,
      canTriggerDevActions: true,
    };
  }

  return {
    hasRbac,
    isAdmin: role === "full_access",
    role,
    canTriggerProductionActions,
    canManageTeam,
    canDeleteConnection,
    canDeployProduction,
    canTriggerDevActions,
  };
}
