# Bun Implementation Guide

This guide provides step-by-step instructions for implementing Bun support in various ways.

## Option 1: Hybrid Development (RECOMMENDED - Lowest Risk)

Add Bun support for development while keeping Node.js for distribution.

### Step 1: Update package.json

Add Bun-specific scripts alongside existing ones:

```json
{
  "scripts": {
    // Existing scripts (keep these)
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/cli.js",
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",

    // New Bun scripts
    "dev:bun": "bun --watch src/cli.ts",
    "start:bun": "bun run src/cli.ts",
    "test:bun": "bun test",
    "install:bun": "bun install"
  }
}
```

### Step 2: Update CONTRIBUTING.md

Add section about Bun support:

```markdown
### Using Bun (Optional, Faster Development)

For faster development, you can use Bun instead of Node.js + pnpm:

1. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Development workflow:
   ```bash
   # Watch mode (auto-rebuild)
   bun run dev:bun

   # Run CLI directly
   bun run start:bun -- devbox list

   # Run tests
   bun test
   ```

**Note:** The TUI mode (interactive menu) doesn't work with Bun due to stdin limitations.
Use `pnpm start` for testing TUI features. CLI commands work perfectly with Bun.
```

### Step 3: Add .gitignore entry (if needed)

If you want developers to use their own Bun lockfile:
```
bun.lock
```

Or commit it for consistency:
```bash
git add bun.lock
git commit -m "chore: add bun.lock for optional Bun development"
```

### Step 4: Optional - Add to README.md

```markdown
## Development with Bun (Optional)

For faster development experience, you can use [Bun](https://bun.sh):

```bash
bun install
bun run dev:bun
```

Note: TUI mode requires Node.js. Use `pnpm start` for interactive testing.
```

**Time to implement:** 15 minutes
**Risk level:** Very low (no breaking changes)
**Benefits:** Faster dev experience for contributors

---

## Option 2: Dual Distribution (Executables + npm)

Distribute pre-built executables for CLI mode alongside npm package.

### Step 1: Add build scripts to package.json

```json
{
  "scripts": {
    "build:executable": "bun build --compile --minify --bytecode src/cli.ts --outfile rli",
    "build:executables:all": "npm run build:exe:macos && npm run build:exe:linux && npm run build:exe:windows",
    "build:exe:macos": "bun build --compile --target=bun-darwin-arm64 --minify src/cli.ts --outfile dist/executables/rli-macos-arm64",
    "build:exe:macos-x64": "bun build --compile --target=bun-darwin-x64 --minify src/cli.ts --outfile dist/executables/rli-macos-x64",
    "build:exe:linux": "bun build --compile --target=bun-linux-x64 --minify src/cli.ts --outfile dist/executables/rli-linux-x64",
    "build:exe:linux-arm": "bun build --compile --target=bun-linux-arm64 --minify src/cli.ts --outfile dist/executables/rli-linux-arm64",
    "build:exe:windows": "bun build --compile --target=bun-windows-x64 --minify src/cli.ts --outfile dist/executables/rli-windows-x64.exe"
  }
}
```

### Step 2: Create GitHub Actions workflow

Create `.github/workflows/build-executables.yml`:

```yaml
name: Build Executables

on:
  release:
    types: [published]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-executables:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build executables
        run: |
          mkdir -p dist/executables
          bun run build:executables:all

      - name: Create checksums
        run: |
          cd dist/executables
          shasum -a 256 * > checksums.txt

      - name: Upload executables to release
        uses: softprops/action-gh-release@v1
        if: github.event_name == 'release'
        with:
          files: |
            dist/executables/rli-*
            dist/executables/checksums.txt
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: executables
          path: dist/executables/
```

### Step 3: Update README.md

Add installation options:

```markdown
## Installation

### Option 1: npm (Recommended - Includes TUI)

```bash
npm install -g @runloop/rl-cli
```

This gives you both CLI commands and the interactive TUI menu.

### Option 2: Standalone Executable (CLI Only)

Download pre-built executables from [releases](https://github.com/runloopai/rl-cli/releases):

**macOS:**
```bash
# Apple Silicon
curl -fsSL https://github.com/runloopai/rl-cli/releases/latest/download/rli-macos-arm64 -o rli
chmod +x rli
sudo mv rli /usr/local/bin/

# Intel
curl -fsSL https://github.com/runloopai/rl-cli/releases/latest/download/rli-macos-x64 -o rli
chmod +x rli
sudo mv rli /usr/local/bin/
```

**Linux:**
```bash
# x64
curl -fsSL https://github.com/runloopai/rl-cli/releases/latest/download/rli-linux-x64 -o rli
chmod +x rli
sudo mv rli /usr/local/bin/

# ARM64
curl -fsSL https://github.com/runloopai/rl-cli/releases/latest/download/rli-linux-arm64 -o rli
chmod +x rli
sudo mv rli /usr/local/bin/
```

**Windows:**
Download `rli-windows-x64.exe` from releases and add to PATH.

**Note:** Executables only support CLI mode. For the interactive TUI menu, use the npm installation.
```

### Step 4: Detect executable mode in code

Modify `src/cli.ts` to detect and handle executable mode:

```typescript
// At the top of cli.ts, after imports
const isExecutable = typeof Bun !== 'undefined' || process.pkg !== undefined;

// In the main function, before launching TUI:
if (args.length === 0) {
  if (isExecutable) {
    console.error('Interactive TUI mode is not available in the standalone executable.');
    console.error('Use CLI commands instead. Run: rli --help');
    console.error('');
    console.error('For the interactive menu, install via npm:');
    console.error('  npm install -g @runloop/rl-cli');
    processUtils.exit(1);
  }
  const { runMainMenu } = await import("./commands/menu.js");
  runMainMenu();
}
```

