import React from "react";

/**
 * Configuration for the paginated list hook
 */
export interface UsePaginatedListConfig<T> {
  /**
   * Fetch function that takes pagination params and returns a page of results
   */
  fetchPage: (params: {
    limit: number;
    startingAt?: string;
  }) => Promise<{
    items: T[];
    hasMore: boolean;
    totalCount?: number;
  }>;

  /** Number of items per page */
  pageSize: number;

  /** Extract unique ID from an item (used for cursor tracking) */
  getItemId: (item: T) => string;

  /** Polling interval in ms (default 2000, set to 0 to disable) */
  pollInterval?: number;

  /** Dependencies that reset pagination when changed (e.g., filters, search) */
  deps?: any[];

  /** Whether polling is enabled (can be used to pause during interactions) */
  pollingEnabled?: boolean;
}

/**
 * Result returned by the paginated list hook
 */
export interface UsePaginatedListResult<T> {
  /** Current page items */
  items: T[];

  /** True during initial load only (no items yet) */
  loading: boolean;

  /** True when navigating between pages (shows existing items while loading) */
  navigating: boolean;

  /** Error from last fetch attempt */
  error: Error | null;

  /** Current page number (0-indexed) */
  currentPage: number;

  /** Whether there are more pages after current */
  hasMore: boolean;

  /** Whether there are pages before current (currentPage > 0) */
  hasPrev: boolean;

  /** Total count of items (if available from API) */
  totalCount: number;

  /** Navigate to next page */
  nextPage: () => void;

  /** Navigate to previous page */
  prevPage: () => void;

  /** Refresh current page */
  refresh: () => void;
}

/**
 * Hook for cursor-based pagination with polling.
 *
 * Design:
 * - No caching: always fetches fresh data on navigation or poll
 * - Cursor history: tracks the last item ID of each visited page
 *   - cursorHistory[N] = last item ID of page N (used as startingAt for page N+1)
 * - Polling: refreshes current page every pollInterval ms
 *
 * Navigation:
 * - Page 0: startingAt = undefined
 * - Page N: startingAt = cursorHistory[N-1]
 * - Going back uses known cursor from history
 */
export function useCursorPagination<T>(
  config: UsePaginatedListConfig<T>,
): UsePaginatedListResult<T> {
  const {
    fetchPage,
    pageSize,
    getItemId,
    pollInterval = 2000,
    deps = [],
    pollingEnabled = true,
  } = config;

  // State
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [navigating, setNavigating] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);

  // Cursor history: cursorHistory[N] = last item ID of page N
  // Used to determine startingAt for page N+1
  const cursorHistoryRef = React.useRef<(string | undefined)[]>([]);

  // Track if component is mounted
  const isMountedRef = React.useRef(true);

  // Track if we're currently fetching (to prevent concurrent fetches)
  const isFetchingRef = React.useRef(false);

  // Store stable references to config
  const fetchPageRef = React.useRef(fetchPage);
  const getItemIdRef = React.useRef(getItemId);
  const pageSizeRef = React.useRef(pageSize);

  // Keep refs in sync
  React.useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  React.useEffect(() => {
    getItemIdRef.current = getItemId;
  }, [getItemId]);

  React.useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch a specific page
   * @param page - Page number to fetch (0-indexed)
   * @param isInitialLoad - Whether this is the initial load (shows loading state)
   * @param isNavigation - Whether this is a page navigation (shows navigating state)
   */
  const fetchPageData = React.useCallback(
    async (page: number, isInitialLoad: boolean = false, isNavigation: boolean = false) => {
      if (!isMountedRef.current) return;
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;

      try {
        if (isInitialLoad) {
          setLoading(true);
        }
        if (isNavigation) {
          setNavigating(true);
        }
        setError(null);

        // Determine startingAt cursor:
        // - Page 0: undefined
        // - Page N: cursorHistory[N-1] (last item ID from previous page)
        const startingAt =
          page > 0 ? cursorHistoryRef.current[page - 1] : undefined;

        const result = await fetchPageRef.current({
          limit: pageSizeRef.current,
          startingAt,
        });

        if (!isMountedRef.current) return;

        // Update items
        setItems(result.items);

        // Update cursor history for this page
        if (result.items.length > 0) {
          const lastItemId = getItemIdRef.current(
            result.items[result.items.length - 1],
          );
          cursorHistoryRef.current[page] = lastItemId;
        }

        // Update pagination state
        setHasMore(result.hasMore);
        if (result.totalCount !== undefined) {
          setTotalCount(result.totalCount);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err as Error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setNavigating(false);
        }
        isFetchingRef.current = false;
      }
    },
    [], // No dependencies - uses refs for stability
  );

  // Reset when deps change (e.g., filters, search)
  const depsKey = JSON.stringify(deps);
  React.useEffect(() => {
    // Clear cursor history when deps change
    cursorHistoryRef.current = [];
    setCurrentPage(0);
    setItems([]);
    setHasMore(false);
    setTotalCount(0);
    // Fetch page 0
    fetchPageData(0, true);
  }, [depsKey, fetchPageData]);

  // Polling effect
  React.useEffect(() => {
    if (!pollInterval || pollInterval <= 0 || !pollingEnabled) {
      return;
    }

    const timer = setInterval(() => {
      if (isMountedRef.current && !isFetchingRef.current) {
        fetchPageData(currentPage, false);
      }
    }, pollInterval);

    return () => clearInterval(timer);
  }, [pollInterval, pollingEnabled, currentPage, fetchPageData]);

  // Navigation functions
  const nextPage = React.useCallback(() => {
    if (!loading && !navigating && hasMore) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchPageData(newPage, false, true);
    }
  }, [loading, navigating, hasMore, currentPage, fetchPageData]);

  const prevPage = React.useCallback(() => {
    if (!loading && !navigating && currentPage > 0) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchPageData(newPage, false, true);
    }
  }, [loading, navigating, currentPage, fetchPageData]);

  const refresh = React.useCallback(() => {
    fetchPageData(currentPage, false);
  }, [currentPage, fetchPageData]);

  return {
    items,
    loading,
    navigating,
    error,
    currentPage,
    hasMore,
    hasPrev: currentPage > 0,
    totalCount,
    nextPage,
    prevPage,
    refresh,
  };
}
