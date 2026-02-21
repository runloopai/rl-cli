# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Runloop CLI (`rli`) — a dual-mode TUI + CLI for the [Runloop.ai](https://runloop.ai) platform. It provides an interactive terminal UI (React + Ink) and traditional CLI commands for managing devboxes, snapshots, blueprints, and other cloud resources. It also includes an MCP server for AI integration.

## Common Commands

```bash
pnpm run build          # TypeScript compilation to dist/
pnpm run dev            # Watch mode (tsc --watch)
pnpm start -- <command> # Run CLI (e.g., pnpm start -- devbox list)

pnpm test               # Unit tests (Jest, requires NODE_OPTIONS='--experimental-vm-modules')
pnpm test:watch         # Test watch mode
pnpm test:coverage      # Coverage report
pnpm test:components    # Component tests (separate jest config)
pnpm test:e2e           # E2E tests (separate jest config)

pnpm lint               # ESLint
pnpm lint:fix           # ESLint auto-fix
pnpm format             # Prettier auto-fix
pnpm format:check       # Prettier check
```

Run a single test file: `NODE_OPTIONS='--experimental-vm-modules' npx jest tests/__tests__/path/to/file.test.ts`

## Architecture

### Dual-Mode Entry

`src/cli.ts` is the entry point. With no arguments, it launches the TUI (Ink/React). With arguments, it dispatches to Commander.js CLI commands.

### Key Layers

- **`src/commands/`** — CLI command implementations organized by resource (devbox/, snapshot/, blueprint/, etc.). Each command: validates input → calls `getClient()` → calls API → formats output via `output()`. Command registration is in `src/utils/commands.ts`.
- **`src/services/`** — API service wrappers over `@runloop/api-client`. Commands and TUI screens use these rather than calling the API client directly.
- **`src/screens/`** — Full-screen TUI views (Ink/React).
- **`src/components/`** — Reusable Ink React components.
- **`src/store/`** — Zustand stores for TUI state management with LRU-cached cursor-based pagination.
- **`src/hooks/`** — Custom React hooks for TUI.
- **`src/router/`** — TUI screen navigation system.
- **`src/mcp/`** — MCP server implementation (stdio and HTTP modes).
- **`src/utils/`** — Shared utilities (`output.ts` for text/JSON/YAML formatting, `client.ts` for API client, etc.).

### Important Patterns

- **ESM with `.js` extensions**: This is an ESM project (`"type": "module"`). All relative imports must use `.js` extensions (e.g., `import { foo } from "./bar.js"`).
- **Path aliases**: Use `@/*` which maps to `src/*` (e.g., `import { output } from "@/utils/output.js"`).
- **Output format**: All CLI commands support `-o json|yaml|text` via the `output()` utility.
- **String truncation**: API response strings must be truncated (~200 chars) before storing in Zustand stores to prevent Yoga layout engine crashes in the TUI.
- **Conventional commits**: `<type>(<scope>): <description>` — types: feat, fix, docs, style, refactor, test, chore. Scopes: devbox, snapshot, blueprint, etc.

### Testing

- Tests live in `tests/__tests__/` mirroring the src structure (e.g., `tests/__tests__/commands/devbox/create.test.ts`).
- `tests/setup.ts` extensively mocks Ink, API client, services, stores, and utilities — review it before writing tests.
- Manual mocks in `tests/__mocks__/`.
- Jest uses `ts-jest/presets/default-esm` preset.
