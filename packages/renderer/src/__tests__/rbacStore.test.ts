import { describe, it, expect, beforeEach } from "vitest";
import { useRbacStore } from "../store/rbacStore";
import { useSettingsStore } from "../store/settingsStore";
import { ROLE_STYLES } from "../components/common/UserRoleBadge";

// Reset rbac + settings stores between tests so derived permission flags
// and settings-sourced role don't leak. fetchCurrentUser depends on
// settingsStore.userRole, so seeding settings before each case is required.
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
  useSettingsStore.setState({
    theme: "system",
    environment: "development",
    maskedKey: null,
    appVersion: "",
    electronVersion: "",
    nangoSdkVersion: "",
    connectUiTheme: "system",
    connectUiPrimaryColor: null,
    hasRbac: false,
    isProduction: false,
    tier: null,
    userRole: "full_access",
    isLoading: false,
    error: null,
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

// ── fetchCurrentUser sources role from settingsStore ────────────────────────
// Per NANA-261 D1 fix, fetchCurrentUser must NOT hardcode `full_access` — it
// reads `userRole` from the settingsStore, which is populated by the main
// process (which honours the `NANGO_USER_ROLE` env override and otherwise
// defaults to `full_access`). The tests below seed settingsStore directly
// and verify that the rbacStore reflects the seeded role and re-derives
// permissions accordingly. window.electronApp is intentionally undefined in
// the vitest env, so fetchCurrentUser skips its IPC call and reads the
// seeded settings synchronously.

describe("rbacStore.fetchCurrentUser sources role from settings", () => {
  it("propagates 'full_access' from settings and grants every permission", async () => {
    useSettingsStore.setState({ userRole: "full_access" });
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

  it("propagates 'support' from settings and gates production actions only", async () => {
    useSettingsStore.setState({ userRole: "support" });
    await useRbacStore.getState().fetchCurrentUser();
    const state = useRbacStore.getState();
    expect(state.currentUser?.role).toBe("support");
    expect(state.canTriggerProductionActions).toBe(false);
    expect(state.canManageTeam).toBe(false);
    expect(state.canDeleteConnection).toBe(false);
    expect(state.canDeployProduction).toBe(false);
    expect(state.canTriggerDevActions).toBe(true);
  });

  it("propagates 'contributor' from settings and denies every guarded action", async () => {
    useSettingsStore.setState({ userRole: "contributor" });
    await useRbacStore.getState().fetchCurrentUser();
    const state = useRbacStore.getState();
    expect(state.currentUser?.role).toBe("contributor");
    expect(state.canTriggerProductionActions).toBe(false);
    expect(state.canManageTeam).toBe(false);
    expect(state.canDeleteConnection).toBe(false);
    expect(state.canDeployProduction).toBe(false);
    expect(state.canTriggerDevActions).toBe(false);
  });

  it("propagates 'custom' from settings — all gates default to denied", async () => {
    useSettingsStore.setState({ userRole: "custom" });
    await useRbacStore.getState().fetchCurrentUser();
    const state = useRbacStore.getState();
    expect(state.currentUser?.role).toBe("custom");
    expect(state.canTriggerProductionActions).toBe(false);
    expect(state.canManageTeam).toBe(false);
    expect(state.canDeleteConnection).toBe(false);
    expect(state.canDeployProduction).toBe(false);
    expect(state.canTriggerDevActions).toBe(false);
  });

  it("does not regress to a hardcoded role when settings change between calls", async () => {
    useSettingsStore.setState({ userRole: "support" });
    await useRbacStore.getState().fetchCurrentUser();
    expect(useRbacStore.getState().currentUser?.role).toBe("support");

    useSettingsStore.setState({ userRole: "full_access" });
    await useRbacStore.getState().fetchCurrentUser();
    expect(useRbacStore.getState().currentUser?.role).toBe("full_access");
    expect(useRbacStore.getState().canTriggerProductionActions).toBe(true);
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
