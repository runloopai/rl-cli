# Bun Migration Investigation Results

**Date:** 2026-02-16 (Updated after deeper investigation)
**Status:** ⚠️ PARTIAL COMPATIBILITY - Workaround applied, manual testing needed

## Executive Summary

Bun investigation revealed that **TUI mode has known compatibility issues**, but a workaround exists. Applied `process.stdin.resume()` fix to `src/commands/menu.tsx`. **CLI mode and MCP server work perfectly**.

**Action Required:** Manual testing in actual terminal needed to confirm TUI functionality (Bash tool doesn't provide TTY).

## Test Results

### ✅ WORKING with Bun
- **CLI commands** (non-interactive mode) - Fully functional
- **MCP server** (stdio and HTTP modes) - Fully functional
- **Package management** (`bun install`) - Works, auto-migrated pnpm-lock.yaml
- **TypeScript execution** - Native support, no compilation needed
- **Build commands** - Compatible with existing build scripts

### ❌ NOT WORKING with Bun
- **TUI mode** (interactive menu) - BLOCKED by Ink raw mode error
- **Interactive input** (useInput hook) - stdin raw mode not supported

### Initial Error (Before Workaround)
```
ERROR Raw mode is not supported on the current process.stdin,
which Ink uses as input stream by default.
```

### Root Cause Identified
**Bun doesn't automatically call `process.stdin.resume()`**, which Ink requires for input handling.
- Issue tracked in: https://github.com/oven-sh/bun/issues/6862
- Raw mode support was added in Bun 0.8.0 (we're on 1.3.9)
- Additional stdin bugs exist: #21189 (readline.close() breaks stdin)
- PR #17690 (stdin ref/unref) still in draft as of Feb 2026

### Workaround Applied
Added `process.stdin.resume()` call in `src/commands/menu.tsx` (line 47-52):

```typescript
if (typeof Bun !== 'undefined') {
  process.stdin.resume();
}
```

Also applied to `test-bun-ink.tsx` for testing.

### Components Affected
- Main menu (`rli` with no args)
- Any component using `useInput` hook
- Interactive prompts and forms
- Keyboard navigation

### Testing Limitation
Cannot fully test TUI in CI environment (Bash tool lacks TTY). **Manual testing required** in real terminal.

## Investigation Timeline

### Phase 1: Initial Testing
- ❌ TUI test failed with "Raw mode is not supported" error
- ✅ CLI commands work perfectly
- ✅ MCP server functional

### Phase 2: Root Cause Analysis
- Found GitHub issue #6862: Bun doesn't call `process.stdin.resume()`
- Discovered raw mode was added in Bun 0.8.0 (current version 1.3.9)
- Identified ongoing issues: #21189 (readline breaks stdin), PR #17690 (ref/unref fixes)

### Phase 3: Workaround Implementation
- Applied `process.stdin.resume()` fix to `src/commands/menu.tsx`
- Created test file with workaround: `test-bun-ink.tsx`
- Created testing guide: `TEST_BUN_TUI.md`

### Phase 4: Status
- **TUI:** Workaround applied, needs manual verification
- **CLI:** Fully tested, working
- **MCP:** Fully tested, working

## Performance Observations

- **Install time:** Bun completed in ~11.6s (pnpm was ~7.3s on first run)
- **Runtime:** CLI commands execute instantly with Bun
- **Native TS:** No compilation step needed during development

## Alternative Approaches

### Option 1: Hybrid Development (RECOMMENDED)
Use Bun for development, Node.js for distribution.

**Benefits:**
- Faster development experience (no compilation, faster tests)
- Keep existing distribution model (npm package)
- No user-facing changes
- CLI mode works perfectly for scripting/CI

**Implementation:**
```json
{
  "scripts": {
    "dev:bun": "bun --watch src/cli.ts",
    "test:bun": "bun test",
    "build": "tsc",
    "start": "node dist/cli.js"
  }
}
```

### Option 2: Dual Distribution
Offer both executables (for CLI mode) and npm package (for TUI + CLI).

**Benefits:**
- Users can download single executable for CLI-only usage
- Full TUI experience still available via npm
- Faster execution for automation/scripting use cases

**Challenges:**
- Need to document two installation methods
- Executables are 50-100MB each
- Need CI to build for multiple platforms

**Implementation:**
- Build executables: `bun build --compile --minify src/cli.ts`
- Detect TUI mode and warn if using executable
- Recommend npm version for interactive use

### Option 3: CLI-Only Executable
Create Bun executable specifically for CLI mode, disable TUI.

**Benefits:**
- Single fast executable for automation
- Perfect for CI/CD pipelines and scripts
- Cross-platform compilation

**Implementation:**
```bash
# Build platform-specific executables
bun build --compile --target=bun-darwin-arm64 --minify src/cli.ts --outfile rli-macos
bun build --compile --target=bun-linux-x64 --minify src/cli.ts --outfile rli-linux
bun build --compile --target=bun-windows-x64 --minify src/cli.ts --outfile rli-windows.exe
```

Modify CLI to detect if running from executable and skip TUI mode.

### Option 4: Development Only (Minimal Impact)
Use Bun only for internal development, no user-facing changes.

**Benefits:**
- Zero risk to users
- Faster dev experience for contributors
- Easy to implement

**Changes:**
- Update CONTRIBUTING.md to mention Bun
- Add `bun.lock` to .gitignore (or commit it)
- Optional: Add Bun scripts to package.json

## Recommendations

### Immediate Actions
1. **Add Bun support for development** (Option 4)
   - Update CONTRIBUTING.md
   - Add optional Bun scripts to package.json
   - No breaking changes

2. **Consider dual distribution** (Option 2) as enhancement
   - Create GitHub workflow to build executables
   - Attach to releases
   - Document both installation methods

### Future Considerations
- Monitor Ink + Bun compatibility (issue may be fixed upstream)
- Watch for Bun runtime improvements
- Consider alternative TUI libraries if executables become priority

## Next Steps

If you want to proceed, I recommend:

1. **Phase 1:** Add Bun development support (no user impact)
   - Update package.json with optional Bun scripts
   - Update documentation
   - Commit bun.lock

2. **Phase 2 (Optional):** Build executables for CLI mode
   - Add executable build scripts
   - Update CI to create binaries
   - Document installation options

3. **Monitor:** Keep watching for Ink + Bun compatibility fixes

## Technical Details

### Files Tested
- `test-bun-ink.tsx` - Minimal Ink app (FAILED - raw mode)
- `src/cli.ts` - Main CLI (SUCCESS)
- `src/mcp/server.ts` - MCP server (SUCCESS)

### Bun Version
```
bun v1.3.9
```

### Dependencies Status
- All dependencies installed successfully
- No compatibility warnings
- pnpm-lock.yaml auto-migrated to bun.lock

## Manual Testing Required

Due to CI environment limitations, the TUI workaround needs manual verification:

```bash
# Test 1: Simple Ink app with workaround
~/.bun/bin/bun run test-bun-ink.tsx

# Test 2: Full CLI with TUI (requires API key)
export RUNLOOP_API_KEY=your_key
~/.bun/bin/bun run src/cli.ts
```

**What to verify:**
- [ ] TUI renders without "Raw mode is not supported" error
- [ ] Keyboard input works (arrow keys, Enter, Esc)
- [ ] Navigation between menu items functions
- [ ] Ctrl+C exits cleanly (single press)
- [ ] No immediate exit after launch

See `TEST_BUN_TUI.md` for detailed testing instructions.

## Recommendations

### If TUI Works After Manual Testing ✅
1. **Keep the workaround** in `src/commands/menu.tsx`
2. **Add Bun support** using Option 1 (Hybrid Development)
3. **Document TUI compatibility** in README with Bun notes
4. **Consider executables** (Option 2) with "CLI only" warning

### If TUI Still Fails After Manual Testing ❌
1. **Revert workaround** from `src/commands/menu.tsx`
2. **Use Bun for development only** (Option 4 - documentation only)
3. **Keep Node.js for distribution** (TUI requires it)
4. **Monitor Bun issues** (#6862, #21189, PR #17690)

## Conclusion

Bun is **proven compatible for CLI mode and MCP**, with **TUI requiring workaround and manual testing**. The `process.stdin.resume()` fix addresses the known issue, but stdin behavior may still be imperfect due to ongoing Bun bugs.

**Best outcome:** TUI works with workaround → Full Bun migration possible
**Fallback:** TUI doesn't work → Bun for dev only, Node for distribution
