import React from "react";

export interface CursorPaginationConfig<T> {
  /** Page size (items per page) */
  pageSize: number;

  /** Fetch function that takes query params and returns a page of results */
  fetchPage: (params: {
    limit: number;
    starting_at?: string;
    [key: string]: any;
  }) => Promise<{
    items: T[];
    total_count?: number;
    has_more?: boolean;
  }>;

  /** Additional query params (e.g., status filter) */
  queryParams?: Record<string, any>;

  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;

  /** Key extractor to get ID from item */
  getItemId: (item: T) => string;
}

export interface CursorPaginationResult<T> {
  /** Current page items */
  items: T[];

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: Error | null;

  /** Current page number (0-indexed) */
  currentPage: number;

  /** Total count of items (if available from API) */
  totalCount: number;

  /** Whether there are more pages */
  hasMore: boolean;

  /** Whether currently refreshing */
  refreshing: boolean;

  /** Go to next page */
  nextPage: () => void;

  /** Go to previous page */
  prevPage: () => void;

  /** Go to specific page */
  goToPage: (page: number) => void;

  /** Refresh current page */
  refresh: () => void;

  /** Clear cache */
  clearCache: () => void;
}

export function useCursorPagination<T>(
  config: CursorPaginationConfig<T>,
): CursorPaginationResult<T> {
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // Cache for page data and cursors
  const pageCache = React.useRef<Map<number, T[]>>(new Map());
  const lastIdCache = React.useRef<Map<number, string>>(new Map());

  // Store config and state in refs to avoid dependency issues
  const configRef = React.useRef(config);
  const loadingRef = React.useRef(loading);
  const hasMoreRef = React.useRef(hasMore);
  const currentPageRef = React.useRef(currentPage);

  // Keep refs in sync with state
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  React.useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  React.useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  React.useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Fetch function ref - defined once, uses refs for all dependencies
  const fetchDataRef = React.useRef<
    (page: number, isInitialLoad: boolean) => Promise<void>
  >(async () => {
    // Placeholder - will be replaced immediately
  });

  // Initialize fetchData function
  fetchDataRef.current = async (
    page: number,
    isInitialLoad: boolean = false,
  ) => {
    try {
      if (isInitialLoad) {
        setRefreshing(true);
      }
      setLoading(true);
      loadingRef.current = true;

      // Check cache first (skip on refresh)
      if (!isInitialLoad && pageCache.current.has(page)) {
        const cachedItems = pageCache.current.get(page) || [];
        setItems(cachedItems);
        setLoading(false);
        loadingRef.current = false;
        return;
      }

      const pageItems: T[] = [];
      const config = configRef.current;

      // Get starting_at cursor from previous page's last ID
      const startingAt =
        page > 0 ? lastIdCache.current.get(page - 1) : undefined;

      // Build query params
      const queryParams: any = {
        limit: config.pageSize,
        ...config.queryParams,
      };
      if (startingAt) {
        queryParams.starting_at = startingAt;
      }

      // Fetch the page
      const result = await config.fetchPage(queryParams);

      // Extract items (handle both array response and paginated response)
      const fetchedItems = Array.isArray(result) ? result : result.items;
      pageItems.push(...fetchedItems.slice(0, config.pageSize));

      // Update pagination metadata
      if (!Array.isArray(result)) {
        setTotalCount(result.total_count || pageItems.length);
        const hasMoreValue = result.has_more || false;
        setHasMore(hasMoreValue);
        hasMoreRef.current = hasMoreValue;
      } else {
        setTotalCount(pageItems.length);
        setHasMore(false);
        hasMoreRef.current = false;
      }

      // Cache the page data and last ID
      if (pageItems.length > 0) {
        pageCache.current.set(page, pageItems);
        lastIdCache.current.set(
          page,
          config.getItemId(pageItems[pageItems.length - 1]),
        );
      }

      // Update items for current page
      setItems(pageItems);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      if (isInitialLoad) {
        setTimeout(() => setRefreshing(false), 300);
      }
    }
  };

  // Initial load and page changes
  React.useEffect(() => {
    if (fetchDataRef.current) {
      fetchDataRef.current(currentPage, true);
    }
  }, [currentPage]);

  // Auto-refresh - recreate interval when refreshInterval changes
  React.useEffect(() => {
    const interval = config.refreshInterval;
    if (!interval || interval <= 0) {
      return;
    }

    const refreshTimer = setInterval(() => {
      // Clear cache on refresh
      pageCache.current.clear();
      lastIdCache.current.clear();
      if (fetchDataRef.current) {
        fetchDataRef.current(currentPageRef.current, false);
      }
    }, interval);

    return () => clearInterval(refreshTimer);
  }, [config.refreshInterval]); // Only recreate when refreshInterval changes

  const nextPage = () => {
    if (!loadingRef.current && hasMoreRef.current) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const prevPage = () => {
    if (!loadingRef.current && currentPageRef.current > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const goToPage = (page: number) => {
    if (!loadingRef.current && page >= 0) {
      setCurrentPage(page);
    }
  };

  const refresh = () => {
    pageCache.current.clear();
    lastIdCache.current.clear();
    if (fetchDataRef.current) {
      fetchDataRef.current(currentPageRef.current, true);
    }
  };

  const clearCache = () => {
    pageCache.current.clear();
    lastIdCache.current.clear();
  };

  return {
    items,
    loading,
    error,
    currentPage,
    totalCount,
    hasMore,
    refreshing,
    nextPage,
    prevPage,
    goToPage,
    refresh,
    clearCache,
  };
}
