import { create } from "zustand";
import type { UserRole, RbacUser, TeamMember } from "@nango-gui/shared";

interface RbacState {
  currentUser: RbacUser | null;
  teamMembers: TeamMember[];
  isLoading: boolean;
  error: string | null;

  // Derived permission helpers
  canTriggerProductionActions: boolean;
  canManageTeam: boolean;
  canDeleteConnection: boolean;
  canDeployProduction: boolean;
  canTriggerDevActions: boolean;

  fetchCurrentUser: () => Promise<void>;
  fetchTeamMembers: () => Promise<void>;
  updateMemberRole: (userId: string, role: UserRole) => Promise<void>;
}

function derivePermissions(role: UserRole | undefined) {
  if (!role) {
    return {
      canTriggerProductionActions: true,
      canManageTeam: true,
      canDeleteConnection: true,
      canDeployProduction: true,
      canTriggerDevActions: true,
    };
  }
  return {
    canTriggerProductionActions: role === "full_access",
    canManageTeam: role === "full_access",
    canDeleteConnection: role === "full_access",
    canDeployProduction: role === "full_access",
    canTriggerDevActions: role === "full_access" || role === "support",
  };
}

const DEFAULT_PERMISSIONS = derivePermissions(undefined);

export const useRbacStore = create<RbacState>((set, get) => ({
  currentUser: null,
  teamMembers: [],
  isLoading: false,
  error: null,
  ...DEFAULT_PERMISSIONS,

  fetchCurrentUser: async () => {
    set({ isLoading: true, error: null });
    try {
      // Desktop app uses secret key — always full_access.
      // In a web context, this would call a real user endpoint.
      const user: RbacUser = {
        id: "desktop-user",
        email: "",
        name: "You",
        role: "full_access",
      };
      set({
        currentUser: user,
        ...derivePermissions(user.role),
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load user";
      set({ error: message, isLoading: false });
    }
  },

  fetchTeamMembers: async () => {
    set({ isLoading: true, error: null });
    try {
      // Stub — in production this would call a real team members endpoint.
      set({ teamMembers: [], isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load team";
      set({ error: message, isLoading: false });
    }
  },

  updateMemberRole: async (userId: string, role: UserRole) => {
    const prev = get().teamMembers;
    const updated = prev.map((m) =>
      m.id === userId ? { ...m, role } : m
    );
    set({ teamMembers: updated });
    try {
      // Stub — in production this would call a real update endpoint.
    } catch (err) {
      set({ teamMembers: prev });
      throw err;
    }
  },
}));
