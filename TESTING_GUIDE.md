# Testing Guide - Architecture Refactor

## Quick Start

```bash
# Build the project
npm run build

# Test with memory monitoring enabled
DEBUG_MEMORY=1 npm start

# Or use the built CLI directly
DEBUG_MEMORY=1 node dist/cli.js
```

## Test Scenarios

### 1. Memory Stability Test (Critical)

**Goal:** Verify no memory leaks during rapid screen transitions

**Steps:**
1. Start CLI with memory monitoring:
   ```bash
   DEBUG_MEMORY=1 npm start
   ```

2. Perform rapid transitions (repeat 50-100 times):
   - Select "Devboxes" (Enter)
   - Select first devbox (Enter)
   - Press "a" for actions
   - Press Esc to go back
   - Press Esc to go back to menu
   - Repeat

3. **Expected Result:**
   - Memory should stabilize around 200-400MB
   - Each route change should show: `[MEMORY] Route change: X → Y`
   - Cleanup should show: `[MEMORY] Cleared devbox store (Δ -XMB)`
   - **NO heap exhaustion errors**
   - **NO "out of memory" crashes**

4. **Before Refactor:**
   - Would crash with heap exhaustion after ~50 transitions

5. **After Refactor:**
   - Should handle 100+ transitions without memory growth

### 2. Navigation Flow Test

**Goal:** Verify all navigation paths work correctly

**Test Cases:**

#### A. Devbox List Navigation
```
Menu → Devboxes → [Select] → Detail → [Esc] → List → [Esc] → Menu
✅ Check: Smooth transitions, no flashing
✅ Check: List state preserved when returning
```

#### B. Create Flow
```
Menu → Devboxes → [c] Create → Fill form → Create → List updates
✅ Check: New devbox appears in list
✅ Check: Returns to list after creation
```

#### C. Actions Flow
```
Menu → Devboxes → [Select] → [a] Actions → [l] Logs → [Esc] → Actions → [Esc] → List
✅ Check: Actions menu shows operations
✅ Check: Logs display correctly
✅ Check: Can navigate back cleanly
```

#### D. SSH Flow (Special Case)
```
Menu → Devboxes → [Select] → [a] Actions → [s] SSH → (exit SSH) → Returns to list
✅ Check: SSH session works
✅ Check: After exit, returns to devbox list
✅ Check: Original devbox is focused
```

### 3. Search & Pagination Test

**Goal:** Verify list functionality

**Steps:**
1. Navigate to Devboxes
2. Press `/` to enter search mode
3. Type a search query
4. Press Enter
5. Verify filtered results
6. Press Esc to clear search
7. Use `←` `→` to navigate pages
8. Verify page transitions

**Expected:**
- Search query is applied correctly
- Results update in real-time
- Pagination works smoothly
- Cache is used for previously viewed pages
- Memory is cleared when changing search query

### 4. Blueprint & Snapshot Lists

**Goal:** Verify other list commands work

**Steps:**
1. Menu → Blueprints
2. Navigate, search, paginate
3. Press Esc to return to menu
4. Menu → Snapshots
5. Navigate, search, paginate
6. Press Esc to return to menu

**Expected:**
- Both lists function correctly
- Memory is cleared when returning to menu
- No crashes or errors

### 5. Error Handling Test

**Goal:** Verify graceful error handling

**Test Cases:**

#### A. Network Error
```
# Disconnect network
Menu → Devboxes → (wait for error)
✅ Check: Error message displayed
✅ Check: Can press Esc to go back
✅ Check: No crash
```

#### B. Invalid Devbox
```
# Select a devbox, then delete it via API
Menu → Devboxes → [Select deleted] → Error
✅ Check: Graceful error handling
✅ Check: Returns to list
```

### 6. Performance Test

**Goal:** Measure responsiveness

**Metrics:**
- Screen transition time: < 100ms
- List load time: < 500ms (cached), < 2s (fresh)
- Search response time: < 200ms
- Memory per screen: < 50MB additional

