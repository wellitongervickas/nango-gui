import { describe, it, expect, vi, beforeEach } from "vitest";

// useRbac is the only thing the banner consults — stub it so we can drive
// rendering branches deterministically without spinning up a DOM.
const mockUseRbac = vi.fn<() => { hasRbac: boolean; isProduction: boolean }>();

vi.mock("../hooks/useRbac", () => ({
  useRbac: () => mockUseRbac(),
}));

import { ProdEnvironmentBanner } from "../components/common/ProdEnvironmentBanner";

beforeEach(() => {
  mockUseRbac.mockReset();
});

describe("ProdEnvironmentBanner", () => {
  it("renders the banner when hasRbac=true and isProduction=true", () => {
    mockUseRbac.mockReturnValue({ hasRbac: true, isProduction: true });
    const element = ProdEnvironmentBanner();
    expect(element).not.toBeNull();
    // Sanity-check the rendered React element carries the production marker
    // and is not the role-aware copy that the previous (misleading) impl used.
    const rendered = JSON.stringify(element);
    expect(rendered).toContain("Production environment");
    expect(rendered).toContain("all actions affect live data");
    // Guard against the previous misleading copy reappearing — the banner
    // must not surface per-user role information.
    expect(rendered).not.toMatch(/Support role|Contributor role|Full Access/i);
    expect(rendered).not.toMatch(/destructive actions are disabled/i);
  });

  it("renders nothing when isProduction=false (development env)", () => {
    mockUseRbac.mockReturnValue({ hasRbac: true, isProduction: false });
    expect(ProdEnvironmentBanner()).toBeNull();
  });

  it("renders nothing when hasRbac=false (RBAC disabled on server)", () => {
    mockUseRbac.mockReturnValue({ hasRbac: false, isProduction: true });
    expect(ProdEnvironmentBanner()).toBeNull();
  });

  it("renders nothing when both hasRbac and isProduction are false", () => {
    mockUseRbac.mockReturnValue({ hasRbac: false, isProduction: false });
    expect(ProdEnvironmentBanner()).toBeNull();
  });
});
