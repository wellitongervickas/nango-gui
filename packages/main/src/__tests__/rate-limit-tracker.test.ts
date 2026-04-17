import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the logger before importing the tracker
vi.mock("../logger.js", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Dynamic import so the mock is in place first
const { rateLimitTracker } = await import("../rate-limit-tracker.js");

// The tracker is a singleton — we can't reset its Map between tests cleanly,
// but we can test behaviour with unique provider names per test.

describe("RateLimitTracker", () => {
  describe("observe()", () => {
    it("ignores headers with no rate-limit info", () => {
      rateLimitTracker.observe("empty-provider", { "content-type": "application/json" });
      const state = rateLimitTracker.getState();
      expect(state.find((s) => s.provider === "empty-provider")).toBeUndefined();
    });

    it("tracks a provider when X-RateLimit headers are present", () => {
      rateLimitTracker.observe("github-test", {
        "X-RateLimit-Limit": "5000",
        "X-RateLimit-Remaining": "4500",
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
      });
      const state = rateLimitTracker.getState();
      const entry = state.find((s) => s.provider === "github-test");
      expect(entry).toBeDefined();
      expect(entry!.limit).toBe(5000);
      expect(entry!.remaining).toBe(4500);
    });

    it("handles case-insensitive header names", () => {
      rateLimitTracker.observe("slack-ci", {
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "80",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600),
      });
      const entry = rateLimitTracker.getState().find((s) => s.provider === "slack-ci");
      expect(entry).toBeDefined();
      expect(entry!.limit).toBe(100);
      expect(entry!.remaining).toBe(80);
    });
  });

  describe("threshold alerts", () => {
    it("emits a warning alert at 75% usage", () => {
      const cb = vi.fn();
      rateLimitTracker.onAlert(cb);

      rateLimitTracker.observe("warn-provider", {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "20", // 80% used
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 600),
      });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].level).toBe("warning");
      expect(cb.mock.calls[0][0].provider).toBe("warn-provider");

      rateLimitTracker.offAlert(cb);
    });

    it("emits a critical alert at 90% usage", () => {
      const cb = vi.fn();
      rateLimitTracker.onAlert(cb);

      rateLimitTracker.observe("crit-provider", {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "5", // 95% used
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 600),
      });

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].level).toBe("critical");
      expect(cb.mock.calls[0][0].provider).toBe("crit-provider");

      rateLimitTracker.offAlert(cb);
    });

    it("does not emit an alert below 75% usage", () => {
      const cb = vi.fn();
      rateLimitTracker.onAlert(cb);

      rateLimitTracker.observe("safe-provider", {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "50", // 50% used
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 600),
      });

      expect(cb).not.toHaveBeenCalled();

      rateLimitTracker.offAlert(cb);
    });
  });

  describe("getState()", () => {
    it("prunes expired entries", () => {
      // Insert an entry with a reset time in the past
      rateLimitTracker.observe("expired-provider", {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "50",
        "X-RateLimit-Reset": "1000", // Unix timestamp way in the past
      });

      const state = rateLimitTracker.getState();
      expect(state.find((s) => s.provider === "expired-provider")).toBeUndefined();
    });
  });
});
