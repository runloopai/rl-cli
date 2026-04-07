/**
 * AgentListScreen - List and manage agents
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { listAgents, listPublicAgents } from "../services/agentService.js";
import type { Agent } from "../services/agentService.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import {
  Table,
  createTextColumn,
  createComponentColumn,
} from "../components/Table.js";
import { SearchBar } from "../components/SearchBar.js";
import { colors } from "../utils/theme.js";
import { formatTimeAgo } from "../components/ResourceListView.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useCursorPagination } from "../hooks/useCursorPagination.js";
import { useListSearch } from "../hooks/useListSearch.js";

type Tab = "private" | "public";

export function AgentListScreen() {
  const { navigate, goBack } = useNavigation();
  const [activeTab, setActiveTab] = React.useState<Tab>("private");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  useExitOnCtrlC();

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

  // Column widths — only show crown column in public tab
  const fixedWidth = 6;
  const crownWidth = activeTab === "public" ? 3 : 0;
  const idWidth = 25;
  const sourceWidth = 12;
  const versionWidth = 15;
  const createdWidth = 18;
  const baseWidth =
    fixedWidth +
    crownWidth +
    idWidth +
    sourceWidth +
    versionWidth +
    createdWidth;
  const remainingWidth = terminalWidth - baseWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const fetchFn = activeTab === "public" ? listPublicAgents : listAgents;
      const result = await fetchFn({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: search.submittedSearchQuery || undefined,
      });

      return {
        items: result.agents,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [activeTab, search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: agents,
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
    getItemId: (agent: Agent) => agent.id,
    pollInterval: 5000,
    pollingEnabled: !search.searchMode,
    deps: [PAGE_SIZE, activeTab, search.submittedSearchQuery],
  });

  // Build columns
  const columns = React.useMemo(() => {
    const cols = [
      createTextColumn("id", "ID", (agent: Agent) => agent.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
    ];

    // Only show crown column in public tab
    if (activeTab === "public") {
      cols.push(
        createComponentColumn<Agent>(
          "public",
          " ",
          (agent, _index, isSelected) => {
            return (
              <Text inverse={isSelected}>
                <Text color={colors.accent2} inverse={isSelected}>
                  ➰{" "}
                </Text>
              </Text>
            );
          },
          { width: crownWidth },
        ) as any,
      );
    }

    cols.push(
      createTextColumn("name", "Name", (agent: Agent) => agent.name || "", {
        width: nameWidth,
      }),
      createTextColumn(
        "source",
        "Source",
        (agent: Agent) => agent.source?.type || "-",
        {
          width: sourceWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn("version", "Version", (agent: Agent) => agent.version, {
        width: versionWidth,
        color: colors.accent3,
        dimColor: false,
        bold: false,
      }),
      createTextColumn(
        "created",
        "Created",
        (agent: Agent) => formatTimeAgo(agent.create_time_ms),
        {
          width: createdWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    );

    return cols;
  }, [
    crownWidth,
    idWidth,
    nameWidth,
    sourceWidth,
    versionWidth,
    createdWidth,
    activeTab,
  ]);

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (agents.length > 0 && selectedIndex >= agents.length) {
      setSelectedIndex(Math.max(0, agents.length - 1));
    }
  }, [agents.length, selectedIndex]);

  const selectedAgent = agents[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + agents.length;

  useInput((input, key) => {
    // Handle search mode input
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    const pageAgents = agents.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageAgents - 1) {
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
    } else if (key.return && selectedAgent) {
      navigate("agent-detail", { agentId: selectedAgent.id });
    } else if (key.tab) {
      setActiveTab(activeTab === "private" ? "public" : "private");
      setSelectedIndex(0);
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (input === "c") {
      navigate("agent-create");
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
      goBack();
    }
  });

  // Loading state
  if (loading && agents.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Home" }, { label: "Agents", active: true }]}
        />
        <SpinnerComponent message="Loading agents..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Home" }, { label: "Agents", active: true }]}
        />
        <ErrorMessage message="Failed to load agents" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb
        items={[{ label: "Home" }, { label: "Agents", active: true }]}
      />

      {/* Tab bar */}
      <Box paddingX={1} marginBottom={1}>
        <Text
          color={activeTab === "private" ? colors.primary : colors.textDim}
          bold={activeTab === "private"}
        >
          {activeTab === "private" ? "▸ " : "  "}Private
        </Text>
        <Text color={colors.textDim}> | </Text>
        <Text
          color={activeTab === "public" ? colors.primary : colors.textDim}
          bold={activeTab === "public"}
        >
          {activeTab === "public" ? "▸ " : "  "}Public
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
        placeholder="Search agents..."
      />

      {/* Table */}
      <Table
        data={agents}
        keyExtractor={(agent: Agent) => agent.id}
        selectedIndex={selectedIndex}
        title={`agents[${totalCount}]`}
        columns={columns}
        emptyState={
          <Text color={colors.textDim}>{figures.info} No agents found</Text>
        }
      />

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
          { key: "Enter", label: "Details" },
          { key: "Tab", label: "Switch tab" },
          { key: "/", label: "Search" },
          { key: "c", label: "Create" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}
