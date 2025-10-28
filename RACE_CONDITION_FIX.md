# Race Condition Fix - Yoga WASM Memory Access Error

## Problem

A `RuntimeError: memory access out of bounds` was occurring in the yoga-layout WASM module during screen transitions. This happened specifically when navigating between screens (e.g., pressing Escape on the devbox list to go back to the menu).

### Root Cause

The error was caused by a race condition involving several factors:

1. **Debounced Rendering**: Ink uses debounced rendering (via es-toolkit's debounce, ~20-50ms delay)
2. **Async State Updates**: Components had async operations (data fetching) that could complete after navigation
3. **Partial Unmounting**: When a component started unmounting, debounced renders could still fire on the partially-cleaned-up tree
4. **Yoga Layout Calculation**: During these late renders, yoga-layout tried to calculate layout (`getComputedWidth`) for freed memory, causing memory access violations

**Key Insight**: You don't need debounced rendering - it's built into Ink and can't be disabled. Instead, we need to handle component lifecycle properly to work with it.

## Solution

We implemented multiple layers of protection to prevent race conditions:

### 1. Router-Level Protection with React Keys (`src/router/Router.tsx`)

**This is the primary fix** - Using React's `key` prop to force complete unmount/remount:

- When the `key` changes, React completely unmounts the old component tree and mounts a new one
- This prevents any overlap between old and new screens during transitions
- No custom state management or delays needed - React handles the lifecycle correctly

```typescript
// Use screen name as key to force complete remount on navigation
return (
  <ErrorBoundary key={`boundary-${currentScreen}`}>
    <ScreenComponent key={currentScreen} {...params} />
  </ErrorBoundary>
);
```

This is **the React-idiomatic solution** for this exact problem. When the screen changes:
1. React immediately unmounts the old screen component
2. All cleanup functions run synchronously
3. React mounts the new screen component
4. No race condition possible because they never overlap

### 2. Component-Level Mounted State Tracking

Added `isMounted` ref tracking to all major components:

- `DevboxListScreen.tsx`
- `DevboxDetailPage.tsx`
- `BlueprintListScreen` (via `ListBlueprintsUI`)
- `ResourceListView.tsx`

Each component now:

1. Tracks its mounted state with a ref
2. Checks `isMounted.current` before any state updates
3. Guards all async operations with mounted checks
4. Prevents input handling when unmounting

```typescript
const isMounted = React.useRef(true);

React.useEffect(() => {
  isMounted.current = true;
  return () => {
    isMounted.current = false;
  };
}, []);
```

### 3. Async Operation Protection

All async operations (like data fetching) now check mounted state:

- Before starting the operation
- After awaiting async calls
- Before calling state setters
- In finally blocks

```typescript
React.useEffect(() => {
  let effectMounted = true;

  const fetchData = async () => {
    if (!isMounted.current) return;

    try {
      const result = await someAsyncCall();
      
      if (!effectMounted || !isMounted.current) return;
      
      setState(result);
    } catch (err) {
      if (effectMounted && isMounted.current) {
        setError(err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => {
    effectMounted = false;
  };
}, [dependencies]);
```

### 4. Input Handler Protection

All `useInput` handlers now check mounted state at the start:

```typescript
useInput((input, key) => {
  if (!isMounted.current) return;
  
  // ... handle input
});
```

### 5. ErrorBoundary (`src/components/ErrorBoundary.tsx`)

Added an ErrorBoundary to catch any remaining Yoga errors gracefully:

- Catches React errors including Yoga WASM crashes
- Displays user-friendly error message instead of crashing
- Allows recovery from unexpected errors

### 6. Table Safety Checks (`src/components/Table.tsx`)

Added null/undefined checks for data prop:

```typescript
if (!data || !Array.isArray(data)) {
  return emptyState ? <>{emptyState}</> : null;
}
```

## Files Modified

1. `src/router/Router.tsx` - **PRIMARY FIX**: Added key prop and ErrorBoundary
2. `src/components/ErrorBoundary.tsx` - **NEW**: Error boundary for graceful error handling
3. `src/components/Table.tsx` - Added null/undefined checks
4. `src/screens/DevboxListScreen.tsx` - Added mounted tracking (defense in depth)
5. `src/components/DevboxDetailPage.tsx` - Added mounted tracking (defense in depth)
6. `src/commands/blueprint/list.tsx` - Added mounted tracking (defense in depth)
7. `src/components/ResourceListView.tsx` - Added mounted tracking (defense in depth)

## Testing

To verify the fix:

1. Build the project: `npm run build`
2. Navigate to devbox list screen
3. Press Escape rapidly to go back
4. Try multiple quick transitions between screens
5. The WASM error should no longer occur

## Technical Details

The yoga-layout library (used by Ink for flexbox layout calculations) runs in WebAssembly. When components unmount during a debounced render cycle:

- The component tree is partially cleaned up
- Debounced render fires (after ~20-50ms delay)
- Yoga tries to calculate layout (`getComputedWidth`)
- Accesses memory that's already been freed
- Results in "memory access out of bounds" error

Our solution ensures:
- No renders occur during transitions (Router-level protection)
- No state updates occur after unmount (Component-level protection)
- All async operations are properly cancelled (Effect cleanup)
- Input handlers don't fire after unmount (Handler guards)

## Do You Need Debounced Rendering?

**Short answer: It's already built into Ink and you can't disable it.**

Ink uses debounced rendering internally (via es-toolkit's debounce) to improve performance. This is not something you added or can remove. Instead of fighting it, the solution is to:

1. **Use React keys properly** for route changes (forces clean unmount/remount)
2. **Track mounted state** in components with async operations
3. **Add ErrorBoundaries** to catch unexpected errors gracefully
4. **Validate data** before rendering (null checks, array checks, etc.)

## Prevention

To prevent similar issues in the future:

1. **Always use `key` props when conditionally rendering different components** - This forces React to properly unmount/remount
2. Track mounted state in components with async operations
3. Check mounted state before all state updates
4. Guard async operations with effect-scoped flags
5. Add early returns in input handlers for unmounted state
6. Wrap unstable components in ErrorBoundaries
7. Validate all data before rendering (especially arrays and objects)

