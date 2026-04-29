/**
 * In-memory SecretStore implementation for unit tests.
 *
 * Drop-in replacement for the real SecretStore. No Electron, no disk I/O,
 * no OS keychain required — safe to use in CI environments.
 *
 * @example
 *   import { createInMemorySecretStore } from "./in-memory-secret-store.js";
 *   const store = createInMemorySecretStore();
 *   store.set("env:test:secretKey", "sk-abc");
 *   store.get("env:test:secretKey"); // "sk-abc"
 */

import { SecretKeys } from "./secret-store.js";

export interface SecretStoreInterface {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): boolean;
  listByNamespace(namespace: string): Array<{ key: string; value: string }>;
  isAvailable(): boolean;
  keys: typeof SecretKeys;
}

export function createInMemorySecretStore(
  initial: Record<string, string> = {}
): SecretStoreInterface & { _store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));

  function namespaceOf(key: string): string {
    return key.split(":")[0] ?? key;
  }

  return {
    _store: store,

    get(key: string): string | null {
      return store.get(key) ?? null;
    },

    set(key: string, value: string): void {
      store.set(key, value);
    },

    delete(key: string): boolean {
      return store.delete(key);
    },

    listByNamespace(namespace: string): Array<{ key: string; value: string }> {
      const result: Array<{ key: string; value: string }> = [];
      for (const [key, value] of store) {
        if (namespaceOf(key) === namespace) {
          result.push({ key, value });
        }
      }
      return result;
    },

    isAvailable(): boolean {
      return true;
    },

    keys: SecretKeys,
  };
}
