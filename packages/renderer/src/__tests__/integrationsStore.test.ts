import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  IpcResponse,
  NangoCreateIntegrationRequest,
  NangoIntegration,
  NangoIntegrationSummary,
  NangoProvider,
  NangoUpdateIntegrationRequest,
} from "@nango-gui/shared";

// ── window.nango mock ───────────────────────────────────────────────────────

const mockProviders: NangoProvider[] = [
  {
    name: "github",
    display_name: "GitHub",
    logo_url: "https://example.com/github.png",
    auth_mode: "OAUTH2",
    categories: ["developer-tools", "version-control"],
  },
  {
    name: "slack",
    display_name: "Slack",
    logo_url: "https://example.com/slack.png",
    auth_mode: "OAUTH2",
    categories: ["communication"],
  },
  {
    name: "salesforce",
    display_name: "Salesforce",
    logo_url: "https://example.com/salesforce.png",
    auth_mode: "OAUTH2",
    categories: ["crm"],
  },
];

const mockIntegrations: NangoIntegrationSummary[] = [
  {
    unique_key: "github-prod",
    provider: "github",
    display_name: "GitHub Prod",
    logo: "https://example.com/github.png",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    forward_webhooks: true,
    connectionCount: 3,
  },
  {
    unique_key: "slack-team",
    provider: "slack",
    display_name: "Slack Team",
    logo: "https://example.com/slack.png",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    forward_webhooks: false,
    connectionCount: 0,
  },
];

const fullIntegration: NangoIntegration = {
  unique_key: "github-prod",
  provider: "github",
  display_name: "GitHub Prod",
  logo: "https://example.com/github.png",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  forward_webhooks: true,
  webhook_url: "https://api.nango.dev/webhook/abc",
  credentials: {
    type: "OAUTH2",
    client_id: "client-123",
    client_secret: null,
    scopes: "repo read:user",
    webhook_secret: null,
  },
};

const mockListProviders = vi.fn(
  (): Promise<IpcResponse<NangoProvider[]>> =>
    Promise.resolve({ status: "ok", data: mockProviders, error: null }),
);

const mockListIntegrations = vi.fn(
  (): Promise<IpcResponse<NangoIntegrationSummary[]>> =>
    Promise.resolve({ status: "ok", data: mockIntegrations, error: null }),
);

const mockGetIntegration = vi.fn(
  (): Promise<IpcResponse<NangoIntegration>> =>
    Promise.resolve({ status: "ok", data: fullIntegration, error: null }),
);

const mockCreateIntegration = vi.fn(
  (
    args: NangoCreateIntegrationRequest,
  ): Promise<IpcResponse<NangoIntegration>> =>
    Promise.resolve({
      status: "ok",
      data: { ...fullIntegration, unique_key: args.unique_key, provider: args.provider },
      error: null,
    }),
);

const mockUpdateIntegration = vi.fn(
  (
    args: NangoUpdateIntegrationRequest,
  ): Promise<IpcResponse<NangoIntegration>> =>
    Promise.resolve({
      status: "ok",
      data: {
        ...fullIntegration,
        unique_key: args.unique_key ?? args.uniqueKey,
        display_name: args.display_name ?? fullIntegration.display_name,
        forward_webhooks: args.forward_webhooks ?? fullIntegration.forward_webhooks,
        updated_at: "2026-03-01T00:00:00Z",
      },
      error: null,
    }),
);

const mockDeleteIntegration = vi.fn(
  (): Promise<IpcResponse<{ success: true }>> =>
    Promise.resolve({ status: "ok", data: { success: true }, error: null }),
);

vi.stubGlobal("window", {
  nango: {
    listProviders: mockListProviders,
    listIntegrations: mockListIntegrations,
    getIntegration: mockGetIntegration,
    createIntegration: mockCreateIntegration,
    updateIntegration: mockUpdateIntegration,
    deleteIntegration: mockDeleteIntegration,
  },
});

import { useIntegrationsStore } from "../store/integrationsStore.js";

beforeEach(() => {
  useIntegrationsStore.setState({
    providers: [],
    integrations: [],
    isLoading: false,
    error: null,
    search: "",
    activeCategory: null,
  });
  vi.clearAllMocks();
});

