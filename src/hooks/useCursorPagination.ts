import React from 'react';

export interface CursorPaginationConfig<T> {
  /** Page size (items per page) */
  pageSize: number;

  /** Fetch function that takes query params and returns a page of results */
  fetchPage: (params: { limit: number; starting_at?: string; [key: string]: any }) => Promise<{
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
  config: CursorPaginationConfig<T>
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

  const fetchData = React.useCallback(async (isInitialLoad: boolean = false) => {
    try {
      if (isInitialLoad) {
        setRefreshing(true);
      }
      setLoading(true);

      // Check cache first (skip on refresh)
      if (!isInitialLoad && pageCache.current.has(currentPage)) {
        setItems(pageCache.current.get(currentPage) || []);
        setLoading(false);
        return;
      }

      const pageItems: T[] = [];

      // Get starting_at cursor from previous page's last ID
      const startingAt = currentPage > 0 ? lastIdCache.current.get(currentPage - 1) : undefined;

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
        setHasMore(result.has_more || false);
      } else {
        setTotalCount(pageItems.length);
        setHasMore(false);
      }

      // Cache the page data and last ID
      if (pageItems.length > 0) {
        pageCache.current.set(currentPage, pageItems);
        lastIdCache.current.set(currentPage, config.getItemId(pageItems[pageItems.length - 1]));
      }

      // Update items for current page
      setItems(pageItems);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      if (isInitialLoad) {
        setTimeout(() => setRefreshing(false), 300);
      }
    }
  }, [currentPage, config]);

  // Initial load and page changes
  React.useEffect(() => {
    fetchData(true);
  }, [fetchData, currentPage]);

  // Auto-refresh
  React.useEffect(() => {
    if (!config.refreshInterval || config.refreshInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      // Clear cache on refresh
      pageCache.current.clear();
      lastIdCache.current.clear();
      fetchData(false);
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.refreshInterval, fetchData]);

  const nextPage = React.useCallback(() => {
    if (!loading && hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  const prevPage = React.useCallback(() => {
    if (!loading && currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [loading, currentPage]);

  const goToPage = React.useCallback((page: number) => {
    if (!loading && page >= 0) {
      setCurrentPage(page);
    }
  }, [loading]);

  const refresh = React.useCallback(() => {
    pageCache.current.clear();
    lastIdCache.current.clear();
    fetchData(true);
  }, [fetchData]);

  const clearCache = React.useCallback(() => {
    pageCache.current.clear();
    lastIdCache.current.clear();
  }, []);

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
