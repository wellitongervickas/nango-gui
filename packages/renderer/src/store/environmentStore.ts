import type { NangoEnvironment } from "@nango-gui/shared";

export interface EnvironmentEntry {
  name: NangoEnvironment;
  label: string;
  shortLabel: string;
  color: string;
}

export const ENVIRONMENTS: EnvironmentEntry[] = [
  { name: "production", label: "Production", shortLabel: "Prod", color: "var(--color-env-production)" },
  { name: "staging", label: "Staging", shortLabel: "Stag", color: "var(--color-env-staging)" },
  { name: "development", label: "Development", shortLabel: "Dev", color: "var(--color-env-development)" },
];

export function getEnvironmentEntry(env: NangoEnvironment): EnvironmentEntry {
  return ENVIRONMENTS.find((e) => e.name === env) ?? ENVIRONMENTS[2];
}

export function syncEnvironmentUrlParam(env: NangoEnvironment): void {
  const url = new URL(window.location.href);
  url.searchParams.set("env", env);
  window.history.replaceState(null, "", url.toString());
}

export function readEnvironmentFromUrl(): NangoEnvironment | null {
  const params = new URLSearchParams(window.location.search);
  const env = params.get("env");
  if (env && ENVIRONMENTS.some((e) => e.name === env)) {
    return env as NangoEnvironment;
  }
  return null;
}
