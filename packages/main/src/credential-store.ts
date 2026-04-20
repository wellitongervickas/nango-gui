import { safeStorage, app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import type { NangoEnvironment, AppTheme, AiProviderType } from "@nango-gui/shared";

const CREDENTIALS_FILE = "credentials.enc";
const ENVIRONMENT_FILE = "environment.json";
const SETTINGS_FILE = "settings.json";

/** Per-environment credential file names. */
const ENV_CREDENTIALS_FILES: Record<NangoEnvironment, string> = {
  development: "credentials-development.enc",
  staging: "credentials-staging.enc",
  production: "credentials-production.enc",
};

/** Per-provider credential file names. */
const AI_PROVIDER_FILES: Record<AiProviderType, string> = {
  openai: "ai-key-openai.enc",
  anthropic: "ai-key-anthropic.enc",
};

function aiProviderKeyPath(provider: AiProviderType): string {
  return join(app.getPath("userData"), AI_PROVIDER_FILES[provider]);
}

function envCredentialsPath(env: NangoEnvironment): string {
  return join(app.getPath("userData"), ENV_CREDENTIALS_FILES[env]);
}

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
   * Encrypt and persist the Nango secret key for a specific environment.
   * Also writes the legacy global file for backward compatibility.
   * Throws if safeStorage is not available on this platform.
   */
  save(secretKey: string, environment?: NangoEnvironment): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Secure storage is not available on this system. Cannot save credentials."
      );
    }
    const encrypted = safeStorage.encryptString(secretKey);
    const env = environment ?? this.loadEnvironment();
    writeFileSync(envCredentialsPath(env), encrypted);
    // Keep legacy global file in sync with the active environment
    writeFileSync(credentialsPath(), encrypted);
  },

  /**
   * Decrypt and return the stored key for a specific environment.
   * Falls back to the legacy global file if no per-env file exists.
   */
  load(environment?: NangoEnvironment): string | null {
    const env = environment ?? this.loadEnvironment();
    const perEnvPath = envCredentialsPath(env);
    if (existsSync(perEnvPath)) {
      try {
        return safeStorage.decryptString(readFileSync(perEnvPath));
      } catch {
        return null;
      }
    }
    // Fallback: legacy global credentials file
    const globalPath = credentialsPath();
    if (!existsSync(globalPath)) return null;
    try {
      return safeStorage.decryptString(readFileSync(globalPath));
    } catch {
      return null;
    }
  },

  /**
   * Remove credential files. If environment is specified, remove only that
   * environment's key. Otherwise remove all credential files.
   */
  clear(environment?: NangoEnvironment): void {
    if (environment) {
      const path = envCredentialsPath(environment);
      if (existsSync(path)) unlinkSync(path);
      return;
    }
    // Clear all
    const globalPath = credentialsPath();
    if (existsSync(globalPath)) unlinkSync(globalPath);
    for (const env of Object.keys(ENV_CREDENTIALS_FILES) as NangoEnvironment[]) {
      const path = envCredentialsPath(env);
      if (existsSync(path)) unlinkSync(path);
    }
    const envPath = environmentPath();
    if (existsSync(envPath)) unlinkSync(envPath);
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
  loadMaskedKey(environment?: NangoEnvironment): string | null {
    const key = this.load(environment);
    if (!key) return null;
    const suffix = key.slice(-4);
    return `••••••••${suffix}`;
  },

  /**
   * Return a map of which environments have a configured secret key.
   */
  getEnvironmentKeyStatus(): Record<NangoEnvironment, boolean> {
    return {
      development: this.load("development") !== null,
      staging: this.load("staging") !== null,
      production: this.load("production") !== null,
    };
  },

  // ── AI Provider API keys ───────────────────────────────────────────────

  /**
   * Encrypt and persist an AI provider API key (OpenAI or Anthropic).
   */
  saveAiProviderKey(provider: AiProviderType, apiKey: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Secure storage is not available on this system.");
    }
    const encrypted = safeStorage.encryptString(apiKey);
    writeFileSync(aiProviderKeyPath(provider), encrypted);
  },

  /**
   * Decrypt and return the stored AI provider key, or null if not stored.
   */
  loadAiProviderKey(provider: AiProviderType): string | null {
    const path = aiProviderKeyPath(provider);
    if (!existsSync(path)) return null;
    try {
      const encrypted = readFileSync(path);
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  },

  /**
   * Remove the stored AI provider key.
   */
  clearAiProviderKey(provider: AiProviderType): void {
    const path = aiProviderKeyPath(provider);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  },

  /**
   * Return masked version of stored AI provider key for display.
   */
  loadMaskedAiProviderKey(provider: AiProviderType): string | null {
    const key = this.loadAiProviderKey(provider);
    if (!key) return null;
    const suffix = key.slice(-4);
    return `••••••••${suffix}`;
  },
};
