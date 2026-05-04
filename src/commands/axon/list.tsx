/**
 * List active axons (beta)
 */

import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { listActiveAxons, type Axon } from "../../services/axonService.js";
import { output, outputError, parseLimit } from "../../utils/output.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { NavigationTips } from "../../components/NavigationTips.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SearchBar } from "../../components/SearchBar.js";
import type { Operation } from "../../components/OperationsMenu.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useListSearch } from "../../hooks/useListSearch.js";
import { useNavigation } from "../../store/navigationStore.js";
import { openInBrowser } from "../../utils/browser.js";
import { getAxonUrl } from "../../utils/url.js";

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface ListOptions {
  limit?: string;
  startingAfter?: string;
  output?: string;
}

const CLI_PAGE_SIZE = 100;

export async function listAxonsCommand(options: ListOptions): Promise<void> {
  try {
    const maxResults = parseLimit(options.limit);
    const format = options.output;

    let axons: Axon[];

    if (options.startingAfter) {
      const pageLimit = maxResults === Infinity ? CLI_PAGE_SIZE : maxResults;
      const { axons: page, hasMore } = await listActiveAxons({
        limit: pageLimit,
        startingAfter: options.startingAfter,
      });
      axons = page;
    } else {
      const all: Axon[] = [];
      let cursor: string | undefined;
      while (all.length < maxResults) {
        const remaining = maxResults - all.length;
        const pageLimit = Math.min(CLI_PAGE_SIZE, remaining);
        const { axons: page, hasMore } = await listActiveAxons({
          limit: pageLimit,
          startingAfter: cursor,
        });
        all.push(...page);
        if (!hasMore || page.length === 0) {
          break;
        }
        cursor = page[page.length - 1].id;
      }
      axons = all;
    }

    output(axons, { format, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list active axons", error);
  }
}

// ─── TUI Component ──────────────────────────────────────────────────────────

export const ListAxonsUI = ({
  onBack,
  onExit,
}: {
  onBack?: () => void;
  onExit?: () => void;
}) => {
  const { exit: inkExit } = useApp();
  const { navigate } = useNavigation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);

  // Search state
  const search = useListSearch({
    onSearchSubmit: () => setSelectedIndex(0),
    onSearchClear: () => setSelectedIndex(0),
  });

  const overhead = 13 + search.getSearchOverhead();
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // Column widths
  const fixedWidth = 6;
  const idWidth = 30;
  const timeWidth = 18;
  const baseWidth = fixedWidth + idWidth + timeWidth;
  const nameWidth = Math.min(40, Math.max(15, terminalWidth - baseWidth));

  const fetchPage = React.useCallback(
    async (params: {
      limit: number;
      startingAt?: string;
      includeTotalCount?: boolean;
    }) => {
      const result = await listActiveAxons({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: search.submittedSearchQuery || undefined,
        includeTotalCount: params.includeTotalCount,
      });
      return {
        items: result.axons,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [search.submittedSearchQuery],
  );

  const {
    items: axons,
    loading,
    navigating,
    error,
    currentPage,
    hasMore,
    hasPrev,
    totalCount,
    nextPage,
    prevPage,
    refresh,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (axon: Axon) => axon.id,
    pollInterval: 5000,
    pollingEnabled: !showPopup && !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

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

  const tableColumns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (a: Axon) => a.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn("name", "Name", (a: Axon) => a.name ?? "—", {
        width: nameWidth,
      }),
      createTextColumn(
        "created",
        "Created",
        (a: Axon) => (a.created_at_ms ? formatTimeAgo(a.created_at_ms) : ""),
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, timeWidth],
  );

  useExitOnCtrlC();

  React.useEffect(() => {
    if (axons.length > 0 && selectedIndex >= axons.length) {
      setSelectedIndex(Math.max(0, axons.length - 1));
    }
  }, [axons.length, selectedIndex]);

  const selectedAxonItem = axons[selectedIndex];

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex =
    totalCount > 0
      ? Math.min(startIndex + axons.length, totalCount)
      : startIndex + axons.length;
  const showingRange = navigating
    ? `${startIndex + 1}+`
    : endIndex === startIndex + 1
      ? `${startIndex + 1}`
      : `${startIndex + 1}-${endIndex}`;

  useInput((input, key) => {
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    if (showPopup) {
      if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        setShowPopup(false);
        const operationKey = operations[selectedOperation].key;
        if (operationKey === "view_details") {
          navigate("axon-detail", { axonId: selectedAxonItem.id });
        }
      } else if (input === "v" && selectedAxonItem) {
        setShowPopup(false);
        navigate("axon-detail", { axonId: selectedAxonItem.id });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      }
      return;
    }

    const pageAxons = axons.length;

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (
      key.upArrow &&
      selectedIndex === 0 &&
      !loading &&
      !navigating &&
      hasPrev
    ) {
      prevPage();
      setSelectedIndex(pageAxons - 1);
    } else if (key.downArrow && selectedIndex < pageAxons - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      key.downArrow &&
      selectedIndex === pageAxons - 1 &&
      !loading &&
      !navigating &&
      hasMore
    ) {
      nextPage();
      setSelectedIndex(0);
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
    } else if (key.return && selectedAxonItem) {
      navigate("axon-detail", { axonId: selectedAxonItem.id });
    } else if (input === "a" && selectedAxonItem) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "o" && selectedAxonItem) {
      openInBrowser(getAxonUrl(selectedAxonItem.id));
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
      if (onBack) {
        onBack();
      } else if (onExit) {
        onExit();
      } else {
        inkExit();
      }
    }
  });

  // Loading state
  if (loading && axons.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Axons", active: true }]} />
        <SpinnerComponent message="Loading axons..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Axons", active: true }]} />
        <ErrorMessage message="Failed to list axons" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Axons", active: true }]} />

      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search axons (name or axn_ID)..."
      />

      {!showPopup && (
        <Table
          data={axons}
          keyExtractor={(a: Axon) => a.id}
          selectedIndex={selectedIndex}
          title={`axons[${totalCount}]`}
          columns={tableColumns}
          emptyState={
            <Text color={colors.textDim}>{figures.info} No axons found.</Text>
          }
        />
      )}

      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          {totalCount > 0 && (
            <>
              <Text color={colors.primary} bold>
                {figures.hamburger} {totalCount}
              </Text>
              <Text color={colors.textDim} dimColor>
                {" "}
                total
              </Text>
            </>
          )}
          {totalCount > 0 && totalPages > 1 && (
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
          {endIndex > startIndex && (
            <>
              <Text color={colors.textDim} dimColor>
                {totalCount > 0 ? " • " : ""}
              </Text>
              <Text color={colors.textDim} dimColor>
                Showing {showingRange}
                {totalCount > 0 ? ` of ${totalCount}` : ""}
              </Text>
            </>
          )}
          {search.submittedSearchQuery && (
            <>
              <Text color={colors.textDim} dimColor>
                {" "}
                •{" "}
              </Text>
              <Text color={colors.warning}>
                Filtered: &quot;{search.submittedSearchQuery}&quot;
              </Text>
            </>
          )}
        </Box>
      )}

      {showPopup && selectedAxonItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedAxonItem}
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
          { key: "o", label: "Browser" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
};
