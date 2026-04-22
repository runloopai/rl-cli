/**
 * List agents command
 */

import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import chalk from "chalk";
import {
  listAgents,
  listPublicAgents,
  deleteAgent,
  type Agent,
} from "../../services/agentService.js";
import { output, outputError, parseLimit } from "../../utils/output.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { NavigationTips } from "../../components/NavigationTips.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { Header } from "../../components/Header.js";
import { SearchBar } from "../../components/SearchBar.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";
import type { Operation } from "../../components/OperationsMenu.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useListSearch } from "../../hooks/useListSearch.js";
import { useNavigation } from "../../store/navigationStore.js";

interface ListOptions {
  full?: boolean;
  name?: string;
  search?: string;
  public?: boolean;
  private?: boolean;
  limit?: string;
  startingAfter?: string;
  output?: string;
}

interface ColumnDef {
  header: string;
  raw: (agent: Agent) => string;
  styled: (agent: Agent) => string;
}

const columns: ColumnDef[] = [
  {
    header: "NAME",
    raw: (a) => a.name,
    styled(a) {
      return this.raw(a);
    },
  },
  {
    header: "SOURCE",
    raw: (a) => a.source?.type || "-",
    styled(a) {
      return this.raw(a);
    },
  },
  {
    header: "VERSION",
    raw: (a) => {
      if (!a.version) return "-";
      const pkg = a.source?.npm?.package_name || a.source?.pip?.package_name;
      return pkg ? `${pkg}@${a.version}` : a.version;
    },
    styled(a) {
      if (!a.version) return "-";
      const pkg = a.source?.npm?.package_name || a.source?.pip?.package_name;
      return pkg ? chalk.dim(pkg + "@") + a.version : a.version;
    },
  },
  {
    header: "ID",
    raw: (a) => a.id,
    styled(a) {
      return chalk.dim(a.id);
    },
  },
  {
    header: "CREATED",
    raw: (a) => formatTimeAgo(a.create_time_ms),
    styled(a) {
      return chalk.dim(this.raw(a));
    },
  },
];

function computeColumnWidths(agents: Agent[]): number[] {
  const minPad = 2;
  const maxPad = 4;
  const termWidth = process.stdout.columns || 120;

  // Min width per column: max of header and all row values, plus minimum padding
  const minWidths = columns.map((col) => {
    const maxContent = agents.reduce(
      (w, a) => Math.max(w, col.raw(a).length),
      col.header.length,
    );
    return maxContent + minPad;
  });

  const totalMin = minWidths.reduce((s, w) => s + w, 0);
  const slack = termWidth - totalMin;
  const extraPerCol = Math.min(
    maxPad - minPad,
    Math.max(0, Math.floor(slack / columns.length)),
  );

  return minWidths.map((w) => w + extraPerCol);
}

function padStyled(raw: string, styled: string, width: number): string {
  return styled + " ".repeat(Math.max(0, width - raw.length));
}

/**
 * Render a table of agents to stdout. Reusable by other commands.
 */
export function printAgentTable(agents: Agent[]): void {
  if (agents.length === 0) {
    console.log(chalk.dim("No agents found"));
    return;
  }

  const widths = computeColumnWidths(agents);
  const termWidth = process.stdout.columns || 120;

  // Header
  const header = columns.map((col, i) => col.header.padEnd(widths[i])).join("");
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(Math.min(header.length, termWidth))));

  // Rows
  for (const agent of agents) {
    const line = columns
      .map((col, i) => padStyled(col.raw(agent), col.styled(agent), widths[i]))
      .join("");
    console.log(line);
  }

  console.log();
  console.log(
    chalk.dim(`${agents.length} agent${agents.length !== 1 ? "s" : ""}`),
  );
}

function printTable(agents: Agent[], isPublic: boolean): void {
  if (isPublic) {
    console.log(
      chalk.dim("Showing PUBLIC agents. Use --private to see private agents"),
    );
  } else {
    console.log(
      chalk.dim("Showing PRIVATE agents. Use --public to see public agents"),
    );
  }
  console.log();

  printAgentTable(agents);
}

/**
 * Keep only the most recently created agent for each name.
 */
function keepLatestPerName(agents: Agent[]): Agent[] {
  const latestByName = new Map<string, Agent>();
  for (const agent of agents) {
    const existing = latestByName.get(agent.name);
    if (!existing || agent.create_time_ms > existing.create_time_ms) {
      latestByName.set(agent.name, agent);
    }
  }
  return Array.from(latestByName.values());
}

// ─── TUI Component ───────────────────────────────────────────────────────────

type AgentTab = "private" | "public";

