/**
 * BenchmarkJobListScreen - List view for benchmark jobs
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
  listBenchmarkJobs,
  type BenchmarkJob,
} from "../services/benchmarkJobService.js";

export function BenchmarkJobListScreen() {
  const { exit: inkExit } = useApp();
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
  const scoreWidth = 8;
  const statsWidth = 14;
  const timeWidth = 14;
  const baseWidth =
    fixedWidth + idWidth + statusWidth + scoreWidth + statsWidth + timeWidth;
  const remainingWidth = terminalWidth - baseWidth;
  const nameWidth = Math.min(60, Math.max(15, remainingWidth));

  // Helper to get score from job outcomes
  const getJobScore = (job: BenchmarkJob): string => {
    if (!job.benchmark_outcomes || job.benchmark_outcomes.length === 0) {
      return "-";
    }
    // Calculate average score across all outcomes
    const scores = job.benchmark_outcomes
      .map((o) => o.average_score)
      .filter((s): s is number => s !== null && s !== undefined);
    if (scores.length === 0) return "-";
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg.toFixed(2);
  };

  // Helper to get stats from job
  const getJobStats = (job: BenchmarkJob): string => {
    if (!job.benchmark_outcomes || job.benchmark_outcomes.length === 0) {
      if (job.in_progress_runs && job.in_progress_runs.length > 0) {
        return `${job.in_progress_runs.length} running`;
      }
      return "-";
    }
    const totalCompleted = job.benchmark_outcomes.reduce(
      (acc, o) => acc + o.n_completed,
      0,
    );
    const totalFailed = job.benchmark_outcomes.reduce(
      (acc, o) => acc + o.n_failed,
      0,
    );
    const totalTimeout = job.benchmark_outcomes.reduce(
      (acc, o) => acc + o.n_timeout,
      0,
    );

    const parts: string[] = [];
    if (totalCompleted > 0) parts.push(`${totalCompleted}✓`);
    if (totalFailed > 0) parts.push(`${totalFailed}✗`);
    if (totalTimeout > 0) parts.push(`${totalTimeout}⏱`);

    return parts.length > 0 ? parts.join(" ") : "-";
  };

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const result = await listBenchmarkJobs({
        limit: params.limit,
        startingAfter: params.startingAt,
        name: search.submittedSearchQuery || undefined,
      });

      return {
        items: result.jobs,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: benchmarkJobs,
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
    getItemId: (job: BenchmarkJob) => job.id,
    pollInterval: 5000,
    pollingEnabled: !showPopup && !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

  // Operations for benchmark jobs
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
      {
        key: "create_new",
        label: "Create New Job",
        color: colors.success,
        icon: figures.play,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (job: BenchmarkJob) => job.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn("name", "Name", (job: BenchmarkJob) => job.name || "", {
        width: nameWidth,
      }),
      createComponentColumn<BenchmarkJob>(
        "status",
        "Status",
        (job, _index, isSelected) => {
          const statusDisplay = getStatusDisplay(job.state);
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
      createComponentColumn<BenchmarkJob>(
        "score",
        "Score",
        (job, _index, isSelected) => {
          const score = getJobScore(job);
          const scoreColor = score === "-" ? colors.textDim : colors.success;
          return (
            <Text
              color={isSelected ? colors.text : scoreColor}
              bold={isSelected || score !== "-"}
              inverse={isSelected}
            >
              {score.padEnd(scoreWidth, " ")}
            </Text>
          );
        },
        { width: scoreWidth },
      ),
      createTextColumn(
        "stats",
        "Results",
        (job: BenchmarkJob) => getJobStats(job),
        {
          width: statsWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (job: BenchmarkJob) =>
          job.create_time_ms ? formatTimeAgo(job.create_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, statusWidth, scoreWidth, statsWidth, timeWidth],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (benchmarkJobs.length > 0 && selectedIndex >= benchmarkJobs.length) {
      setSelectedIndex(Math.max(0, benchmarkJobs.length - 1));
    }
  }, [benchmarkJobs.length, selectedIndex]);

  const selectedJob = benchmarkJobs[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + benchmarkJobs.length;

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

        if (operationKey === "view_details" && selectedJob) {
          navigate("benchmark-job-detail", {
            benchmarkJobId: selectedJob.id,
          });
        } else if (operationKey === "create_new") {
          navigate("benchmark-job-create");
        }
      } else if (input === "v" && selectedJob) {
        setShowPopup(false);
        navigate("benchmark-job-detail", {
          benchmarkJobId: selectedJob.id,
        });
      } else if (input === "n") {
        setShowPopup(false);
        navigate("benchmark-job-create");
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      }
      return;
    }

    const pageJobs = benchmarkJobs.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageJobs - 1) {
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
    } else if (key.return && selectedJob) {
      navigate("benchmark-job-detail", {
        benchmarkJobId: selectedJob.id,
      });
    } else if (input === "a" && selectedJob) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
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
  if (loading && benchmarkJobs.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Home" }, { label: "Benchmark Jobs", active: true }]}
        />
        <SpinnerComponent message="Loading benchmark jobs..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Home" }, { label: "Benchmark Jobs", active: true }]}
        />
        <ErrorMessage message="Failed to list benchmark jobs" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb
        items={[{ label: "Home" }, { label: "Benchmark Jobs", active: true }]}
      />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search benchmark jobs..."
      />

      {/* Table */}
      {!showPopup && (
        <Table
          data={benchmarkJobs}
          keyExtractor={(job: BenchmarkJob) => job.id}
          selectedIndex={selectedIndex}
          title={`benchmark_jobs[${totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No benchmark jobs found
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
      {showPopup && selectedJob && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedJob}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "view_details"
                  ? "v"
                  : op.key === "create_new"
                    ? "n"
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
          { key: "c", label: "New Job" },
          { key: "a", label: "Actions" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}
