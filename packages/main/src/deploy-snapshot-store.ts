import { app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "node:crypto";
import type {
  DeploySnapshot,
  DeploySaveSnapshotRequest,
} from "@nango-gui/shared";

const SNAPSHOTS_FILE = "deploy-snapshots.json";
const MAX_SNAPSHOTS = 20;

function snapshotsPath(): string {
  return join(app.getPath("userData"), SNAPSHOTS_FILE);
}

export const deploySnapshotStore = {
  load(): DeploySnapshot[] {
    const path = snapshotsPath();
    if (!existsSync(path)) return [];
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
      return Array.isArray(raw) ? (raw as DeploySnapshot[]) : [];
    } catch {
      return [];
    }
  },

  save(request: DeploySaveSnapshotRequest): DeploySnapshot {
    const snapshot: DeploySnapshot = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      environment: request.environment,
      cliConfig: request.cliConfig,
      ...(request.label !== undefined ? { label: request.label } : {}),
    };
    const existing = this.load();
    const updated = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);
    writeFileSync(snapshotsPath(), JSON.stringify(updated, null, 2));
    return snapshot;
  },

  get(id: string): DeploySnapshot | undefined {
    return this.load().find((s) => s.id === id);
  },

  delete(id: string): void {
    const updated = this.load().filter((s) => s.id !== id);
    writeFileSync(snapshotsPath(), JSON.stringify(updated, null, 2));
  },
};
