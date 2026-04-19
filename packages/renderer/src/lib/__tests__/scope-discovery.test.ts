import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverScopes } from "../scope-discovery.js";

const mockSuggestScopes = vi.fn();

// Expose a minimal window.nango stub before each test.
beforeEach(() => {
  vi.stubGlobal("window", {
    nango: {
      suggestScopes: mockSuggestScopes,
    },
  });
  vi.clearAllMocks();
});

describe("discoverScopes", () => {
  it("returns scopes on a supported provider", async () => {
    mockSuggestScopes.mockResolvedValueOnce({
      status: "ok",
      data: {
        supported: true,
        scopes: [
          { scope: "read:user", recommended: true },
          { scope: "repo", recommended: true },
          { scope: "gist", recommended: false },
        ],
      },
    });

    const result = await discoverScopes("github");

    expect(result).toEqual({
      supported: true,
      scopes: [
        { scope: "read:user", recommended: true },
        { scope: "repo", recommended: true },
        { scope: "gist", recommended: false },
      ],
    });
    expect(mockSuggestScopes).toHaveBeenCalledWith("github");
  });

  it("returns { supported: false } for an unsupported provider", async () => {
    mockSuggestScopes.mockResolvedValueOnce({
      status: "ok",
      data: { supported: false, docsUrl: "https://docs.example.com" },
    });

    const result = await discoverScopes("unknown-provider");

    expect(result).toEqual({ supported: false, docsUrl: "https://docs.example.com" });
  });

  it("throws when the IPC returns an error", async () => {
    mockSuggestScopes.mockResolvedValueOnce({
      status: "error",
      error: "Scope discovery failed",
    });

    await expect(discoverScopes("github")).rejects.toThrow("Scope discovery failed");
  });

  it("throws when window.nango is not available", async () => {
    vi.stubGlobal("window", {});

    await expect(discoverScopes("github")).rejects.toThrow("Nango API not available");
  });
});