describe("useIntegrationsStore", () => {
  describe("fetchProviders", () => {
    it("populates providers on success", async () => {
      await useIntegrationsStore.getState().fetchProviders();
      expect(useIntegrationsStore.getState().providers).toEqual(mockProviders);
      expect(useIntegrationsStore.getState().isLoading).toBe(false);
      expect(useIntegrationsStore.getState().error).toBeNull();
    });

    it("sets error on API failure", async () => {
      mockListProviders.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Unauthorized",
        errorCode: "UNKNOWN",
      });
      await useIntegrationsStore.getState().fetchProviders();
      expect(useIntegrationsStore.getState().error).toBe("Unauthorized");
      expect(useIntegrationsStore.getState().providers).toEqual([]);
    });

    it("sets error on thrown exception", async () => {
      mockListProviders.mockRejectedValueOnce(new Error("Network error"));
      await useIntegrationsStore.getState().fetchProviders();
      expect(useIntegrationsStore.getState().error).toBe("Network error");
    });
  });

  describe("fetchIntegrations", () => {
    it("populates integrations on success", async () => {
      await useIntegrationsStore.getState().fetchIntegrations();
      expect(useIntegrationsStore.getState().integrations).toEqual(mockIntegrations);
      expect(useIntegrationsStore.getState().isLoading).toBe(false);
      expect(useIntegrationsStore.getState().error).toBeNull();
    });

    it("sets error on API failure", async () => {
      mockListIntegrations.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Forbidden",
        errorCode: "UNKNOWN",
      });
      await useIntegrationsStore.getState().fetchIntegrations();
      expect(useIntegrationsStore.getState().error).toBe("Forbidden");
      expect(useIntegrationsStore.getState().integrations).toEqual([]);
    });
  });

  describe("getIntegration", () => {
    it("returns the full integration on success", async () => {
      const result = await useIntegrationsStore
        .getState()
        .getIntegration("github-prod");
      expect(result).toEqual(fullIntegration);
      expect(mockGetIntegration).toHaveBeenCalledWith({
        uniqueKey: "github-prod",
        include: ["credentials", "webhook"],
      });
    });

    it("returns null and stores error on failure", async () => {
      mockGetIntegration.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Not found",
        errorCode: "UNKNOWN",
      });
      const result = await useIntegrationsStore
        .getState()
        .getIntegration("missing");
      expect(result).toBeNull();
      expect(useIntegrationsStore.getState().error).toBe("Not found");
    });
  });

  describe("createIntegration", () => {
    it("creates and refreshes the list", async () => {
      const result = await useIntegrationsStore.getState().createIntegration({
        provider: "github",
        unique_key: "github-new",
      });
      expect(result?.unique_key).toBe("github-new");
      // fetchIntegrations should have been called to refresh.
      expect(mockListIntegrations).toHaveBeenCalledTimes(1);
    });

    it("returns null and stores error on failure", async () => {
      mockCreateIntegration.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Already exists",
        errorCode: "UNKNOWN",
      });
      const result = await useIntegrationsStore.getState().createIntegration({
        provider: "github",
        unique_key: "github-prod",
      });
      expect(result).toBeNull();
      expect(useIntegrationsStore.getState().error).toBe("Already exists");
    });
  });

  describe("updateIntegration", () => {
    beforeEach(() => {
      useIntegrationsStore.setState({ integrations: mockIntegrations });
    });

    it("patches the cached row in place", async () => {
      const result = await useIntegrationsStore.getState().updateIntegration({
        uniqueKey: "github-prod",
        display_name: "GitHub Renamed",
        forward_webhooks: false,
      });
      expect(result?.display_name).toBe("GitHub Renamed");
      const cached = useIntegrationsStore
        .getState()
        .integrations.find((i) => i.unique_key === "github-prod");
      expect(cached?.display_name).toBe("GitHub Renamed");
      expect(cached?.forward_webhooks).toBe(false);
    });

    it("returns the renamed integration and triggers a list refresh when unique_key changes", async () => {
      // Rename returns a fresh listing where the row is keyed by its new name
      // so the connectionCount stays in sync with the server-side identifier.
      mockListIntegrations.mockResolvedValueOnce({
        status: "ok",
        data: [
          {
            unique_key: "github-renamed",
            provider: "github",
            display_name: "GitHub Prod",
            logo: "https://example.com/github.png",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-03-01T00:00:00Z",
            forward_webhooks: true,
            connectionCount: 3,
          },
          {
            unique_key: "slack-team",
            provider: "slack",
            display_name: "Slack Team",
            logo: "https://example.com/slack.png",
            created_at: "2026-02-01T00:00:00Z",
            updated_at: "2026-02-01T00:00:00Z",
            forward_webhooks: false,
            connectionCount: 0,
          },
        ],
        error: null,
      });

      const result = await useIntegrationsStore.getState().updateIntegration({
        uniqueKey: "github-prod",
        unique_key: "github-renamed",
      });
      expect(result?.unique_key).toBe("github-renamed");

      // Allow the fire-and-forget fetchIntegrations() refresh to settle.
      await new Promise((r) => setTimeout(r, 0));

      expect(mockListIntegrations).toHaveBeenCalledTimes(1);
      const renamed = useIntegrationsStore
        .getState()
        .integrations.find((i) => i.unique_key === "github-renamed");
      expect(renamed).toBeDefined();
      expect(
        useIntegrationsStore
          .getState()
          .integrations.find((i) => i.unique_key === "github-prod"),
      ).toBeUndefined();
    });

    it("does not refresh the listing when unique_key is unchanged", async () => {
      await useIntegrationsStore.getState().updateIntegration({
        uniqueKey: "github-prod",
        display_name: "GitHub Renamed",
      });
      // Allow any unintended fire-and-forget fetch to settle.
      await new Promise((r) => setTimeout(r, 0));
      expect(mockListIntegrations).not.toHaveBeenCalled();
    });

    it("returns null and stores error on failure", async () => {
      mockUpdateIntegration.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Bad request",
        errorCode: "UNKNOWN",
      });
      const result = await useIntegrationsStore.getState().updateIntegration({
        uniqueKey: "github-prod",
      });
      expect(result).toBeNull();
      expect(useIntegrationsStore.getState().error).toBe("Bad request");
    });
  });

  describe("deleteIntegration", () => {
    beforeEach(() => {
      useIntegrationsStore.setState({ integrations: mockIntegrations });
    });

    it("removes the row from the cache on success", async () => {
      const ok = await useIntegrationsStore
        .getState()
        .deleteIntegration("github-prod");
      expect(ok).toBe(true);
      expect(
        useIntegrationsStore
          .getState()
          .integrations.find((i) => i.unique_key === "github-prod"),
      ).toBeUndefined();
      expect(useIntegrationsStore.getState().integrations).toHaveLength(1);
    });

    it("returns false and stores error on failure", async () => {
      mockDeleteIntegration.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Has connections",
        errorCode: "UNKNOWN",
      });
      const ok = await useIntegrationsStore
        .getState()
        .deleteIntegration("github-prod");
      expect(ok).toBe(false);
      expect(useIntegrationsStore.getState().error).toBe("Has connections");
      expect(useIntegrationsStore.getState().integrations).toHaveLength(2);
    });
  });

  describe("setSearch", () => {
    it("updates search term", () => {
      useIntegrationsStore.getState().setSearch("github");
      expect(useIntegrationsStore.getState().search).toBe("github");
    });
  });

  describe("setActiveCategory", () => {
    it("updates active category", () => {
      useIntegrationsStore.getState().setActiveCategory("crm");
      expect(useIntegrationsStore.getState().activeCategory).toBe("crm");
    });

    it("clears category with null", () => {
      useIntegrationsStore.setState({ activeCategory: "crm" });
      useIntegrationsStore.getState().setActiveCategory(null);
      expect(useIntegrationsStore.getState().activeCategory).toBeNull();
    });
  });

  describe("filteredProviders", () => {
    beforeEach(() => {
      useIntegrationsStore.setState({ providers: mockProviders });
    });

    it("returns all providers when no filters active", () => {
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(3);
    });

    it("filters by search term (display_name)", () => {
      useIntegrationsStore.setState({ search: "github" });
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("github");
    });

    it("filters by search term (name key)", () => {
      useIntegrationsStore.setState({ search: "sales" });
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("salesforce");
    });

    it("filters by category", () => {
      useIntegrationsStore.setState({ activeCategory: "crm" });
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("salesforce");
    });

    it("combines search and category filters", () => {
      useIntegrationsStore.setState({
        search: "hub",
        activeCategory: "developer-tools",
      });
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("github");
    });

    it("returns empty array when no matches", () => {
      useIntegrationsStore.setState({ search: "xyz-no-match" });
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(0);
    });

    it("is case-insensitive", () => {
      useIntegrationsStore.setState({ search: "SLACK" });
      const result = useIntegrationsStore.getState().filteredProviders();
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("slack");
    });
  });

  describe("filteredIntegrations", () => {
    beforeEach(() => {
      useIntegrationsStore.setState({ integrations: mockIntegrations });
    });

    it("returns all integrations when search is empty", () => {
      const result = useIntegrationsStore.getState().filteredIntegrations();
      expect(result).toHaveLength(2);
    });

    it("filters by unique_key", () => {
      useIntegrationsStore.setState({ search: "github-prod" });
      const result = useIntegrationsStore.getState().filteredIntegrations();
      expect(result).toHaveLength(1);
      expect(result[0]!.unique_key).toBe("github-prod");
    });

    it("filters by display_name", () => {
      useIntegrationsStore.setState({ search: "Slack Team" });
      const result = useIntegrationsStore.getState().filteredIntegrations();
      expect(result).toHaveLength(1);
      expect(result[0]!.unique_key).toBe("slack-team");
    });

    it("filters by provider template", () => {
      useIntegrationsStore.setState({ search: "github" });
      const result = useIntegrationsStore.getState().filteredIntegrations();
      expect(result).toHaveLength(1);
      expect(result[0]!.provider).toBe("github");
    });

    it("is case-insensitive", () => {
      useIntegrationsStore.setState({ search: "SLACK" });
      const result = useIntegrationsStore.getState().filteredIntegrations();
      expect(result).toHaveLength(1);
      expect(result[0]!.unique_key).toBe("slack-team");
    });
  });
});
