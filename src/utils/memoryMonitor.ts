/**
 * Memory Monitor - Track memory usage in development
 */

let lastMemoryUsage: NodeJS.MemoryUsage | null = null;

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
    lastMemoryUsage = current;
  }
}

export function getMemoryPressure(): "low" | "medium" | "high" {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

  if (heapUsedPercent > 90) return "high";
  if (heapUsedPercent > 70) return "medium";
  return "low";
}

export function shouldTriggerGC(): boolean {
  return getMemoryPressure() === "high";
}
