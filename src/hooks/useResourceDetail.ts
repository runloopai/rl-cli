import React from "react";

export interface UseResourceDetailOptions<T> {
  /** Resource id to fetch; when undefined, no fetch or poll runs */
  id: string | undefined;
  /** Fetch function called with id */
  fetch: (id: string) => Promise<T>;
  /** Optional initial data (e.g. from store) shown until first fetch resolves */
  initialData?: T | null;
  /** Polling interval in ms; omit or 0 to disable */
  pollInterval?: number;
  /** When provided, polling only runs while this returns true (e.g. status is in-progress) */
  shouldPoll?: (data: T) => boolean;
}

export interface UseResourceDetailResult<T> {
  /** Current resource data (from initialData until fetch resolves, then from fetch/poll) */
  data: T | null;
  /** True while the initial fetch for this id is in progress */
  loading: boolean;
  /** Error from the last fetch attempt (poll errors are ignored) */
  error: Error | null;
}

/**
 * Shared hook for detail view: "get state for this resource" and optional "poll it".
 * Single source of truth for detail data; no callbacks to parent.
 */
export function useResourceDetail<T>({
  id,
  fetch: fetchFn,
  initialData,
  pollInterval = 0,
  shouldPoll,
}: UseResourceDetailOptions<T>): UseResourceDetailResult<T> {
  const [data, setData] = React.useState<T | null>(initialData ?? null);
  const [loading, setLoading] = React.useState(!!id);
  const [error, setError] = React.useState<Error | null>(null);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset state when id changes
  React.useEffect(() => {
    if (!id) {
      setData(initialData ?? null);
      setLoading(false);
      setError(null);
      return;
    }
    setData(initialData ?? null);
    setError(null);
    setLoading(true);
  }, [id, initialData]);

  // Initial fetch when id is set
  React.useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFn(id)
      .then((result) => {
        if (!cancelled && isMounted.current) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && isMounted.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          // Keep initialData if we had it
          if (initialData != null) {
            setData(initialData);
          }
        }
      })
      .finally(() => {
        if (!cancelled && isMounted.current) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, fetchFn]);

  // Polling: only when pollInterval > 0, we have data, and shouldPoll(data) is true
  React.useEffect(() => {
    if (!id || pollInterval <= 0 || !data) return;
    if (shouldPoll && !shouldPoll(data)) return;

    const interval = setInterval(() => {
      if (!isMounted.current) return;
      fetchFn(id)
        .then((result) => {
          if (isMounted.current) {
            setData(result);
          }
        })
        .catch(() => {
          // Silently ignore polling errors
        });
    }, pollInterval);

    return () => clearInterval(interval);
  }, [id, fetchFn, pollInterval, data, shouldPoll]);

  return { data, loading, error };
}
