/**
 * Shared time formatting utilities using the Temporal API.
 */

import { Temporal } from "@js-temporal/polyfill";

/**
 * Get elapsed seconds since the given epoch millisecond timestamp.
 */
function getElapsedSeconds(timestampMs: number): number {
  const now = Temporal.Now.instant();
  const then = Temporal.Instant.fromEpochMilliseconds(timestampMs);
  return Math.floor(now.since(then).total("second"));
}

/**
 * Format a relative timestamp in concise form.
 * Examples: "5s ago", "3m ago", "2h ago", "14d ago", "3mo ago", "1y ago"
 *
 * Used for UI detail components.
 */
export function formatTimeAgo(timestampMs: number): string {
  const seconds = getElapsedSeconds(timestampMs);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Format a relative timestamp in verbose form.
 * Examples: "5 minutes ago", "3 hours ago", "14 days ago"
 *
 * Used for CLI text output (e.g. prune commands).
 */
export function formatRelativeTime(
  timestampMs: number | undefined,
): string {
  if (!timestampMs) return "unknown time";

  const seconds = getElapsedSeconds(timestampMs);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(seconds / 86400);

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
}

/**
 * Format a timestamp with HH:MM:SS time and a relative indicator.
 * Examples: "14:30:05 (3m ago)", "01-15 09:00:00 (2d)"
 *
 * Used for resource list views.
 */
export function formatTimeAgoRich(timestampMs: number): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(timestampMs);
  const zdt = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());

  const time = `${String(zdt.hour).padStart(2, "0")}:${String(zdt.minute).padStart(2, "0")}:${String(zdt.second).padStart(2, "0")}`;

  const seconds = getElapsedSeconds(timestampMs);

  // Less than 1 minute
  if (seconds < 60) return `${time} (${seconds}s ago)`;

  const minutes = Math.floor(seconds / 60);
  // Less than 1 hour
  if (minutes < 60) return `${time} (${minutes}m ago)`;

  const hours = Math.floor(minutes / 60);
  // Less than 24 hours
  if (hours < 24) return `${time} (${hours}hr ago)`;

  const days = Math.floor(hours / 24);

  const month = String(zdt.month).padStart(2, "0");
  const day = String(zdt.day).padStart(2, "0");
  const dateStr = `${month}-${day}`;

  // 1-7 days - show date + time + relative
  if (days <= 7) {
    return `${dateStr} ${time} (${days}d)`;
  }

  // More than 7 days - just date + time
  return `${dateStr} ${time}`;
}
