import React from "react";

export interface UseListSearchOptions {
  /** Callback when search query is submitted */
  onSearchSubmit?: (query: string) => void;
  /** Callback when search is cleared */
  onSearchClear?: () => void;
}

export interface UseListSearchReturn {
  /** Whether search input mode is active */
  searchMode: boolean;
  /** Current search query being typed */
  searchQuery: string;
  /** The submitted/active search query */
  submittedSearchQuery: string;
  /** Enter search mode */
  enterSearchMode: () => void;
  /** Exit search mode without submitting */
  cancelSearch: () => void;
  /** Update the search query text */
  setSearchQuery: (query: string) => void;
  /** Submit the current search query */
  submitSearch: () => void;
  /** Clear the submitted search and reset */
  clearSearch: () => void;
  /** Handle escape key - returns true if handled */
  handleEscape: () => boolean;
  /** Calculate additional overhead for search bar */
  getSearchOverhead: () => number;
}

/**
 * Shared hook for managing search state in list views.
 * Provides consistent search behavior across all resource lists.
 */
export function useListSearch(
  options: UseListSearchOptions = {},
): UseListSearchReturn {
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [submittedSearchQuery, setSubmittedSearchQuery] = React.useState("");

  const enterSearchMode = React.useCallback(() => {
    setSearchMode(true);
  }, []);

  const cancelSearch = React.useCallback(() => {
    setSearchMode(false);
    setSearchQuery("");
  }, []);

  const submitSearch = React.useCallback(() => {
    setSearchMode(false);
    setSubmittedSearchQuery(searchQuery);
    options.onSearchSubmit?.(searchQuery);
  }, [searchQuery, options.onSearchSubmit]);

  const clearSearch = React.useCallback(() => {
    setSubmittedSearchQuery("");
    setSearchQuery("");
    options.onSearchClear?.();
  }, [options.onSearchClear]);

  const handleEscape = React.useCallback((): boolean => {
    if (searchMode) {
      cancelSearch();
      return true;
    }
    if (submittedSearchQuery) {
      clearSearch();
      return true;
    }
    return false;
  }, [searchMode, submittedSearchQuery, cancelSearch, clearSearch]);

  const getSearchOverhead = React.useCallback((): number => {
    // Search bar takes 2 lines when visible (1 line content + 1 marginBottom)
    return searchMode || submittedSearchQuery ? 2 : 0;
  }, [searchMode, submittedSearchQuery]);

  return {
    searchMode,
    searchQuery,
    submittedSearchQuery,
    enterSearchMode,
    cancelSearch,
    setSearchQuery,
    submitSearch,
    clearSearch,
    handleEscape,
    getSearchOverhead,
  };
}
