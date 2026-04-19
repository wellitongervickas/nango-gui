import { useSettingsStore } from "../store/settingsStore";

/**
 * Returns the current RBAC state derived from the connected Nango server.
 *
 * - `hasRbac`: true when RBAC is enabled on the Nango server.
 * - `isAdmin`: always true for desktop users — the secret key grants full
 *   admin access regardless of server RBAC state.
 *
 * When `hasRbac` is false, role-gated UI elements should render normally.
 * When `hasRbac` is true, show the role badge and apply any role-specific
 * presentation (currently admin-only; viewer role would be a separate concern).
 */
export function useRbac(): { hasRbac: boolean; isAdmin: boolean } {
  const hasRbac = useSettingsStore((s) => s.hasRbac);
  return { hasRbac, isAdmin: true };
}
