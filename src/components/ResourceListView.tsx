import React from "react";
import { Box, Text, useInput, useStdout, useApp } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { Breadcrumb, BreadcrumbItem } from "./Breadcrumb.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { Table, Column } from "./Table.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

// Format time ago in a succinct way
export const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

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
};

export interface ResourceListConfig<T> {
  /** Resource name (e.g., 'Devboxes', 'Blueprints', 'Snapshots') */
  resourceName: string;

  /** Plural resource name for display */
  resourceNamePlural: string;

  /** Function to fetch resources */
  fetchResources: () => Promise<T[]>;

  /** Column definitions for the table */
  columns: Column<T>[];

  /** Key extractor for list items */
  keyExtractor: (item: T) => string;

  /** Get the status of a resource (for stats) */
  getStatus?: (item: T) => string;

  /** Status display configuration */
  statusConfig?: {
    success: string[]; // e.g., ['running', 'build_complete', 'ready']
    warning: string[]; // e.g., ['provisioning', 'building']
    error: string[]; // e.g., ['failure', 'build_failed']
  };

  /** Search configuration */
  searchConfig?: {
    enabled: boolean;
    fields: (item: T) => string[]; // Fields to search in
    placeholder?: string;
  };

  /** Empty state configuration */
  emptyState?: {
    message: string;
    command?: string;
  };

  /** Pagination config */
  pageSize?: number;
  maxFetch?: number;

  /** Callbacks */
  onSelect?: (item: T) => void;
  onBack?: () => void;
  onExit?: () => void;

  /** Additional keyboard shortcuts */
  additionalShortcuts?: {
    key: string;
    label: string;
    handler: (item: T) => void;
  }[];

  /** Breadcrumb configuration */
  breadcrumbItems?: BreadcrumbItem[];

  /** Auto-refresh configuration */
  autoRefresh?: {
    enabled: boolean;
    interval?: number; // milliseconds
  };
}

interface ResourceListViewProps<T> {
  config: ResourceListConfig<T>;
}

