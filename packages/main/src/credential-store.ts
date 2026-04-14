import { safeStorage, app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import type { NangoEnvironment, AppTheme } from "@nango-gui/shared";

const CREDENTIALS_FILE = "credentials.enc";
const ENVIRONMENT_FILE = "environment.json";
const SETTINGS_FILE = "settings.json";

function credentialsPath(): string {
  return join(app.getPath("userData"), CREDENTIALS_FILE);
}

function environmentPath(): string {
  return join(app.getPath("userData"), ENVIRONMENT_FILE);
}

function settingsPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE);
}

export const credentialStore = {
  /**
   * Encrypt and persist the Nango secret key to disk.
   * Throws if safeStorage is not available on this platform.
   */
  save(secretKey: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Secure storage is not available on this system. Cannot save credentials."
      );
    }
    const encrypted = safeStorage.encryptString(secretKey);
    writeFileSync(credentialsPath(), encrypted);
  },

  /**
   * Decrypt and return the stored key, or null if no key is stored.
   */
  load(): string | null {
    const path = credentialsPath();
    if (!existsSync(path)) return null;
    try {
      const encrypted = readFileSync(path);
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  },

  /**
   * Remove the stored credential file.
   */
  clear(): void {
    const path = credentialsPath();
    if (existsSync(path)) {
      unlinkSync(path);
    }
    const envPath = environmentPath();
    if (existsSync(envPath)) {
      unlinkSync(envPath);
    }
  },

  /**
   * Whether the underlying OS encryption facility is available.
   * Always check before calling save().
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  },

  /**
   * Persist the selected environment (dev/prod).
   */
  saveEnvironment(env: NangoEnvironment): void {
    writeFileSync(environmentPath(), JSON.stringify({ environment: env }));
  },

  /**
   * Load the persisted environment, defaulting to "development".
   */
  loadEnvironment(): NangoEnvironment {
    const path = environmentPath();
    if (!existsSync(path)) return "development";
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as {
        environment?: NangoEnvironment;
      };
      return raw.environment ?? "development";
    } catch {
      return "development";
    }
  },

  /**
   * Persist the selected theme preference.
   */
  saveTheme(theme: AppTheme): void {
    const path = settingsPath();
    let existing: Record<string, unknown> = {};
    if (existsSync(path)) {
      try {
        existing = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
      } catch {
        // ignore parse errors
      }
    }
    writeFileSync(path, JSON.stringify({ ...existing, theme }));
  },

  /**
   * Load the persisted theme, defaulting to "system".
   */
  loadTheme(): AppTheme {
    const path = settingsPath();
    if (!existsSync(path)) return "system";
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as { theme?: AppTheme };
      return raw.theme ?? "system";
    } catch {
      return "system";
    }
  },

  /**
   * Return the last 4 characters of the stored key masked for display,
   * e.g. "••••••••abcd". Returns null if no key is stored.
   */
  loadMaskedKey(): string | null {
    const key = this.load();
    if (!key) return null;
    const suffix = key.slice(-4);
    return `••••••••${suffix}`;
  },
};