**Time to implement:** 2-3 hours
**Risk level:** Medium (need to test on multiple platforms)
**Benefits:** Fast single-file distribution for automation/CI

---

## Option 3: CLI-Only Executable Distribution

Same as Option 2, but completely remove/disable TUI mode from executable build.

### Additional Step: Create separate entrypoint

Create `src/cli-only.ts`:

```typescript
#!/usr/bin/env node

import { exitAlternateScreenBuffer } from "./utils/screen.js";
import { processUtils } from "./utils/processUtils.js";
import { createProgram } from "./utils/commands.js";
import { getApiKeyErrorMessage } from "./utils/config.js";

// Global Ctrl+C handler
processUtils.on("SIGINT", () => {
  exitAlternateScreenBuffer();
  processUtils.stdout.write("\n");
  processUtils.exit(130);
});

const program = createProgram();

(async () => {
  const { initializeTheme } = await import("./utils/theme.js");
  await initializeTheme();

  if (!process.env.RUNLOOP_API_KEY) {
    console.error(getApiKeyErrorMessage());
    processUtils.exit(1);
    return;
  }

  // CLI-only: always require a command
  const args = process.argv.slice(2);
  if (args.length === 0) {
    program.outputHelp();
    processUtils.exit(1);
  } else {
    program.parse();
  }
})();
```

Update build scripts to use this entrypoint:

```json
{
  "scripts": {
    "build:exe:macos": "bun build --compile --target=bun-darwin-arm64 --minify src/cli-only.ts --outfile dist/executables/rli-macos-arm64"
  }
}
```

**Time to implement:** 3-4 hours
**Risk level:** Medium
**Benefits:** Cleaner separation, smaller executables

---

## Option 4: Development Only (LOWEST EFFORT)

Just document Bun usage for contributors, no code changes.

### Step 1: Update CONTRIBUTING.md only

```markdown
## Development Setup

### Standard Setup (Node.js + pnpm)

```bash
pnpm install
pnpm run dev
```

### Alternative: Bun (Faster)

For faster development iteration:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run in watch mode
bun --watch src/cli.ts

# Run tests
bun test
```

**Note:** Interactive TUI doesn't work with Bun. Use `pnpm start` to test the menu system.
All CLI commands work fine with Bun.
```

**Time to implement:** 5 minutes
**Risk level:** None (documentation only)
**Benefits:** Simple, no maintenance overhead

---

## Testing Checklist

Before committing any changes:

- [ ] CLI commands work (`bun run src/cli.ts --help`)
- [ ] MCP server starts (`bun run src/mcp/server.ts`)
- [ ] Build succeeds (`bun run build` if using tsc, or `bun build`)
- [ ] Tests pass (if using `bun test`)
- [ ] Documentation is clear about TUI limitations
- [ ] Executables built for all platforms (if Option 2/3)
- [ ] Verify executable size is acceptable (50-100MB expected)

## CI/CD Integration

A GitHub Actions workflow has been added (`.github/workflows/release.yml`) that automatically:
- Builds executables for all 5 platforms on every release
- Uploads them as release assets
- Generates SHA256 checksums
- Adds installation instructions to release notes

**Platforms built:**
- macOS Apple Silicon (darwin-arm64)
- macOS Intel (darwin-x64)
- Linux x64 (linux-x64)
- Linux ARM64 (linux-arm64)
- Windows x64 (windows-x64)

**Current status:** Executable builds work. Ink and yoga-layout use top-level await, which Bun’s compiler doesn’t support; we avoid it via pnpm patches (see below) and preloading Yoga before Ink in the menu.

## Recommended Approach

**Start with Option 1 (Hybrid Development)**
- Lowest risk
- Immediate benefits for developers
- No user-facing changes
- Can be done in < 30 minutes

**Then consider Option 2 (Dual Distribution)** if:
- Users request standalone executables
- CI/CD automation is a priority
- You want faster startup for scripts
- Willing to maintain additional CI workflow

**Note:** CI/CD is already configured for Option 2. TUI is supported in the compiled binary thanks to the top-level await workaround below.

**Avoid Option 3** unless:
- You explicitly want to deprecate TUI mode
- Target audience is 100% automation/scripting

### Top-level await workaround (TUI in compiled binary)

Ink and its dependency yoga-layout use top-level await, which Bun’s `--compile` does not support. We work around this so the TUI works in the compiled executable:

1. **pnpm patches** (`patches/`, `pnpm.patchedDependencies` in package.json):
   - **ink**: Remove the devtools block that used `await import('./devtools.js')`, so the bundle never pulls in optional `react-devtools-core`.
   - **yoga-layout**: Remove TLA from the default export; export a `yogaReady` promise and a Proxy that delegates to the loaded Yoga once ready.

2. **Menu preload** (`src/commands/menu.tsx`): Before importing Ink, we `await import('yoga-layout').then(m => m.yogaReady)`, so when Ink’s reconciler imports yoga-layout, the Proxy already has Yoga loaded.

After `pnpm install`, patches are applied automatically. Do not remove them if you want `bun build --compile` to succeed with TUI.

## Questions?

- **Will executables work on all platforms?** Yes, Bun supports cross-compilation
- **How big are the executables?** 50-100MB (includes Bun runtime)
- **Can I use Bun for testing?** Yes, but complex Jest configs may need adjustment
- **Does MCP work with Bun?** Yes, tested and working
- **Will TUI ever work with Bun?** Possibly in future Bun versions, monitor GitHub issues