export function ResourceListView<T>({ config }: ResourceListViewProps<T>) {
  const { exit: inkExit } = useApp();
  const isMounted = React.useRef(true);

  // Track mounted state
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [loading, setLoading] = React.useState(true);
  const [resources, setResources] = React.useState<T[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const maxFetch = config.maxFetch || 100;

  // Calculate overhead for viewport height:
  // - Breadcrumb (3 lines + marginBottom): 4 lines
  // - Search bar (if visible, 1 line + marginBottom): 2 lines
  // - Table (title + top border + header + bottom border): 4 lines
  // - Stats bar (marginTop + content): 2 lines
  // - Help bar (marginTop + content): 2 lines
  // - Safety buffer for edge cases: 1 line
  // Total: 13 lines base + 2 if searching
  const overhead = 13 + (searchMode || searchQuery ? 2 : 0);
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  // Use viewport height for dynamic page size, or fall back to config
  const pageSize = config.pageSize || viewportHeight;

  // Fetch resources
  const fetchData = React.useCallback(
    async (isInitialLoad: boolean = false) => {
      if (!isMounted.current) return;

      try {
        const data = await config.fetchResources();
        if (isMounted.current) {
          setResources(data);
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err as Error);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [config.fetchResources],
  );

  // Initial load
  React.useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh
  React.useEffect(() => {
    if (config.autoRefresh?.enabled) {
      const interval = setInterval(() => {
        fetchData(false);
      }, config.autoRefresh.interval || 3000);
      return () => clearInterval(interval);
    }
  }, [config.autoRefresh, fetchData]);

  // Removed refresh icon animation to prevent constant re-renders and flashing

  // Filter resources based on search query
  const filteredResources = React.useMemo(() => {
    if (!config.searchConfig?.enabled || !searchQuery.trim()) {
      return resources;
    }

    const query = searchQuery.toLowerCase();
    return resources.filter((resource) => {
      const fields = config.searchConfig!.fields(resource);
      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [resources, searchQuery, config.searchConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredResources.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredResources.length);
  const currentResources = filteredResources.slice(startIndex, endIndex);

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (
      currentResources.length > 0 &&
      selectedIndex >= currentResources.length
    ) {
      setSelectedIndex(Math.max(0, currentResources.length - 1));
    }
  }, [currentResources.length, selectedIndex]);

  const selectedResource = currentResources[selectedIndex];

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Input handling
  useInput((input, key) => {
    // Don't process input if unmounting
    if (!isMounted.current) return;

    const pageResourcesCount = currentResources.length;

    // Skip input handling when in search mode
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery("");
      }
      return;
    }

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageResourcesCount - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      (input === "n" || key.rightArrow) &&
      currentPage < totalPages - 1
    ) {
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if ((input === "p" || key.leftArrow) && currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (key.return && selectedResource && config.onSelect) {
      config.onSelect(selectedResource);
    } else if (input === "/" && config.searchConfig?.enabled) {
      setSearchMode(true);
    } else if (key.escape) {
      if (searchQuery) {
        setSearchQuery("");
        setCurrentPage(0);
        setSelectedIndex(0);
      } else {
        if (config.onBack) {
          config.onBack();
        } else if (config.onExit) {
          config.onExit();
        } else {
          inkExit();
        }
      }
    } else if (config.additionalShortcuts) {
      // Handle additional shortcuts
      const shortcut = config.additionalShortcuts.find((s) => s.key === input);
      if (shortcut && selectedResource) {
        shortcut.handler(selectedResource);
      }
    }
  });

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!config.statusConfig || !config.getStatus) {
      return null;
    }

    const successCount = resources.filter((r) =>
      config.statusConfig!.success.includes(config.getStatus!(r)),
    ).length;

    const warningCount = resources.filter((r) =>
      config.statusConfig!.warning.includes(config.getStatus!(r)),
    ).length;

    const errorCount = resources.filter((r) =>
      config.statusConfig!.error.includes(config.getStatus!(r)),
    ).length;

    return { successCount, warningCount, errorCount };
  }, [resources, config.statusConfig, config.getStatus]);

  // Loading state
  if (loading) {
    return (
      <>
        <Breadcrumb
          items={
            config.breadcrumbItems || [
              { label: config.resourceNamePlural, active: true },
            ]
          }
        />
        <SpinnerComponent
          message={`Loading ${config.resourceNamePlural.toLowerCase()}...`}
        />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb
          items={
            config.breadcrumbItems || [
              { label: config.resourceNamePlural, active: true },
            ]
          }
        />
        <ErrorMessage
          message={`Failed to list ${config.resourceNamePlural.toLowerCase()}`}
          error={error}
        />
      </>
    );
  }

  // Empty state
  if (!loading && !error && resources.length === 0) {
    return (
      <>
        <Breadcrumb
          items={
            config.breadcrumbItems || [
              { label: config.resourceNamePlural, active: true },
            ]
          }
        />
        {config.emptyState && (
          <Box>
            <Text color={colors.warning}>{figures.info}</Text>
            <Text> {config.emptyState.message}</Text>
            {config.emptyState.command && (
              <Text color={colors.primary} bold>
                {config.emptyState.command}
              </Text>
            )}
          </Box>
        )}
      </>
    );
  }

  // List view with data
  return (
    <>
      <Breadcrumb
        items={
          config.breadcrumbItems || [
            { label: config.resourceNamePlural, active: true },
          ]
        }
      />

      {/* Search bar */}
      {config.searchConfig?.enabled && (
        <>
          {searchMode && (
            <Box marginBottom={1}>
              <Text color={colors.primary}>
                {figures.pointerSmall} Search:{" "}
              </Text>
              <TextInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={
                  config.searchConfig.placeholder || "Type to search..."
                }
                onSubmit={() => {
                  setSearchMode(false);
                  setCurrentPage(0);
                  setSelectedIndex(0);
                }}
              />
              <Text color={colors.textDim} dimColor>
                {" "}
                [Esc to cancel]
              </Text>
            </Box>
          )}
          {!searchMode && searchQuery && (
            <Box marginBottom={1}>
              <Text color={colors.primary}>{figures.info} Searching for: </Text>
              <Text color={colors.warning} bold>
                {searchQuery}
              </Text>
              <Text color={colors.textDim} dimColor>
                {" "}
                ({currentResources.length} results) [/ to edit, Esc to clear]
              </Text>
            </Box>
          )}
        </>
      )}

      {/* Table */}
      <Table
        key={`table-${searchQuery}-${currentPage}`}
        data={currentResources}
        keyExtractor={config.keyExtractor}
        selectedIndex={selectedIndex}
        title={`${config.resourceNamePlural.toLowerCase()}[${searchQuery ? currentResources.length : resources.length}]`}
        columns={config.columns}
      />

      {/* Statistics Bar */}
      <Box marginTop={1} paddingX={1}>
        <Text color={colors.primary} bold>
          {figures.hamburger} {resources.length}
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
            <Text color={colors.textDim} dimColor>
              Page {currentPage + 1} of {totalPages}
            </Text>
          </>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          •{" "}
        </Text>
        <Text color={colors.textDim} dimColor>
          Showing {startIndex + 1}-{endIndex} of {filteredResources.length}
        </Text>
        <Text> </Text>
        <Text color={colors.success}>{figures.circleFilled}</Text>
      </Box>

      {/* Help Bar */}
      <Box marginTop={1} paddingX={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate
        </Text>
        {totalPages > 1 && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • {figures.arrowLeft}
            {figures.arrowRight} Page
          </Text>
        )}
        {config.onSelect && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • [Enter] Details
          </Text>
        )}
        {config.searchConfig?.enabled && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • [/] Search
          </Text>
        )}
        {config.additionalShortcuts &&
          config.additionalShortcuts.map((shortcut) => (
            <Text key={shortcut.key} color={colors.textDim} dimColor>
              {" "}
              • [{shortcut.key}] {shortcut.label}
            </Text>
          ))}
        <Text color={colors.textDim} dimColor>
          {" "}
          • [Esc] Back
        </Text>
      </Box>
    </>
  );
}
