import type { NangoSyncRecord } from "@nango-gui/shared";

/** Days of inactivity before Nango hard-deletes sync data. */
export const DELETION_THRESHOLD_DAYS = 60;

/** Days of inactivity at which we start warning users. */
export const WARNING_THRESHOLD_DAYS = 45;

const MS_PER_DAY = 86_400_000;

export type InactivityLevel = "none" | "warning" | "danger";

export interface InactivityInfo {
  level: InactivityLevel;
  inactiveDays: number;
  daysUntilDeletion: number;
}

/**
 * Compute inactivity info for a sync based on its last run timestamp.
 * Uses `finishedAt` as the last-activity indicator — if a sync has never run,
 * we cannot determine inactivity so we return level "none".
 */
export function getInactivityInfo(
  sync: NangoSyncRecord,
  now: Date = new Date()
): InactivityInfo {
  if (!sync.finishedAt) {
    return { level: "none", inactiveDays: 0, daysUntilDeletion: DELETION_THRESHOLD_DAYS };
  }

  const lastRun = new Date(sync.finishedAt);
  const inactiveDays = Math.floor((now.getTime() - lastRun.getTime()) / MS_PER_DAY);
  const daysUntilDeletion = Math.max(0, DELETION_THRESHOLD_DAYS - inactiveDays);

  let level: InactivityLevel = "none";
  if (inactiveDays >= DELETION_THRESHOLD_DAYS) {
    level = "danger";
  } else if (inactiveDays >= WARNING_THRESHOLD_DAYS) {
    level = "warning";
  }

  return { level, inactiveDays, daysUntilDeletion };
}

/** Count how many syncs are at warning or danger level. */
export function countInactiveSyncs(
  syncs: NangoSyncRecord[],
  now: Date = new Date()
): { warning: number; danger: number } {
  let warning = 0;
  let danger = 0;
  for (const sync of syncs) {
    const info = getInactivityInfo(sync, now);
    if (info.level === "danger") danger++;
    else if (info.level === "warning") warning++;
  }
  return { warning, danger };
}