**How to measure:**
```bash
# Memory logs show timestamps and deltas
DEBUG_MEMORY=1 npm start

# Look for patterns like:
[MEMORY] Route change: menu → devbox-list: Heap 150.23MB (Δ 10.45MB)
[MEMORY] Route change: devbox-list → menu: Heap 145.12MB (Δ -15.67MB)
```

## Regression Tests

### Previously Fixed Issues

1. **✅ Viewport Overflow**
   - Issue: Devbox list overflowed by 1-2 lines
   - Test: Check list fits exactly in terminal
   - Verify: No content cut off at bottom

2. **✅ Log Viewer Multi-line**
   - Issue: Newlines in logs broke layout
   - Test: View logs with multi-line content
   - Verify: Newlines shown as `\n`, layout stable

3. **✅ Yoga Crashes**
   - Issue: Long strings crashed Yoga layout engine
   - Test: View devbox with very long name or logs
   - Verify: No "memory access out of bounds" error

4. **✅ "More above/below" Flow**
   - Issue: Dynamic indicators caused layout issues
   - Test: Scroll in logs or command output
   - Verify: Arrows (↑ ↓) shown inline in stats bar

5. **✅ Heap Exhaustion**
   - Issue: Memory leak after 3-4 screen transitions
   - Test: Rapid transitions (100x)
   - Verify: Memory stable, no crash

## Automated Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Check for TypeScript errors
npm run build

# Lint
npm run lint
```

## Memory Profiling (Advanced)

### Using Node.js Inspector

```bash
# Start with inspector
node --inspect dist/cli.js

# Open Chrome DevTools
# chrome://inspect
# Click "Open dedicated DevTools for Node"
# Go to Memory tab
# Take heap snapshots before/after transitions
```

### Expected Heap Snapshot Results

**Before Transition:**
- Devbox objects: ~100 items × 2KB = 200KB
- React fiber nodes: ~50KB
- Zustand store: ~50KB
- **Total: ~300KB**

**After 10 Transitions (Old Pattern):**
- Devbox objects: ~1000 items × 2KB = 2MB
- React fiber nodes: 10 instances × 50KB = 500KB
- Abandoned Ink instances: 9 × 1MB = 9MB
- **Total: ~11.5MB 🔴 LEAK**

**After 10 Transitions (New Pattern):**
- Devbox objects: ~100 items × 2KB = 200KB (only current screen)
- React fiber nodes: ~50KB (single instance)
- Zustand store: ~50KB
- **Total: ~300KB ✅ NO LEAK**

## Debugging

### Enable Debug Logs

```bash
# Memory monitoring
DEBUG_MEMORY=1 npm start

# Full debug output
DEBUG=* npm start

# Node memory warnings
node --trace-warnings dist/cli.js
```

### Common Issues

#### Memory still growing?
1. Check store cleanup is called:
   ```
   [MEMORY] Cleared devbox store
   ```
2. Look for large objects in heap:
   ```bash
   node --expose-gc --inspect dist/cli.js
   # Force GC and compare snapshots
   ```

#### Screen not updating?
1. Check navigation store state:
   ```typescript
   console.log(useNavigationStore.getState());
   ```
2. Verify screen is registered in menu.tsx

#### Crashes on transition?
1. Check for long strings (>1000 chars)
2. Verify cleanup timers are cleared
3. Look for Yoga errors in logs

## Success Criteria

✅ **All tests pass**
✅ **Memory stable after 100 transitions**
✅ **No crashes during normal use**
✅ **SSH flow works correctly**
✅ **All operations functional**
✅ **Responsive UI (< 100ms transitions)**

## Reporting Issues

If you find issues, capture:

1. **Steps to reproduce**
2. **Memory logs** (if applicable)
3. **Error messages** (full stack trace)
4. **Terminal size** (`echo $COLUMNS x $LINES`)
5. **Node version** (`node --version`)
6. **Build output** (`npm run build` errors)

## Rollback

If critical issues found:

```bash
# Revert menu.tsx changes
git checkout HEAD -- src/commands/menu.tsx

# Rebuild
npm run build

# Test old pattern
npm start
```

Old components still exist and can be re-wired if needed.

