/**
 * BenchmarkListScreen - List view for benchmark definitions
 */
import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import {
  Table,
  createTextColumn,
  createComponentColumn,
} from "../components/Table.js";
import { ActionsPopup } from "../components/ActionsPopup.js";
import { Operation } from "../components/OperationsMenu.js";
import { formatTimeAgo } from "../components/ResourceListView.js";
import { SearchBar } from "../components/SearchBar.js";
import { getStatusDisplay } from "../components/StatusBadge.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../hooks/useCursorPagination.js";
import { useListSearch } from "../hooks/useListSearch.js";
import {
  listBenchmarks,
  listPublicBenchmarks,
} from "../services/benchmarkService.js";
import type { Benchmark } from "../store/benchmarkStore.js";

export function BenchmarkListScreen() {
  const { exit: inkExit } = useApp();
  const { navigate, goBack, params, updateCurrentParams } = useNavigation();
  const [selectedIndex, setSelectedIndex] = React.useState(
    params.selectedIndex ? Number(params.selectedIndex) : 0,
  );
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [tab, setTab] = React.useState<"private" | "public">(
    params.tab === "public" ? "public" : "private",
  );
  const isPublic = tab === "public";

  // Save current tab and cursor into route params so back-navigation restores them
  const saveListState = React.useCallback(() => {
    updateCurrentParams({
      tab,
      selectedIndex: String(selectedIndex),
    });
  }, [updateCurrentParams, tab, selectedIndex]);

  // Search state
  const search = useListSearch({
    onSearchSubmit: () => setSelectedIndex(0),
    onSearchClear: () => setSelectedIndex(0),
  });

  // Calculate overhead for viewport height
  const overhead = 14 + search.getSearchOverhead();
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // Column widths
  const fixedWidth = 6;
  const idWidth = 25;
  const statusWidth = 12;
  const timeWidth = 18;
  const baseWidth = fixedWidth + idWidth + statusWidth + timeWidth;
  const remainingWidth = terminalWidth - baseWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const listFn = isPublic ? listPublicBenchmarks : listBenchmarks;
      const result = await listFn({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: search.submittedSearchQuery || undefined,
      });

      // Public tab: only show benchmarks with bmj_support metadata
      const items = isPublic
        ? result.benchmarks.filter((b) => b.metadata?.bmj_support === "true")
        : result.benchmarks;

      return {
        items,
        hasMore: result.hasMore,
        totalCount: isPublic
          ? items.length + (result.hasMore ? 1 : 0)
          : result.totalCount,
      };
    },
    [search.submittedSearchQuery, isPublic],
  );

  // Use the shared pagination hook
  const {
    items: benchmarks,
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
    getItemId: (benchmark: Benchmark) => benchmark.id,
    pollInterval: 5000,
    pollingEnabled: !showPopup && !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery, isPublic],
  });

  // Operations for benchmarks
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
      {
        key: "create_job",
        label: "Run Benchmark Job",
        color: colors.success,
        icon: figures.play,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (benchmark: Benchmark) => benchmark.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn(
        "name",
        "Name",
        (benchmark: Benchmark) => benchmark.name || "",
        {
          width: nameWidth,
        },
      ),
      createComponentColumn<Benchmark>(
        "status",
        "Status",
        (benchmark, _index, isSelected) => {
          const status = (benchmark as any).status || "active";
          const statusDisplay = getStatusDisplay(status);
          const text = statusDisplay.text
            .slice(0, statusWidth)
            .padEnd(statusWidth, " ");
          return (
            <Text
              color={isSelected ? colors.text : statusDisplay.color}
              bold={isSelected}
              inverse={isSelected}
            >
              {text}
            </Text>
          );
        },
        { width: statusWidth },
      ),
      createTextColumn(
        "created",
        "Created",
        (benchmark: Benchmark) =>
          (benchmark as any).created_at
            ? formatTimeAgo((benchmark as any).created_at)
            : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, statusWidth, timeWidth],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (benchmarks.length > 0 && selectedIndex >= benchmarks.length) {
      setSelectedIndex(Math.max(0, benchmarks.length - 1));
    }
  }, [benchmarks.length, selectedIndex]);

  const selectedBenchmark = benchmarks[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + benchmarks.length;

  useInput((input, key) => {
    // Handle search mode input
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    // Handle popup navigation
    if (showPopup) {
      if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        setShowPopup(false);
        const operationKey = operations[selectedOperation].key;

        if (operationKey === "view_details") {
          saveListState();
          navigate("benchmark-detail", {
            benchmarkId: selectedBenchmark.id,
          });
        } else if (operationKey === "create_job") {
          saveListState();
          navigate("benchmark-job-create", {
            initialBenchmarkIds: selectedBenchmark.id,
          });
        }
      } else if (input === "v" && selectedBenchmark) {
        setShowPopup(false);
        saveListState();
        navigate("benchmark-detail", {
          benchmarkId: selectedBenchmark.id,
        });
      } else if (input === "r" && selectedBenchmark) {
        setShowPopup(false);
        saveListState();
        navigate("benchmark-job-create", {
          initialBenchmarkIds: selectedBenchmark.id,
        });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      }
      return;
    }

    const pageBenchmarks = benchmarks.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageBenchmarks - 1) {
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
    } else if (key.return && selectedBenchmark) {
      saveListState();
      navigate("benchmark-detail", {
        benchmarkId: selectedBenchmark.id,
      });
    } else if (input === "a" && selectedBenchmark) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "r" && selectedBenchmark) {
      saveListState();
      navigate("benchmark-job-create", {
        initialBenchmarkIds: selectedBenchmark.id,
      });
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (input === "1" && tab !== "private") {
      setTab("private");
      setSelectedIndex(0);
    } else if (input === "2" && tab !== "public") {
      setTab("public");
      setSelectedIndex(0);
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
      goBack();
    }
  });

  // Loading state
  if (loading && benchmarks.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            {
              label: isPublic ? "Public Benchmarks" : "Benchmark Defs",
              active: true,
            },
          ]}
        />
        <SpinnerComponent message="Loading benchmarks..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            {
              label: isPublic ? "Public Benchmarks" : "Benchmark Defs",
              active: true,
            },
          ]}
        />
        <ErrorMessage message="Failed to list benchmarks" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Home" },
          { label: "Benchmarks" },
          {
            label: isPublic ? "Public Benchmarks" : "Benchmark Defs",
            active: true,
          },
        ]}
      />

      {/* Tab indicator */}
      <Box paddingX={2} marginBottom={0}>
        <Text
          color={!isPublic ? colors.primary : colors.textDim}
          bold={!isPublic}
        >
          [1] Private
        </Text>
        <Text> </Text>
        <Text
          color={isPublic ? colors.primary : colors.textDim}
          bold={isPublic}
        >
          [2] Public
        </Text>
      </Box>

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder={
          isPublic ? "Search public benchmarks..." : "Search benchmarks..."
        }
      />

      {/* Table */}
      {!showPopup && (
        <Table
          data={benchmarks}
          keyExtractor={(benchmark: Benchmark) => benchmark.id}
          selectedIndex={selectedIndex}
          title={`${isPublic ? "public " : ""}benchmarks[${totalCount}${hasMore ? "+" : ""}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No benchmarks found
            </Text>
          }
        />
      )}

      {/* Statistics Bar */}
      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.primary} bold>
            {figures.hamburger} {totalCount}
            {hasMore ? "+" : ""}
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            total
          </Text>
          {(hasMore || hasPrev) && (
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
                  Page {currentPage + 1}
                  {!hasMore ? ` of ${totalPages}` : ""}
                </Text>
              )}
            </>
          )}
          <Text color={colors.textDim} dimColor>
            {" "}
            •{" "}
          </Text>
          <Text color={colors.textDim} dimColor>
            Showing {startIndex + 1}-{endIndex}
            {!hasMore ? ` of ${totalCount}` : ""}
          </Text>
        </Box>
      )}

      {/* Actions Popup */}
      {showPopup && selectedBenchmark && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedBenchmark}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "view_details"
                  ? "v"
                  : op.key === "create_job"
                    ? "r"
                    : "",
            }))}
            selectedOperation={selectedOperation}
            onClose={() => setShowPopup(false)}
          />
        </Box>
      )}

      {/* Help Bar */}
      <NavigationTips
        showArrows
        tips={[
          {
            icon: `${figures.arrowLeft}${figures.arrowRight}`,
            label: "Page",
            condition: hasMore || hasPrev,
          },
          { key: "1/2", label: "Private/Public" },
          { key: "Enter", label: "Details" },
          { key: "r", label: "Run Benchmark Job" },
          { key: "a", label: "Actions" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}
