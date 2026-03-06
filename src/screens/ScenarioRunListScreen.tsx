/**
 * ScenarioRunListScreen - List view for scenario runs
 */
import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb, type BreadcrumbItem } from "../components/Breadcrumb.js";
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
  listScenarioRuns,
  fetchAllScenarioRuns,
} from "../services/benchmarkService.js";
import type { ScenarioRun } from "../store/benchmarkStore.js";

interface ScenarioRunListScreenProps {
  benchmarkRunId?: string;
}

export function ScenarioRunListScreen({
  benchmarkRunId,
}: ScenarioRunListScreenProps) {
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
  const timeWidth = 18;
  const baseWidth = fixedWidth + idWidth + statusWidth + scoreWidth + timeWidth;
  const remainingWidth = terminalWidth - baseWidth;
  const nameWidth = Math.min(60, Math.max(15, remainingWidth));

  // --- Client-side pagination (when benchmarkRunId is provided) ---
  // Fetches all scenario runs upfront for accurate total count and cached page navigation.
  const [allScenarioRuns, setAllScenarioRuns] = React.useState<ScenarioRun[]>(
    [],
  );
  const [allRunsLoaded, setAllRunsLoaded] = React.useState(false);
  const [allRunsError, setAllRunsError] = React.useState<Error | null>(null);
  const [clientPage, setClientPage] = React.useState(0);

  React.useEffect(() => {
    if (!benchmarkRunId) return;
    let cancelled = false;

    fetchAllScenarioRuns(benchmarkRunId)
      .then((runs) => {
        if (!cancelled) {
          setAllScenarioRuns(runs);
          setAllRunsLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAllRunsError(err as Error);
          setAllRunsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [benchmarkRunId]);

  // Poll to refresh the client-side cache
  React.useEffect(() => {
    if (!benchmarkRunId || showPopup || search.searchMode) return;

    const interval = setInterval(() => {
      fetchAllScenarioRuns(benchmarkRunId)
        .then((runs) => setAllScenarioRuns(runs))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [benchmarkRunId, showPopup, search.searchMode]);

  // Reset client page when page size changes
  React.useEffect(() => {
    if (benchmarkRunId) setClientPage(0);
  }, [PAGE_SIZE, benchmarkRunId]);

  // --- Cursor-based pagination (when no benchmarkRunId) ---
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      if (benchmarkRunId) {
        return { items: [] as ScenarioRun[], hasMore: false };
      }
      const result = await listScenarioRuns({
        limit: params.limit,
        startingAfter: params.startingAt,
      });
      return {
        items: result.scenarioRuns,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [benchmarkRunId],
  );

  const cursor = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (run: ScenarioRun) => run.id,
    pollInterval: benchmarkRunId ? 0 : 5000,
    pollingEnabled: !benchmarkRunId && !showPopup && !search.searchMode,
    deps: [PAGE_SIZE, benchmarkRunId],
  });

  // --- Unified pagination interface ---
  const useClientSide = !!benchmarkRunId;
  const clientPageItems = allScenarioRuns.slice(
    clientPage * PAGE_SIZE,
    (clientPage + 1) * PAGE_SIZE,
  );

  const scenarioRuns = useClientSide ? clientPageItems : cursor.items;
  const loading = useClientSide
    ? !allRunsLoaded && allScenarioRuns.length === 0
    : cursor.loading;
  const navigating = useClientSide ? false : cursor.navigating;
  const error = useClientSide ? allRunsError : cursor.error;
  const currentPage = useClientSide ? clientPage : cursor.currentPage;
  const hasMore = useClientSide
    ? (clientPage + 1) * PAGE_SIZE < allScenarioRuns.length
    : cursor.hasMore;
  const hasPrev = useClientSide ? clientPage > 0 : cursor.hasPrev;
  const totalCount = useClientSide ? allScenarioRuns.length : cursor.totalCount;

  const nextPage = () => {
    if (useClientSide) {
      setClientPage((p) => p + 1);
    } else {
      cursor.nextPage();
    }
  };

  const prevPage = () => {
    if (useClientSide) {
      setClientPage((p) => Math.max(0, p - 1));
    } else {
      cursor.prevPage();
    }
  };

  // Operations for scenario runs
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (run: ScenarioRun) => run.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn("name", "Name", (run: ScenarioRun) => run.name || "", {
        width: nameWidth,
      }),
      createComponentColumn<ScenarioRun>(
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
        "score",
        "Score",
        (run: ScenarioRun) => {
          const score = run.scoring_contract_result?.score;
          return score !== undefined ? String(score) : "";
        },
        {
          width: scoreWidth,
          color: colors.info,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (run: ScenarioRun) =>
          run.start_time_ms ? formatTimeAgo(run.start_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, statusWidth, scoreWidth, timeWidth],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (scenarioRuns.length > 0 && selectedIndex >= scenarioRuns.length) {
      setSelectedIndex(Math.max(0, scenarioRuns.length - 1));
    }
  }, [scenarioRuns.length, selectedIndex]);

  const selectedRun = scenarioRuns[selectedIndex];

  // Calculate pagination info for display
  const totalIsExact = useClientSide || !hasMore;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + scenarioRuns.length;

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
          navigate("scenario-run-detail", {
            scenarioRunId: selectedRun.id,
            benchmarkRunId,
          });
        }
      } else if (input === "v" && selectedRun) {
        setShowPopup(false);
        navigate("scenario-run-detail", {
          scenarioRunId: selectedRun.id,
          benchmarkRunId,
        });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      }
      return;
    }

    const pageRuns = scenarioRuns.length;

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
      navigate("scenario-run-detail", {
        scenarioRunId: selectedRun.id,
        benchmarkRunId,
      });
    } else if (input === "a" && selectedRun) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
      goBack();
    }
  });

  // Build breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home" },
    { label: "Benchmarks" },
  ];
  if (benchmarkRunId) {
    breadcrumbItems.push({
      label: `Run: ${benchmarkRunId.substring(0, 8)}...`,
    });
  }
  breadcrumbItems.push({ label: "Scenario Runs", active: true });

  // Loading state
  if (loading && scenarioRuns.length === 0) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Loading scenario runs..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <ErrorMessage message="Failed to list scenario runs" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={breadcrumbItems} />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search scenario runs..."
      />

      {/* Table */}
      {!showPopup && (
        <Table
          data={scenarioRuns}
          keyExtractor={(run: ScenarioRun) => run.id}
          selectedIndex={selectedIndex}
          title={`scenario_runs[${totalCount}${!totalIsExact ? "+" : ""}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No scenario runs found
            </Text>
          }
        />
      )}

      {/* Statistics Bar */}
      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.primary} bold>
            {figures.hamburger} {totalCount}
            {!totalIsExact ? "+" : ""}
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
                  {totalIsExact ? ` of ${totalPages}` : ""}
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
            {totalIsExact ? ` of ${totalCount}` : ""}
          </Text>
          {benchmarkRunId && (
            <>
              <Text color={colors.textDim} dimColor>
                {" "}
                •{" "}
              </Text>
              <Text color={colors.info}>
                Run: {benchmarkRunId.substring(0, 8)}...
              </Text>
            </>
          )}
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
              shortcut: op.key === "view_details" ? "v" : "",
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
          { key: "a", label: "Actions" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}
