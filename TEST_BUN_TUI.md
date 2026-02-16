# Testing Bun TUI Compatibility

## Quick Test

To test if the TUI works with Bun after applying the workaround, run:

```bash
# Test the simple Ink app
~/.bun/bin/bun run test-bun-ink.tsx

# Test the actual CLI menu (requires RUNLOOP_API_KEY)
export RUNLOOP_API_KEY=your_key_here
~/.bun/bin/bun run src/cli.ts
```

## Expected Results

### ✅ If Working
- TUI renders properly
- Keyboard input is responsive
- Navigation keys (arrows, Enter, Esc) work
- Ctrl+C exits cleanly

### ❌ If Not Working
You may see one of these errors:

1. **"Raw mode is not supported"**
   - Means stdin.setRawMode is not available
   - Should not happen with Bun 1.3.9+

2. **Program exits immediately**
   - stdin is not resumed
   - Workaround: Add `process.stdin.resume()` before render()

3. **No keyboard response**
   - stdin is paused or unresponsive
   - This is a known Bun bug (issues #6862, #21189)
   - May require running with Node.js instead

## Applied Workarounds

### 1. stdin.resume() in menu.tsx

```typescript
// Added in src/commands/menu.tsx line 47-52
if (typeof Bun !== 'undefined') {
  process.stdin.resume();
}
```

This ensures stdin is active before Ink tries to read from it.

### 2. stdin.resume() in test-bun-ink.tsx

```typescript
// Added before render() call
process.stdin.resume();
```

## Known Issues

As of Bun 1.3.9 (February 2026):

1. **stdin ref/unref incomplete** - PR #17690 still in draft
2. **readline.close() breaks stdin** - Issue #21189, may affect Ink
3. **Multiple Ctrl+C needed** - Some users report needing 2+ presses to exit

## Testing Checklist

Run through these tests manually:

- [ ] TUI renders without errors
- [ ] Arrow keys navigate menus
- [ ] Enter key selects items
- [ ] Typing works in input fields
- [ ] Esc key goes back/exits
- [ ] Ctrl+C exits immediately (single press)
- [ ] No "Raw mode is not supported" error
- [ ] No immediate exit after start

## If TUI Still Doesn't Work

**Option 1:** Use Node.js for TUI, Bun for CLI only
```bash
# TUI with Node.js
pnpm start

# CLI commands with Bun
~/.bun/bin/bun run src/cli.ts devbox list
```

**Option 2:** Wait for Bun fixes
- Monitor PR #17690 (stdin ref/unref fix)
- Monitor issue #21189 (readline/stdin fix)
- Try newer Bun canary releases

**Option 3:** Executable build (CLI only)
Build standalone executable for CLI mode only, keep npm for TUI:
```bash
bun build --compile --minify src/cli.ts --outfile rli
```

## Reporting Issues

If you find TUI issues with Bun, please report to:
- Bun: https://github.com/oven-sh/bun/issues
- Ink: https://github.com/vadimdemedes/ink/issues

Include:
- Bun version (`bun --version`)
- OS and terminal emulator
- Minimal reproduction code
- Full error output
