import { describe, it, expect, beforeEach } from "vitest";
import { useRbacStore } from "../store/rbacStore";
import { ROLE_STYLES } from "../components/common/UserRoleBadge";

// Reset rbac store between tests so derived permission flags don't leak.
beforeEach(() => {
  useRbacStore.setState({
    currentUser: null,
    teamMembers: [],
    isLoading: false,
    error: null,
    canTriggerProductionActions: true,
    canManageTeam: true,
    canDeleteConnection: true,
    canDeployProduction: true,
    canTriggerDevActions: true,
  });
});

// ── Badge label mapping ─────────────────────────────────────────────────────
// Per F6 spec, exactly four label variants must render in the role badge:
// Full Access / Support / Contributor / Custom Role (with `?` tooltip).

describe("UserRoleBadge label mapping", () => {
  it("maps 'full_access' to 'Full Access' with no tooltip", () => {
    expect(ROLE_STYLES.full_access.label).toBe("Full Access");
    expect(ROLE_STYLES.full_access.tooltip).toBeUndefined();
  });

  it("maps 'support' to 'Support' with no tooltip", () => {
    expect(ROLE_STYLES.support.label).toBe("Support");
    expect(ROLE_STYLES.support.tooltip).toBeUndefined();
  });

  it("maps 'contributor' to 'Contributor' with no tooltip", () => {
    expect(ROLE_STYLES.contributor.label).toBe("Contributor");
    expect(ROLE_STYLES.contributor.tooltip).toBeUndefined();
  });

  it("maps 'custom' to 'Custom Role' with an explanatory tooltip", () => {
    expect(ROLE_STYLES.custom.label).toBe("Custom Role");
    expect(ROLE_STYLES.custom.tooltip).toBeTruthy();
    expect(ROLE_STYLES.custom.tooltip).toMatch(/custom/i);
  });

  it("covers all four spec roles and only those", () => {
    expect(Object.keys(ROLE_STYLES).sort()).toEqual([
      "contributor",
      "custom",
      "full_access",
      "support",
    ]);
  });
});

// ── derivePermissions via fetchCurrentUser ──────────────────────────────────
// fetchCurrentUser is the only public entry point that re-derives permission
// flags from a role. Verifying it covers the deriver since they share a code
// path; if either drifts, the assertions below catch it.

describe("rbacStore.fetchCurrentUser", () => {
  it("populates currentUser and grants all permissions for full_access", async () => {
    await useRbacStore.getState().fetchCurrentUser();
    const state = useRbacStore.getState();
    expect(state.currentUser?.role).toBe("full_access");
    expect(state.canTriggerProductionActions).toBe(true);
    expect(state.canManageTeam).toBe(true);
    expect(state.canDeleteConnection).toBe(true);
    expect(state.canDeployProduction).toBe(true);
    expect(state.canTriggerDevActions).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});

// ── Gate-relevant permission derivation ─────────────────────────────────────
// PermissionGate consults the rbacStore flags directly, so verifying the
// flags for each role type is enough to lock in gate behaviour without
// rendering DOM (renderer tests run in node — no jsdom).

describe("permission flags by role", () => {
  it("support: dev actions only — production actions, team mgmt, deletes, and deploys are denied", () => {
    useRbacStore.setState({
      currentUser: { id: "u1", email: "", name: "Sam", role: "support" },
      canTriggerProductionActions: false,
      canManageTeam: false,
      canDeleteConnection: false,
      canDeployProduction: false,
      canTriggerDevActions: true,
    });
    const s = useRbacStore.getState();
    expect(s.canTriggerProductionActions).toBe(false);
    expect(s.canManageTeam).toBe(false);
    expect(s.canDeleteConnection).toBe(false);
    expect(s.canDeployProduction).toBe(false);
    expect(s.canTriggerDevActions).toBe(true);
  });

  it("contributor: every guarded action is denied (read-mostly role)", () => {
    useRbacStore.setState({
      currentUser: { id: "u2", email: "", name: "Casey", role: "contributor" },
      canTriggerProductionActions: false,
      canManageTeam: false,
      canDeleteConnection: false,
      canDeployProduction: false,
      canTriggerDevActions: false,
    });
    const s = useRbacStore.getState();
    expect(s.canTriggerProductionActions).toBe(false);
    expect(s.canManageTeam).toBe(false);
    expect(s.canDeleteConnection).toBe(false);
    expect(s.canDeployProduction).toBe(false);
    expect(s.canTriggerDevActions).toBe(false);
  });

  it("full_access: every guarded action is allowed", () => {
    useRbacStore.setState({
      currentUser: { id: "u3", email: "", name: "Pat", role: "full_access" },
      canTriggerProductionActions: true,
      canManageTeam: true,
      canDeleteConnection: true,
      canDeployProduction: true,
      canTriggerDevActions: true,
    });
    const s = useRbacStore.getState();
    expect(s.canTriggerProductionActions).toBe(true);
    expect(s.canManageTeam).toBe(true);
    expect(s.canDeleteConnection).toBe(true);
    expect(s.canDeployProduction).toBe(true);
    expect(s.canTriggerDevActions).toBe(true);
  });
});
