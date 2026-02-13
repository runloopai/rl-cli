/**
 * ResourcePicker - Reusable component for selecting resources
 * Supports single-select and multi-select modes with search and pagination
 * Uses Table component for consistent styling with resource list views
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { Breadcrumb, BreadcrumbItem } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SearchBar } from "./SearchBar.js";
import {
  Table,
  type Column,
  createTextColumn,
  createComponentColumn,
} from "./Table.js";

// Re-export Column helpers for convenience
export type { Column };
export { createTextColumn, createComponentColumn };
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../hooks/useCursorPagination.js";
import { useListSearch } from "../hooks/useListSearch.js";

/**
 * Configuration for the ResourcePicker
 */
export interface ResourcePickerConfig<T> {
  /** Title for the picker (e.g., "Select Benchmarks") */
  title: string;

  /** Function to fetch a page of resources */
  fetchPage: (params: {
    limit: number;
    startingAt?: string;
    search?: string;
  }) => Promise<{
    items: T[];
    hasMore: boolean;
    totalCount?: number;
  }>;

  /** Extract unique ID from an item */
  getItemId: (item: T) => string;

  /** Get display label for an item (used for simple mode or as fallback) */
  getItemLabel: (item: T) => string;

  /** Get optional status for an item (used for simple mode) */
  getItemStatus?: (item: T) => string | undefined;

  /** Column definitions for table display (if not provided, uses simple label/status) */
  columns?: Column<T>[];

  /** Selection mode */
  mode: "single" | "multi";

  /** Minimum number of selections required (for multi mode, default 1) */
  minSelection?: number;

  /** Maximum number of selections allowed (for multi mode, default unlimited) */
  maxSelection?: number;

  /** Empty state message */
  emptyMessage?: string;

  /** Search placeholder */
  searchPlaceholder?: string;

  /** Breadcrumb items */
  breadcrumbItems?: BreadcrumbItem[];

  /** Callback to create a new resource (shows [c] Create new tip) */
  onCreateNew?: () => void;

  /** Label for the create new action (default: "Create new") */
  createNewLabel?: string;
}

export interface ResourcePickerProps<T> {
  /** Configuration for the picker */
  config: ResourcePickerConfig<T>;

  /** Callback when selection is confirmed */
  onSelect: (items: T[]) => void;

  /** Callback when picker is cancelled */
  onCancel: () => void;

  /** Initially selected item IDs */
  initialSelected?: string[];
}

/**
 * ResourcePicker component for selecting resources from a list
 */
