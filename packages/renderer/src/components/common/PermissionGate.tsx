import type { ReactNode } from "react";
import { useRbac } from "../../hooks/useRbac";
import { useEnvironmentStore } from "../../store/environmentStore";

type Permission =
  | "production_actions"
  | "manage_team"
  | "delete_connection"
  | "deploy_production";

const DEFAULT_TOOLTIPS: Record<Permission, string> = {
  production_actions: "Production actions require Full Access role",
  manage_team: "Only Full Access members can manage team roles",
  delete_connection: "Deleting connections requires Full Access role",
  deploy_production: "Deploying to production requires Full Access role",
};

interface PermissionGateProps {
  permission: Permission;
  mode?: "disable" | "hide";
  tooltipText?: string;
  children: ReactNode;
}

function useHasPermission(permission: Permission): boolean {
  const {
    hasRbac,
    canTriggerProductionActions,
    canManageTeam,
    canDeleteConnection,
    canDeployProduction,
  } = useRbac();
  const current = useEnvironmentStore((s) => s.current);

  if (!hasRbac) return true;

  switch (permission) {
    case "production_actions":
      return current !== "production" || canTriggerProductionActions;
    case "manage_team":
      return canManageTeam;
    case "delete_connection":
      return canDeleteConnection;
    case "deploy_production":
      return current !== "production" || canDeployProduction;
  }
}

export function PermissionGate({
  permission,
  mode = "disable",
  tooltipText,
  children,
}: PermissionGateProps) {
  const allowed = useHasPermission(permission);

  if (allowed) return <>{children}</>;

  if (mode === "hide") return null;

  const tooltip = tooltipText ?? DEFAULT_TOOLTIPS[permission];

  return (
    <div
      className="inline-flex opacity-50 cursor-not-allowed"
      aria-disabled="true"
      aria-description={tooltip}
      title={tooltip}
    >
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}
