# Memory Leak Fix - JavaScript Heap Exhaustion

## Problem

The application was experiencing **JavaScript heap out of memory** errors during navigation and key presses:

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

This is a **memory leak**, not just a rendering crash. The heap was growing unbounded until Node.js ran out of memory (~4GB).

## Root Causes Identified

### 1. Zustand Store Map Memory Leaks (CRITICAL)

**Problem**: Maps were being recreated with shallow copies on every cache operation, accumulating references indefinitely.

```typescript
// BEFORE (LEAKS):
cachePageData: (page, data, lastId) => {
  set((state) => {
    const newPageCache = new Map(state.pageCache); // Shallow copy accumulates
    newPageCache.set(page, data);
    return { pageCache: newPageCache }; // Old map still referenced
  });
}
```

**Why it leaked**:
- Each `new Map(oldMap)` creates a shallow copy
- Both old and new maps hold references to the same data objects
- Old maps are never garbage collected because Zustand keeps them in closure
- After 50+ navigations, hundreds of Map instances exist in memory

**Fix**:
```typescript
// AFTER (FIXED):
cachePageData: (page, data, lastId) => {
  const state = get();
  const pageCache = state.pageCache;
  
  // Aggressive LRU eviction
  if (pageCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = pageCache.keys().next().value;
    pageCache.delete(oldestKey); // Remove old entries
  }
  
  // Create plain objects to avoid SDK references
  const plainData = data.map((d) => ({
    id: d.id,
    name: d.name,
    // ... only essential fields
  }));
  
  pageCache.set(page, plainData); // Direct mutation
  set({}); // Trigger update without creating new Map
}
```

### 2. API SDK Page Object Retention

**Problem**: API SDK returns Page objects that hold references to:
- HTTP client instance
- Response object with headers/body
- Request options with callbacks
- Internal SDK state

**Solution**: Already implemented in services - extract only needed fields immediately:

```typescript
// Extract plain data, null out SDK reference
const plainDevboxes = result.devboxes.map(d => ({
  id: d.id,
  name: d.name,
  // ... only what we need
}));

result = null as any; // Force GC of SDK object
```

### 3. Incomplete Cleanup in clearAll()

**Problem**: `clearAll()` was resetting state but not explicitly clearing Map contents first.

**Fix**:
```typescript
clearAll: () => {
  const state = get();
  // Clear existing structures FIRST
  state.pageCache.clear();
  state.lastIdCache.clear();
  
  // Then reset
  set({
    devboxes: [],
    pageCache: new Map(),
    lastIdCache: new Map(),
    // ...
  });
}
```

### 4. No Memory Monitoring or GC Hints

**Problem**: No way to detect or respond to memory pressure.

**Solution**: Enhanced memory monitoring with automatic GC:

```typescript
// Check memory pressure after navigation
checkMemoryPressure();

// Force GC if needed (requires --expose-gc flag)
tryForceGC('Memory pressure: high');
```

## Files Modified

### Core Fixes (Memory Leaks)

1. **src/store/devboxStore.ts**
   - Fixed Map shallow copy leak
   - Added plain object extraction in cache
   - Enhanced clearAll() with explicit Map.clear()

2. **src/store/blueprintStore.ts**
   - Fixed Map shallow copy leak
   - Added plain object extraction in cache
   - Enhanced clearAll() with explicit Map.clear()

3. **src/store/snapshotStore.ts**
   - Fixed Map shallow copy leak
   - Added plain object extraction in cache
   - Enhanced clearAll() with explicit Map.clear()

### Memory Monitoring

4. **src/utils/memoryMonitor.ts**
   - Added memory threshold warnings (3.5GB warning, 4GB critical)
   - Implemented rate-limited GC forcing
   - Added `checkMemoryPressure()` for automatic GC
   - Added `tryForceGC()` with reason logging

5. **src/router/Router.tsx**
   - Integrated memory monitoring
   - Added `checkMemoryPressure()` after cleanup
   - Logs memory usage before/after transitions

## How to Test

### 1. Build the Project
```bash
npm run build
```

### 2. Run with Memory Monitoring

```bash
# Enable memory debugging
DEBUG_MEMORY=1 npm start

# Or with GC exposed for manual GC
node --expose-gc dist/cli.js
```

### 3. Test Memory Stability

Navigate between screens 20+ times rapidly:
1. Start app: `npm start`
2. Navigate to devbox list
3. Press Escape to go back
4. Repeat 20+ times
5. Monitor heap usage in debug output

**Expected behavior**:
- Heap usage should stabilize after ~10 transitions
- Should see GC messages when pressure is high
- No continuous growth after steady state
- No OOM crashes

### 4. Run Under Memory Pressure

Test with limited heap to ensure cleanup works:

```bash
node --expose-gc --max-old-space-size=1024 dist/cli.js
```

Should run without crashing even with only 1GB heap.

## Success Criteria

✅ **Memory Stabilization**: Heap usage plateaus after 10-20 screen transitions
✅ **No Continuous Growth**: Memory doesn't grow indefinitely during navigation  
✅ **GC Effectiveness**: Forced GC frees significant memory (>50MB)
✅ **No OOM Crashes**: Can navigate 100+ times without crashing
✅ **Performance Maintained**: Navigation remains fast with fixed cache

## Additional Notes

### Why Maps Leaked

JavaScript Maps are more memory-efficient than objects for dynamic key-value storage, but:
- Creating new Maps with `new Map(oldMap)` creates shallow copies
- Shallow copies share references to the same data objects
- If the old Map is retained in closure, both exist in memory
- Zustand's closure-based state kept old Maps alive

### Why Not Remove Cache Entirely?

Caching provides significant UX benefits:
- Instant back navigation (no network request)
- Smooth pagination (previous pages cached)
- Better performance under slow networks

The fix allows us to keep these benefits without the memory leak.

### When to Use --expose-gc

The `--expose-gc` flag allows manual garbage collection:
- **Development**: Always use it to test GC effectiveness
- **Production**: Optional, helps under memory pressure
- **CI/Testing**: Use it to catch memory leaks early

### Memory Thresholds Explained

- **3.5GB (Warning)**: Start warning logs, prepare for GC
- **4GB (Critical)**: Aggressive GC, near Node.js limit
- **4.5GB+**: Node.js will crash with OOM error

By monitoring at 3.5GB, we have 500MB buffer to take action.

## Future Improvements

1. **Implement Real LRU Cache**: Use an LRU library instead of manual implementation
2. **Add Memory Metrics**: Track memory usage over time for monitoring
3. **Lazy Load Components**: Split large components into smaller chunks
4. **Virtual Lists**: Use virtual scrolling for very long lists
5. **Background Cleanup**: Periodically clean old data in idle time

## Prevention Checklist

To prevent memory leaks in future code:

- [ ] Never create shallow copies of large data structures (Maps, arrays)
- [ ] Always extract plain objects from API responses immediately
- [ ] Call `.clear()` on Maps/Sets before reassigning
- [ ] Add memory monitoring to new features
- [ ] Test under memory pressure with `--max-old-space-size`
- [ ] Use React DevTools Profiler to find memory leaks
- [ ] Profile with Chrome DevTools heap snapshots