export function ResourcePicker<T>({
  config,
  onSelect,
  onCancel,
  initialSelected = [],
}: ResourcePickerProps<T>) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    new Set(initialSelected),
  );

  // Search state
  const search = useListSearch({
    onSearchSubmit: () => setSelectedIndex(0),
    onSearchClear: () => setSelectedIndex(0),
  });

  // Calculate overhead for viewport height (matches list pages)
  const overhead = 13 + search.getSearchOverhead();
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // terminalWidth available from viewport hook for column calculations
  void terminalWidth;

  // Store fetchPage in a ref to avoid dependency issues
  const fetchPageRef = React.useRef(config.fetchPage);
  React.useEffect(() => {
    fetchPageRef.current = config.fetchPage;
  }, [config.fetchPage]);

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      return fetchPageRef.current({
        limit: params.limit,
        startingAt: params.startingAt,
        search: search.submittedSearchQuery || undefined,
      });
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items,
    loading,
    navigating,
    error,
    currentPage,
    hasMore,
    hasPrev,
    totalCount,
    nextPage,
    prevPage,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: config.getItemId,
    pollInterval: 0, // No polling for picker
    pollingEnabled: false,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (items.length > 0 && selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  const selectedItem = items[selectedIndex];
  const minSelection = config.minSelection ?? 1;
  const canConfirm =
    config.mode === "single"
      ? selectedItem !== undefined
      : selectedIds.size >= minSelection;

  // Toggle selection for multi-select
  const toggleSelection = React.useCallback(
    (item: T) => {
      const id = config.getItemId(item);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (config.maxSelection && next.size >= config.maxSelection) {
            return prev; // Don't add if at max
          }
          next.add(id);
        }
        return next;
      });
    },
    [config.getItemId, config.maxSelection],
  );

  // Handle confirmation
  const handleConfirm = React.useCallback(() => {
    if (config.mode === "single") {
      if (selectedItem) {
        onSelect([selectedItem]);
      }
    } else {
      const selectedItems = items.filter((item) =>
        selectedIds.has(config.getItemId(item)),
      );
      // Also include items from previous pages that were selected
      // For now, we only return items from current view
      // A more complete implementation would track full item objects
      if (selectedItems.length >= minSelection) {
        onSelect(selectedItems);
      }
    }
  }, [config, selectedItem, selectedIds, items, minSelection, onSelect]);

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useInput((input, key) => {
    // Handle search mode input
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    const pageItems = items.length;

    // Navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageItems - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      (input === "n" || key.rightArrow) &&
      !loading &&
      !navigating &&
      hasMore
    ) {
      nextPage();
      setSelectedIndex(0);
    } else if (
      (input === "p" || key.leftArrow) &&
      !loading &&
      !navigating &&
      hasPrev
    ) {
      prevPage();
      setSelectedIndex(0);
    } else if (input === " " && config.mode === "multi" && selectedItem) {
      // Space toggles selection in multi mode
      toggleSelection(selectedItem);
    } else if (key.return) {
      if (config.mode === "single" && selectedItem) {
        // Enter selects in single mode
        onSelect([selectedItem]);
      } else if (config.mode === "multi" && canConfirm) {
        // Enter confirms in multi mode
        handleConfirm();
      }
    } else if (input === "c" && config.onCreateNew) {
      config.onCreateNew();
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
      onCancel();
    } else if (input === "q") {
      onCancel();
    }
  });

  // Loading state
  if (loading && items.length === 0) {
    return (
      <>
        {config.breadcrumbItems && (
          <Breadcrumb items={config.breadcrumbItems} />
        )}
        <SpinnerComponent
          message={`Loading ${config.title.toLowerCase()}...`}
        />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        {config.breadcrumbItems && (
          <Breadcrumb items={config.breadcrumbItems} />
        )}
        <ErrorMessage message={`Failed to load resources`} error={error} />
        <NavigationTips tips={[{ key: "Esc", label: "Cancel" }]} />
      </>
    );
  }

  // Calculate pagination info for display
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);

  return (
    <>
      {config.breadcrumbItems && <Breadcrumb items={config.breadcrumbItems} />}

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder={config.searchPlaceholder || "Search..."}
      />

      {/* Table view */}
      {config.columns ? (
        <Table
          data={items}
          keyExtractor={config.getItemId}
          selectedIndex={selectedIndex}
          title={`${config.title.toLowerCase()}[${totalCount}]${config.mode === "multi" ? ` (${selectedIds.size} selected)` : ""}`}
          columns={
            config.mode === "multi"
              ? [
                  // Prepend checkbox column for multi-select mode
                  createComponentColumn<T>(
                    "_selection",
                    "",
                    (row) => {
                      const isChecked = selectedIds.has(config.getItemId(row));
                      return (
                        <Text
                          color={isChecked ? colors.success : colors.textDim}
                        >
                          {isChecked
                            ? figures.checkboxOn
                            : figures.checkboxOff}{" "}
                        </Text>
                      );
                    },
                    { width: 3 },
                  ),
                  ...config.columns,
                ]
              : config.columns
          }
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} {config.emptyMessage || "No items found"}
              {config.onCreateNew ? " Press [c] to create one." : ""}
            </Text>
          }
        />
      ) : (
        // Fallback simple list view if no columns provided
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.border}
          paddingX={1}
          paddingY={0}
        >
          {items.length === 0 ? (
            <Box paddingY={1}>
              <Text color={colors.textDim}>
                {figures.info} {config.emptyMessage || "No items found"}
                {config.onCreateNew ? " Press [c] to create one." : ""}
              </Text>
            </Box>
          ) : (
            items.map((item, index) => {
              const isHighlighted = index === selectedIndex;
              const id = config.getItemId(item);
              const label = config.getItemLabel(item);
              const status = config.getItemStatus?.(item);
              const isChecked = selectedIds.has(id);

              return (
                <Box key={id}>
                  <Text color={isHighlighted ? colors.primary : colors.textDim}>
                    {isHighlighted ? figures.pointer : " "}
                  </Text>
                  <Text> </Text>
                  {/* Show checkbox for multi-select mode */}
                  {config.mode === "multi" && (
                    <Text color={isChecked ? colors.success : colors.textDim}>
                      {isChecked
                        ? figures.checkboxOn
                        : figures.checkboxOff}{" "}
                    </Text>
                  )}
                  <Text
                    color={colors.text}
                    bold={isHighlighted}
                    inverse={isHighlighted}
                  >
                    {label}
                  </Text>
                  {status && (
                    <>
                      <Text> </Text>
                      <Text color={colors.textDim} dimColor>
                        {status}
                      </Text>
                    </>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      )}

      {/* Statistics Bar */}
      <Box marginTop={1} paddingX={1}>
        <Text color={colors.primary} bold>
          {figures.hamburger} {totalCount}
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          total
        </Text>
        {totalPages > 1 && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}
              •{" "}
            </Text>
            {navigating ? (
              <Text color={colors.warning}>
                {figures.pointer} Loading page {currentPage + 1}...
              </Text>
            ) : (
              <Text color={colors.textDim} dimColor>
                Page {currentPage + 1} of {totalPages}
              </Text>
            )}
          </>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          •{" "}
        </Text>
        <Text color={colors.textDim} dimColor>
          Showing {startIndex + 1}-{endIndex} of {totalCount}
        </Text>
      </Box>

      {/* Help Bar */}
      <NavigationTips
        showArrows
        tips={[
          {
            icon: `${figures.arrowLeft}${figures.arrowRight}`,
            label: "Page",
            condition: hasMore || hasPrev,
          },
          ...(config.mode === "multi"
            ? [{ key: "Space", label: "Toggle" }]
            : []),
          {
            key: "Enter",
            label: config.mode === "single" ? "Select" : "Confirm",
            condition: canConfirm,
          },
          ...(config.onCreateNew
            ? [{ key: "c", label: config.createNewLabel || "Create new" }]
            : []),
          { key: "/", label: "Search" },
          { key: "Esc", label: "Cancel" },
        ]}
      />
    </>
  );
}
