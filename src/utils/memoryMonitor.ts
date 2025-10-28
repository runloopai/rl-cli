/**
 * Memory Monitor - Track memory usage and manage GC
 * Helps prevent heap exhaustion during navigation
 */

let lastMemoryUsage: NodeJS.MemoryUsage | null = null;
let gcAttempts = 0;
const MAX_GC_ATTEMPTS_PER_MINUTE = 5;
let lastGCReset = Date.now();

// Memory thresholds (in bytes)
const HEAP_WARNING_THRESHOLD = 3.5e9; // 3.5 GB
const HEAP_CRITICAL_THRESHOLD = 4e9; // 4 GB

export function logMemoryUsage(label: string) {
  if (process.env.NODE_ENV === "development" || process.env.DEBUG_MEMORY) {
    const current = process.memoryUsage();
    const heapUsedMB = (current.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (current.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (current.rss / 1024 / 1024).toFixed(2);

    let delta = "";
    if (lastMemoryUsage) {
      const heapDelta = current.heapUsed - lastMemoryUsage.heapUsed;
      const heapDeltaMB = (heapDelta / 1024 / 1024).toFixed(2);
      delta = ` (Δ ${heapDeltaMB}MB)`;
    }

    console.error(
      `[MEMORY] ${label}: Heap ${heapUsedMB}/${heapTotalMB}MB, RSS ${rssMB}MB${delta}`,
    );

    // Warn if approaching limits
    if (current.heapUsed > HEAP_WARNING_THRESHOLD) {
      console.warn(
        `[MEMORY WARNING] Heap usage is high: ${heapUsedMB}MB (threshold: 3500MB)`,
      );
    }

    lastMemoryUsage = current;
  }
}

export function getMemoryPressure(): "low" | "medium" | "high" | "critical" {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

  if (usage.heapUsed > HEAP_CRITICAL_THRESHOLD || heapUsedPercent > 95)
    return "critical";
  if (usage.heapUsed > HEAP_WARNING_THRESHOLD || heapUsedPercent > 85)
    return "high";
  if (heapUsedPercent > 70) return "medium";
  return "low";
}

export function shouldTriggerGC(): boolean {
  const pressure = getMemoryPressure();
  return pressure === "high" || pressure === "critical";
}

/**
 * Force garbage collection if available and needed
 * Respects rate limiting to avoid GC thrashing
 */
export function tryForceGC(reason?: string): boolean {
  // Reset GC attempt counter every minute
  const now = Date.now();
  if (now - lastGCReset > 60000) {
    gcAttempts = 0;
    lastGCReset = now;
  }

  // Rate limit GC attempts
  if (gcAttempts >= MAX_GC_ATTEMPTS_PER_MINUTE) {
    return false;
  }

  // Check if global.gc is available (requires --expose-gc flag)
  if (typeof global.gc === "function") {
    const beforeHeap = process.memoryUsage().heapUsed;

    global.gc();
    gcAttempts++;

    const afterHeap = process.memoryUsage().heapUsed;
    const freedMB = ((beforeHeap - afterHeap) / 1024 / 1024).toFixed(2);

    if (process.env.DEBUG_MEMORY) {
      console.error(
        `[MEMORY] Forced GC${reason ? ` (${reason})` : ""}: Freed ${freedMB}MB`,
      );
    }

    return true;
  }

  return false;
}

/**
 * Monitor memory and trigger GC if needed
 * Call this after major operations like screen transitions
 */
export function checkMemoryPressure(): void {
  const pressure = getMemoryPressure();

  if (pressure === "critical" || pressure === "high") {
    tryForceGC(`Memory pressure: ${pressure}`);
  }
}
