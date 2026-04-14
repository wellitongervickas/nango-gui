# Nango GUI

A desktop application for managing [Nango](https://nango.dev) integrations. Browse 700+ API connectors, authenticate via OAuth or credentials, monitor syncs, inspect records, and trigger actions — all from a native desktop interface.

## Features

- **Integrations catalog** — searchable, filterable grid of 700+ Nango-supported APIs with category sidebar and virtualized rendering
- **Connection management** — connect APIs via OAuth/credentials, view connection details, re-authorize, and delete with confirmation
- **Syncs dashboard** — monitor sync status, frequency, and record counts; pause, resume, or trigger syncs on demand
- **Records viewer** — browse synced data with dynamic columns, cursor pagination, delta filtering, and CSV/JSON export
- **Actions runner** — execute Nango actions with a dynamic input form and view structured responses
- **Proxy tester** — send authenticated ad-hoc HTTP requests through the Nango proxy
- **Health dashboard** — at-a-glance stats, sync timeline, top connections, and error alerts
- **Settings** — API key management, environment switching (dev/prod), and light/dark/system theme

## Tech Stack

- **Desktop shell** — [Electron](https://www.electronjs.org/) 35 with context-isolated preload
- **Frontend** — React 19, TypeScript, Tailwind CSS 4, Zustand, @xyflow/react
- **Nango SDK** — `@nangohq/node` (main process), `@nangohq/frontend` (renderer)
- **Build** — pnpm workspaces, Vite, tsup, electron-builder
- **Testing** — Vitest

## Project Structure

```
packages/
  main/        Electron main process — IPC handlers, Nango SDK client, credential store
  renderer/    React UI — pages, components, Zustand stores, flow canvas
  shared/      IPC channel definitions and shared types
apps/
  desktop/     Electron entry point, preload script, electron-builder config
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- A [Nango](https://nango.dev) account with a secret key

### Install and Run

```bash
git clone https://github.com/wellitongervickas/nango-gui.git
cd nango-gui
pnpm install
pnpm dev
```

The app opens an Electron window. On first launch, enter your Nango secret key in the setup wizard.

### Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start renderer (Vite) and Electron in dev mode |
| `pnpm build` | Build renderer and main process for production |
| `pnpm test` | Run Vitest test suite |
| `pnpm lint` | Lint with ESLint |
| `pnpm typecheck` | Type-check all packages |

## License

MIT
