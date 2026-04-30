import { useSettingsStore } from "../store/settingsStore";

/**
 * RBAC state derived from the connected Nango server.
 *
 * The desktop app authenticates with an environment-scoped secret key, not a
 * user identity, so there is no reliable way to know which Nango user is at
 * the keyboard. We therefore intentionally **do not** expose per-user role
 * information or `can*` permission flags — shipping misleading permission
 * enforcement (where every check secretly resolves to "allowed") is worse
 * than shipping none at all.
 *
 * What we surface honestly:
 * - `hasRbac` — whether the connected Nango environment has RBAC enabled.
 * - `isProduction` — whether the connected Nango environment is flagged as
 *   production. Used together with `hasRbac` to render the
 *   {@link ../components/common/ProdEnvironmentBanner.tsx ProdEnvironmentBanner}.
 */
export function useRbac(): {
  hasRbac: boolean;
  isProduction: boolean;
} {
  const hasRbac = useSettingsStore((s) => s.hasRbac);
  const isProduction = useSettingsStore((s) => s.isProduction);
  return { hasRbac, isProduction };
}
