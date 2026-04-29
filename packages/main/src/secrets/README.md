# SecretStore

Typed OS-keychain abstraction for all secret material in nango-gui.

All secrets — environment keys, cache encryption keys, OAuth app credentials — flow through this module. No plaintext is ever written to disk. Secrets are encrypted with Electron's `safeStorage` API, which delegates to the OS-native encryption facility:

| Platform | Backend |
|----------|---------|
| macOS    | Keychain Services |
| Windows  | Data Protection API (DPAPI) |
| Linux    | libsecret (GNOME Keyring / KWallet) |

Encrypted blobs are stored in `<userData>/secrets/`. A lightweight index file (`_index.json`) tracks which keys exist under each namespace, enabling the `listByNamespace` operation.

---

## API

```typescript
import { SecretStore, SecretKeys } from "./secret-store.js";

// Check availability before writing
SecretStore.isAvailable(): boolean

// Store a secret (throws if OS encryption unavailable)
SecretStore.set(key: string, value: string): void

// Retrieve a secret, or null if not present
SecretStore.get(key: string): string | null

// Delete a secret — returns true if something was removed
SecretStore.delete(key: string): boolean

// List all stored keys + values in a namespace
SecretStore.listByNamespace(namespace: string): Array<{ key: string; value: string }>
```

---

## Namespace Contract

Keys follow the format `<namespace>:<id>:<field>` (colon-delimited segments). The **namespace** is the first segment; it is used as the grouping key for `listByNamespace`.

### Registered namespaces

| Namespace    | Key pattern                              | Description                            |
|--------------|------------------------------------------|----------------------------------------|
| `env`        | `env:{envId}:secretKey`                  | Nango environment secret key           |
| `cache`      | `cache:encryptionKey`                    | Local cache AES encryption key         |
| `oauth-app`  | `oauth-app:{integrationId}:clientSecret` | OAuth application client secret        |
| `ai-provider`| `ai-provider:{provider}:apiKey`          | AI provider API key (openai, anthropic) |

### Key helpers

Use `SecretKeys` to construct keys without string interpolation errors:

```typescript
SecretKeys.envSecretKey("prod")             // "env:prod:secretKey"
SecretKeys.cacheEncryptionKey()             // "cache:encryptionKey"
SecretKeys.oauthClientSecret("github")     // "oauth-app:github:clientSecret"
```

> **Adding a new namespace:** update this table and add a helper to `SecretKeys`. Keep the format `<namespace>:<id>:<field>` so `listByNamespace` continues to work correctly.

---

## Migration

On first run, `migrateFromLegacyCredentialStore()` automatically moves any secrets from the old per-file credential store into `SecretStore`, then deletes the legacy files:

| Legacy file           | New SecretStore key              |
|-----------------------|----------------------------------|
| `credentials.enc`     | `env:default:secretKey`          |
| `ai-key-openai.enc`   | `ai-provider:openai:apiKey`      |
| `ai-key-anthropic.enc`| `ai-provider:anthropic:apiKey`   |

Migration is idempotent — safe to call on every startup.

---

## Testing

Use `createInMemorySecretStore()` from `in-memory-secret-store.ts` in tests. It implements the same interface without touching Electron or the filesystem:

```typescript
import { createInMemorySecretStore } from "./in-memory-secret-store.js";

const store = createInMemorySecretStore({ "env:test:secretKey": "sk-abc" });
store.get("env:test:secretKey"); // "sk-abc"
store.listByNamespace("env");   // [{ key: "env:test:secretKey", value: "sk-abc" }]
```

---

## Security invariants

1. **No plaintext on disk** — only `safeStorage`-encrypted blobs are persisted.
2. **Single entry point** — all secret reads/writes go through `SecretStore`. Direct `safeStorage` calls outside this module are a review block.
3. **No secrets in logs** — never pass raw secret values to `log.*`.
4. **Migration is destructive** — legacy plaintext-adjacent files are deleted after migration; the deletion is logged at `INFO` level for operator visibility.
