import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NangoProvider, IpcResponse } from "@nango-gui/shared";

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

const mockListProviders = vi.fn(
  (): Promise<IpcResponse<NangoProvider[]>> =>
    Promise.resolve({ status: "ok", data: mockProviders, error: null })
);

vi.stubGlobal("window", {
  nango: {
    listProviders: mockListProviders,
  },
});

import { useIntegrationsStore } from "../store/integrationsStore.js";

beforeEach(() => {
  useIntegrationsStore.setState({
    providers: [],
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
});
