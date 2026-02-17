/**
 * BenchmarkRunListScreen - List view for benchmark runs
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
import { listBenchmarkRuns } from "../services/benchmarkService.js";
import type { BenchmarkRun } from "../store/benchmarkStore.js";

export function BenchmarkRunListScreen() {
  const { exit: _inkExit } = useApp();
  const { navigate, goBack } = useNavigation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);

  // Search state
  const search = useListSearch({
    onSearchSubmit: () => setSelectedIndex(0),
    onSearchClear: () => setSelectedIndex(0),
  });

  // Calculate overhead for viewport height
  const overhead = 13 + search.getSearchOverhead();
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
      const result = await listBenchmarkRuns({
        limit: params.limit,
        startingAfter: params.startingAt,
      });

      return {
        items: result.benchmarkRuns,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [],
  );

  // Use the shared pagination hook
  const {
    items: benchmarkRuns,
    loading,
    navigating,
    error,
    currentPage,
    hasMore,
    hasPrev,
    totalCount,
    nextPage,
    prevPage,
    refresh: _refresh,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (run: BenchmarkRun) => run.id,
    pollInterval: 5000,
    pollingEnabled: !showPopup && !search.searchMode,
    deps: [PAGE_SIZE],
  });

  // Operations for benchmark runs
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
      {
        key: "view_scenarios",
        label: "View Scenario Runs",
        color: colors.info,
        icon: figures.arrowRight,
      },
      {
        key: "create_job",
        label: "Create Job",
        color: colors.success,
        icon: figures.play,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (run: BenchmarkRun) => run.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn("name", "Name", (run: BenchmarkRun) => run.name || "", {
        width: nameWidth,
      }),
      createComponentColumn<BenchmarkRun>(
        "status",
        "Status",
        (run, _index, isSelected) => {
          const statusDisplay = getStatusDisplay(run.state);
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
        (run: BenchmarkRun) =>
          run.start_time_ms ? formatTimeAgo(run.start_time_ms) : "",
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
    if (benchmarkRuns.length > 0 && selectedIndex >= benchmarkRuns.length) {
      setSelectedIndex(Math.max(0, benchmarkRuns.length - 1));
    }
  }, [benchmarkRuns.length, selectedIndex]);

  const selectedRun = benchmarkRuns[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + benchmarkRuns.length;

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
          navigate("benchmark-run-detail", {
            benchmarkRunId: selectedRun.id,
          });
        } else if (operationKey === "view_scenarios") {
          navigate("scenario-run-list", {
            benchmarkRunId: selectedRun.id,
          });
        } else if (operationKey === "create_job") {
          navigate("benchmark-job-create");
        }
      } else if (input === "v" && selectedRun) {
        setShowPopup(false);
        navigate("benchmark-run-detail", {
          benchmarkRunId: selectedRun.id,
        });
      } else if (input === "s" && selectedRun) {
        setShowPopup(false);
        navigate("scenario-run-list", {
          benchmarkRunId: selectedRun.id,
        });
      } else if (input === "j") {
        setShowPopup(false);
        navigate("benchmark-job-create");
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      }
      return;
    }

    const pageRuns = benchmarkRuns.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageRuns - 1) {
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
    } else if (key.return && selectedRun) {
      navigate("benchmark-run-detail", {
        benchmarkRunId: selectedRun.id,
      });
    } else if (input === "a" && selectedRun) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "j") {
      // Quick shortcut to create a new job
      navigate("benchmark-job-create");
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
      goBack();
    }
  });

  // Loading state
  if (loading && benchmarkRuns.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Runs", active: true },
          ]}
        />
        <SpinnerComponent message="Loading benchmark runs..." />
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
            { label: "Benchmark Runs", active: true },
          ]}
        />
        <ErrorMessage message="Failed to list benchmark runs" error={error} />
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
          { label: "Benchmark Runs", active: true },
        ]}
      />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search benchmark runs..."
      />

      {/* Table */}
      {!showPopup && (
        <Table
          data={benchmarkRuns}
          keyExtractor={(run: BenchmarkRun) => run.id}
          selectedIndex={selectedIndex}
          title={`benchmark_runs[${totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No benchmark runs found
            </Text>
          }
        />
      )}

      {/* Statistics Bar */}
      {!showPopup && (
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
      )}

      {/* Actions Popup */}
      {showPopup && selectedRun && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedRun}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "view_details"
                  ? "v"
                  : op.key === "view_scenarios"
                    ? "s"
                    : op.key === "create_job"
                      ? "j"
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
          { key: "Enter", label: "Details" },
          { key: "j", label: "New Job" },
          { key: "a", label: "Actions" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}