export const ListAgentsUI = ({
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
  const [activeTab, setActiveTab] = React.useState<AgentTab>("private");

  // Delete state
  const [selectedAgent, setSelectedAgent] = React.useState<Agent | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [executingOperation, setExecutingOperation] = React.useState<
    string | null
  >(null);
  const [operationResult, setOperationResult] = React.useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = React.useState<Error | null>(
    null,
  );
  const [operationLoading, setOperationLoading] = React.useState(false);
  const [needsRefresh, setNeedsRefresh] = React.useState(false);

  // Search state
  const search = useListSearch({
    onSearchSubmit: () => setSelectedIndex(0),
    onSearchClear: () => setSelectedIndex(0),
  });

  const overhead = 14 + search.getSearchOverhead();
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // Column widths
  const fixedWidth = 6;
  const idWidth = 25;
  const versionWidth = 20;
  const sourceWidth = 10;
  const timeWidth = 18;
  const showSourceColumn = terminalWidth >= 100;
  const showVersionColumn = terminalWidth >= 85;
  const baseWidth =
    fixedWidth +
    idWidth +
    timeWidth +
    (showVersionColumn ? versionWidth : 0) +
    (showSourceColumn ? sourceWidth : 0);
  const nameWidth = Math.min(40, Math.max(15, terminalWidth - baseWidth));

  const fetchPage = React.useCallback(
    async (params: {
      limit: number;
      startingAt?: string;
      includeTotalCount?: boolean;
    }) => {
      const fetchFn = activeTab === "public" ? listPublicAgents : listAgents;
      const result = await fetchFn({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: search.submittedSearchQuery || undefined,
        includeTotalCount: params.includeTotalCount,
        privateOnly: activeTab === "private" ? true : undefined,
      });
      return {
        items: result.agents,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [search.submittedSearchQuery, activeTab],
  );

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
    refresh,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (agent: Agent) => agent.id,
    pollInterval: 5000,
    pollingEnabled:
      !showPopup &&
      !showDeleteConfirm &&
      !executingOperation &&
      !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery, activeTab],
  });

  const operations: Operation[] = React.useMemo(() => {
    const ops: Operation[] = [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
    ];
    if (activeTab !== "public") {
      ops.push({
        key: "delete",
        label: "Delete",
        color: colors.error,
        icon: figures.cross,
      });
    }
    return ops;
  }, [activeTab]);

  const tableColumns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (a: Agent) => a.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn("name", "Name", (a: Agent) => a.name, {
        width: nameWidth,
      }),
      createTextColumn(
        "version",
        "Version",
        (a: Agent) => {
          const v = a.version || "";
          if (!v) return "-";
          if (v.length > 16) return `${v.slice(0, 8)}…${v.slice(-4)}`;
          return v;
        },
        {
          width: versionWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
          visible: showVersionColumn,
        },
      ),
      createTextColumn(
        "source",
        "Source",
        (a: Agent) => a.source?.type || "-",
        {
          width: sourceWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
          visible: showSourceColumn,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (a: Agent) => (a.create_time_ms ? formatTimeAgo(a.create_time_ms) : ""),
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [
      idWidth,
      nameWidth,
      versionWidth,
      sourceWidth,
      timeWidth,
      showVersionColumn,
      showSourceColumn,
    ],
  );

  useExitOnCtrlC();

  // Refresh list after a successful delete
  React.useEffect(() => {
    if (needsRefresh) {
      setNeedsRefresh(false);
      refresh();
    }
  }, [needsRefresh, refresh]);

  React.useEffect(() => {
    if (agents.length > 0 && selectedIndex >= agents.length) {
      setSelectedIndex(Math.max(0, agents.length - 1));
    }
  }, [agents.length, selectedIndex]);

  const selectedAgentItem = agents[selectedIndex];

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex =
    totalCount > 0
      ? Math.min(startIndex + agents.length, totalCount)
      : startIndex + agents.length;
  const showingRange = navigating
    ? `${startIndex + 1}+`
    : endIndex === startIndex + 1
      ? `${startIndex + 1}`
      : `${startIndex + 1}-${endIndex}`;

  const executeOperation = async (agent: Agent, operationKey: string) => {
    if (!agent) return;
    try {
      setOperationLoading(true);
      switch (operationKey) {
        case "delete":
          await deleteAgent(agent.id);
          setOperationResult(`Agent ${agent.name} deleted successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setOperationLoading(false);
    }
  };

  useInput((input, key) => {
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        const wasDelete = executingOperation === "delete";
        const hadError = operationError !== null;
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setSelectedAgent(null);
        if (wasDelete && !hadError) {
          setNeedsRefresh(true);
        }
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
          navigate("agent-detail", { agentId: selectedAgentItem.id });
        } else if (operationKey === "delete") {
          setSelectedAgent(selectedAgentItem);
          setShowDeleteConfirm(true);
        }
      } else if (input === "v" && selectedAgentItem) {
        setShowPopup(false);
        navigate("agent-detail", { agentId: selectedAgentItem.id });
      } else if (input === "d" && activeTab !== "public") {
        setShowPopup(false);
        setSelectedAgent(selectedAgentItem);
        setShowDeleteConfirm(true);
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      }
      return;
    }

    // Tab switching
    if (key.tab) {
      setActiveTab((prev) => (prev === "private" ? "public" : "private"));
      setSelectedIndex(0);
      return;
    }

    const pageAgents = agents.length;

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
      setSelectedIndex(pageAgents - 1);
    } else if (key.downArrow && selectedIndex < pageAgents - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      key.downArrow &&
      selectedIndex === pageAgents - 1 &&
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
    } else if (key.return && selectedAgentItem) {
      navigate("agent-detail", { agentId: selectedAgentItem.id });
    } else if (input === "a" && selectedAgentItem) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c" && activeTab === "private") {
      navigate("agent-create");
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

  // Operation result display
  if (operationResult || operationError) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Agents" },
            {
              label: selectedAgent?.name || "Agent",
            },
            { label: "Result", active: true },
          ]}
        />
        <Header title="Operation Result" />
        {operationResult && <SuccessMessage message={operationResult} />}
        {operationError && (
          <ErrorMessage message="Operation failed" error={operationError} />
        )}
        <NavigationTips tips={[{ key: "Enter/q/esc", label: "Continue" }]} />
      </>
    );
  }

  // Delete confirmation
  if (showDeleteConfirm && selectedAgent) {
    return (
      <ConfirmationPrompt
        title="Delete Agent"
        message={`Are you sure you want to delete "${selectedAgent.name}" (${selectedAgent.id})?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Agents" },
          { label: selectedAgent.name },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedAgent, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedAgent(null);
        }}
      />
    );
  }

  // Operation loading
  if (operationLoading && selectedAgent) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Agents" },
            { label: selectedAgent.name },
            { label: "Deleting", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting agent..." />
      </>
    );
  }

  // Loading state
  if (loading && agents.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Agents", active: true }]} />
        <SpinnerComponent message="Loading agents..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Agents", active: true }]} />
        <ErrorMessage message="Failed to list agents" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Agents", active: true }]} />

      {/* Tab bar */}
      <Box paddingX={2} marginBottom={0}>
        <Text
          color={activeTab === "private" ? colors.primary : colors.textDim}
          bold={activeTab === "private"}
        >
          {activeTab === "private" ? figures.pointer : " "} Private
        </Text>
        <Text color={colors.textDim}> │ </Text>
        <Text
          color={activeTab === "public" ? colors.primary : colors.textDim}
          bold={activeTab === "public"}
        >
          {activeTab === "public" ? figures.pointer : " "} Public
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          (Tab to switch)
        </Text>
      </Box>

      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search agents..."
      />

      {!showPopup && (
        <Table
          data={agents}
          keyExtractor={(a: Agent) => a.id}
          selectedIndex={selectedIndex}
          title={`agents[${totalCount}]`}
          columns={tableColumns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No {activeTab} agents found.
            </Text>
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

      {showPopup && selectedAgentItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedAgentItem}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "view_details"
                  ? "v"
                  : op.key === "delete"
                    ? "d"
                    : "",
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
          { key: "Tab", label: "Switch tab" },
          { key: "Enter", label: "Details" },
          { key: "a", label: "Actions" },
          { key: "c", label: "Create", condition: activeTab === "private" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
};

const CLI_PAGE_SIZE = 100;

export async function listAgentsCommand(options: ListOptions): Promise<void> {
  try {
    const maxResults = parseLimit(options.limit);

    let agents: Agent[];

    if (options.startingAfter) {
      const pageLimit = maxResults === Infinity ? CLI_PAGE_SIZE : maxResults;
      const { agents: page, hasMore } = await listAgents({
        limit: pageLimit,
        startingAfter: options.startingAfter,
        publicOnly: options.public,
        privateOnly: options.private,
        name: options.name,
        search: options.search,
      });
      agents = options.full ? page : keepLatestPerName(page);
      if (hasMore && agents.length > 0) {
        console.log(
          chalk.dim(
            "More results may be available; use --starting-after with the last ID to continue.",
          ),
        );
        console.log();
      }
    } else {
      const all: Agent[] = [];
      let cursor: string | undefined;
      while (all.length < maxResults) {
        const remaining = maxResults - all.length;
        const pageLimit = Math.min(CLI_PAGE_SIZE, remaining);
        const { agents: page, hasMore } = await listAgents({
          limit: pageLimit,
          startingAfter: cursor,
          publicOnly: options.public,
          privateOnly: options.private,
          name: options.name,
          search: options.search,
        });
        all.push(...page);
        if (!hasMore || page.length === 0) {
          break;
        }
        cursor = page[page.length - 1].id;
      }
      agents = options.full ? all : keepLatestPerName(all);
    }

    output(agents, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list agents", error);
  }
}
