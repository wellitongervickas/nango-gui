import { describe, it, expect } from "vitest";
import {
  getInactivityInfo,
  countInactiveSyncs,
  DELETION_THRESHOLD_DAYS,
  WARNING_THRESHOLD_DAYS,
} from "../sync-inactivity";
import type { NangoSyncRecord } from "@nango-gui/shared";

function makeSyncRecord(overrides: Partial<NangoSyncRecord> = {}): NangoSyncRecord {
  return {
    id: "sync-1",
    name: "test-sync",
    status: "SUCCESS",
    type: "INCREMENTAL",
    frequency: "every 30min",
    finishedAt: null,
    nextScheduledSyncAt: null,
    latestResult: null,
    recordCount: null,
    checkpoint: null,
    ...overrides,
  };
}

function daysAgo(days: number, from: Date = new Date("2026-04-19T12:00:00Z")): string {
  const d = new Date(from.getTime() - days * 86_400_000);
  return d.toISOString();
}

const NOW = new Date("2026-04-19T12:00:00Z");

describe("getInactivityInfo", () => {
  it("returns level 'none' when finishedAt is null", () => {
    const sync = makeSyncRecord({ finishedAt: null });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("none");
    expect(info.inactiveDays).toBe(0);
    expect(info.daysUntilDeletion).toBe(DELETION_THRESHOLD_DAYS);
  });

  it("returns level 'none' for a sync that ran recently", () => {
    const sync = makeSyncRecord({ finishedAt: daysAgo(5, NOW) });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("none");
    expect(info.inactiveDays).toBe(5);
    expect(info.daysUntilDeletion).toBe(55);
  });

  it("returns level 'none' at exactly 44 days", () => {
    const sync = makeSyncRecord({ finishedAt: daysAgo(44, NOW) });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("none");
    expect(info.inactiveDays).toBe(44);
  });

  it("returns level 'warning' at exactly 45 days", () => {
    const sync = makeSyncRecord({ finishedAt: daysAgo(45, NOW) });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("warning");
    expect(info.inactiveDays).toBe(45);
    expect(info.daysUntilDeletion).toBe(15);
  });

  it("returns level 'warning' at 59 days", () => {
    const sync = makeSyncRecord({ finishedAt: daysAgo(59, NOW) });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("warning");
    expect(info.inactiveDays).toBe(59);
    expect(info.daysUntilDeletion).toBe(1);
  });

  it("returns level 'danger' at exactly 60 days", () => {
    const sync = makeSyncRecord({ finishedAt: daysAgo(60, NOW) });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("danger");
    expect(info.inactiveDays).toBe(60);
    expect(info.daysUntilDeletion).toBe(0);
  });

  it("returns level 'danger' beyond 60 days with daysUntilDeletion clamped to 0", () => {
    const sync = makeSyncRecord({ finishedAt: daysAgo(90, NOW) });
    const info = getInactivityInfo(sync, NOW);
    expect(info.level).toBe("danger");
    expect(info.inactiveDays).toBe(90);
    expect(info.daysUntilDeletion).toBe(0);
  });
});

describe("countInactiveSyncs", () => {
  it("returns zeroes for an empty array", () => {
    expect(countInactiveSyncs([], NOW)).toEqual({ warning: 0, danger: 0 });
  });

  it("returns zeroes when all syncs are active", () => {
    const syncs = [
      makeSyncRecord({ finishedAt: daysAgo(1, NOW) }),
      makeSyncRecord({ finishedAt: daysAgo(10, NOW) }),
    ];
    expect(countInactiveSyncs(syncs, NOW)).toEqual({ warning: 0, danger: 0 });
  });

  it("counts warning and danger syncs correctly", () => {
    const syncs = [
      makeSyncRecord({ id: "s1", finishedAt: daysAgo(1, NOW) }),   // none
      makeSyncRecord({ id: "s2", finishedAt: daysAgo(50, NOW) }),  // warning
      makeSyncRecord({ id: "s3", finishedAt: daysAgo(55, NOW) }),  // warning
      makeSyncRecord({ id: "s4", finishedAt: daysAgo(65, NOW) }),  // danger
      makeSyncRecord({ id: "s5", finishedAt: null }),               // none
    ];
    expect(countInactiveSyncs(syncs, NOW)).toEqual({ warning: 2, danger: 1 });
  });

  it("counts all danger when all syncs are past 60 days", () => {
    const syncs = [
      makeSyncRecord({ id: "s1", finishedAt: daysAgo(70, NOW) }),
      makeSyncRecord({ id: "s2", finishedAt: daysAgo(100, NOW) }),
    ];
    expect(countInactiveSyncs(syncs, NOW)).toEqual({ warning: 0, danger: 2 });
  });
});

describe("threshold constants", () => {
  it("WARNING_THRESHOLD_DAYS is 45", () => {
    expect(WARNING_THRESHOLD_DAYS).toBe(45);
  });

  it("DELETION_THRESHOLD_DAYS is 60", () => {
    expect(DELETION_THRESHOLD_DAYS).toBe(60);
  });
});
