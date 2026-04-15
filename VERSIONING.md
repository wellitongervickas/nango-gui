# Versioning and Releases

This document defines how nango-gui is versioned, when each release type is cut, and the exact steps to publish a new version.

---

## Version Scheme

nango-gui follows [Semantic Versioning](https://semver.org): **`MAJOR.MINOR.PATCH`**

```
0.1.0
│ │ └── PATCH — backward-compatible bug fixes
│ └──── MINOR — new features, backward-compatible
└────── MAJOR — breaking changes or major product milestones
```

All packages in the monorepo share the same version number and are bumped together on every release.

---

## Release Types

### Patch release (`0.1.x`)

> Small, safe — fixes and polish only.

Cut a patch when:

- Bug fixes or crash resolutions with no behavior change
- Copy or UI polish that does not add new screens
- Dependency updates that do not change public behavior
- Performance improvements with no API or UX change
- Security patches

**Examples:** fix a crash in the Records viewer, update `@nangohq/node` for a security advisory, fix a layout regression.

### Minor release (`0.x.0`)

> New capability — users gain something they did not have before.

Cut a minor when:

- A new page, panel, or major UI section is shipped
- A new Electron IPC channel or renderer feature is exposed
- Existing workflows change in a backward-compatible way (e.g. new optional settings field)
- A new integration mode or connector type is supported

**Examples:** add the Proxy tester page, introduce dark/light theme toggle, add CSV export to the Records viewer.

### Major release (`x.0.0`)

> Milestone or breaking change — existing behavior or setup changes.

Cut a major when:

- The on-disk credential store or settings format changes in a way that requires a migration
- The Electron IPC contract changes in a way that old preload scripts would break
- A significant architectural redesign ships (e.g. replacing the renderer bundler)
- The product reaches a publicly-announced stability milestone (e.g. `1.0.0` — first stable GA)

**Examples:** migrate from a flat JSON credential store to an OS keychain; rename all IPC channels; ship the first stable `1.0.0` release.

---

## Release Process

### Step 1 — Verify the branch is green

```bash
git checkout main
git pull origin main
pnpm typecheck
pnpm lint
pnpm test
```

CI must be passing on `main` before any release tag is pushed.

### Step 2 — Decide the version bump

Use the table above to pick `patch`, `minor`, or `major`. Then run the bump script at the workspace root — this updates `package.json` in every package simultaneously:

```bash
# Patch: 0.1.0 → 0.1.1
pnpm version patch --no-git-tag-version --recursive

# Minor: 0.1.0 → 0.2.0
pnpm version minor --no-git-tag-version --recursive

# Major: 0.1.0 → 1.0.0
pnpm version major --no-git-tag-version --recursive
```

`--no-git-tag-version` prevents pnpm from creating the git tag immediately — we do that ourselves in the next step so we can review the diff first.

### Step 3 — Commit and tag

```bash
# Replace X.Y.Z with the new version
export VERSION=X.Y.Z

git add package.json apps/desktop/package.json packages/*/package.json
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
git push origin main --follow-tags
```

Pushing the tag (`v*`) triggers the **Release** GitHub Actions workflow automatically.

### Step 4 — Monitor the release build

The workflow (`.github/workflows/release.yml`) builds distributable artifacts on four runners in parallel:

| Runner | Artifact |
|---|---|
| `macos-latest` (arm64) | `.dmg` + `.zip` |
| `macos-13` (x64) | `.dmg` + `.zip` |
| `windows-latest` | `.exe` (NSIS installer) |
| `ubuntu-latest` | `.AppImage` + `.deb` |

After all four builds succeed, the `publish` job creates a **draft** GitHub Release with auto-generated release notes and attaches all artifacts.

### Step 5 — Publish the GitHub Release

1. Open the draft release at `https://github.com/wellitongervickas/nango-gui/releases`
2. Review the auto-generated changelog — edit if needed
3. Click **Publish release**

Published releases are picked up by `electron-updater` in running instances of the app on the next update check.

---

## Hotfix releases

If a critical bug is found on a shipped tag and `main` already has unrelated work:

```bash
# Branch from the broken tag
git checkout -b hotfix/v0.1.1 v0.1.0

# Apply the fix, then bump patch and tag
pnpm version patch --no-git-tag-version --recursive
git add package.json apps/desktop/package.json packages/*/package.json
git commit -m "fix: <short description>"
git tag v0.1.1
git push origin hotfix/v0.1.1 --follow-tags
```

Then open a PR to merge the fix back into `main`.

---

## Version progress guidelines

| Phase | Version range | Signal |
|---|---|---|
| Early development / alpha | `0.1.x` | Core features still being built |
| Feature-complete beta | `0.x.0` (minor bumps) | All primary flows work; stabilizing |
| First stable release | `1.0.0` | Production-ready, public announcement |
| Ongoing stable | `1.x.0` / `1.x.y` | Normal semver cadence |
| Breaking platform changes | `2.0.0`, `3.0.0`, … | Major architectural or UX overhaul |

Avoid `0.0.x` — the project starts at `0.1.0` and advances from there.

---

## Monorepo version sync

All packages (`apps/desktop`, `packages/main`, `packages/renderer`, `packages/shared`) and the workspace root share the same version at all times. The `pnpm version --recursive` command in Step 2 enforces this. Never bump a single package independently.
