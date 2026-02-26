import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import type { McpConfigsCursorIDPage } from "@runloop/api-client/pagination";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { NavigationTips } from "../../components/NavigationTips.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { Operation } from "../../components/OperationsMenu.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { SearchBar } from "../../components/SearchBar.js";
import { output, outputError, parseLimit } from "../../utils/output.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useListSearch } from "../../hooks/useListSearch.js";
import { useNavigation } from "../../store/navigationStore.js";
import { McpConfigCreatePage } from "../../components/McpConfigCreatePage.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

interface ListOptions {
  name?: string;
  limit?: string;
  output?: string;
}

interface McpConfigListItem {
  id: string;
  name: string;
  description?: string;
  endpoint: string;
  create_time_ms: number;
  allowed_tools: string[];
}

const DEFAULT_PAGE_SIZE = 10;

function formatAllowedTools(tools: string[]): string {
  if (!tools || tools.length === 0) return "(none)";
  const joined = tools.join(", ");
  return joined.length > 30 ? joined.substring(0, 27) + "..." : joined;
}

const ListMcpConfigsUI = ({
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
  const [selectedConfig, setSelectedConfig] =
    React.useState<McpConfigListItem | null>(null);
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
  const [showCreateConfig, setShowCreateConfig] = React.useState(false);
  const [showEditConfig, setShowEditConfig] = React.useState(false);
  const [editingConfig, setEditingConfig] =
    React.useState<McpConfigListItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

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

  const fixedWidth = 6;
  const idWidth = 25;
  const toolsWidth = 20;
  const timeWidth = 20;
  const showEndpoint = terminalWidth >= 100;
  const endpointWidth = Math.max(20, terminalWidth >= 140 ? 40 : 25);

  const baseWidth = fixedWidth + idWidth + toolsWidth + timeWidth;
  const optionalWidth = showEndpoint ? endpointWidth : 0;
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageConfigs: McpConfigListItem[] = [];

      const queryParams: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (search.submittedSearchQuery) {
        queryParams.name = search.submittedSearchQuery;
      }

      const page = (await client.mcpConfigs.list(
        queryParams,
      )) as unknown as McpConfigsCursorIDPage<McpConfigListItem>;

      if (page.mcp_configs && Array.isArray(page.mcp_configs)) {
        page.mcp_configs.forEach((m: McpConfigListItem) => {
          pageConfigs.push({
            id: m.id,
            name: m.name,
            description: m.description,
            endpoint: m.endpoint,
            create_time_ms: m.create_time_ms,
            allowed_tools: Array.isArray(m.allowed_tools)
              ? m.allowed_tools
              : [],
          });
        });
      }

      return {
        items: pageConfigs,
        hasMore: page.has_more || false,
        totalCount: pageConfigs.length,
      };
    },
    [search.submittedSearchQuery],
  );

  const {
    items: configs,
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
    getItemId: (config: McpConfigListItem) => config.id,
    pollInterval: 5000,
    pollingEnabled:
      !showPopup &&
      !executingOperation &&
      !showCreateConfig &&
      !showEditConfig &&
      !showDeleteConfirm &&
      !search.searchMode,
    deps: [search.submittedSearchQuery],
  });

  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
      {
        key: "edit",
        label: "Edit MCP Config",
        color: colors.warning,
        icon: figures.pointer,
      },
      {
        key: "delete",
        label: "Delete MCP Config",
        color: colors.error,
        icon: figures.cross,
      },
    ],
    [],
  );

  const columns = React.useMemo(
    () => [
      createTextColumn(
        "id",
        "ID",
        (config: McpConfigListItem) => config.id,
        {
          width: idWidth + 1,
          color: colors.idColor,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "name",
        "Name",
        (config: McpConfigListItem) => config.name || "",
        {
          width: nameWidth,
        },
      ),
      ...(showEndpoint
        ? [
            createTextColumn(
              "endpoint",
              "Endpoint",
              (config: McpConfigListItem) => config.endpoint || "",
              {
                width: endpointWidth,
                color: colors.textDim,
                dimColor: false,
                bold: false,
              },
            ),
          ]
        : []),
      createTextColumn(
        "tools",
        "Tools",
        (config: McpConfigListItem) => formatAllowedTools(config.allowed_tools),
        {
          width: toolsWidth,
          color: colors.info,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (config: McpConfigListItem) =>
          config.create_time_ms ? formatTimeAgo(config.create_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, endpointWidth, toolsWidth, timeWidth, showEndpoint],
  );

  useExitOnCtrlC();

  React.useEffect(() => {
    if (configs.length > 0 && selectedIndex >= configs.length) {
      setSelectedIndex(Math.max(0, configs.length - 1));
    }
  }, [configs.length, selectedIndex]);

  const selectedConfigItem = configs[selectedIndex];

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + configs.length;

  const executeOperation = async (
    config: McpConfigListItem,
    operationKey: string,
  ) => {
    const client = getClient();

    if (!config) return;

    try {
      setOperationLoading(true);
      switch (operationKey) {
        case "delete":
          await client.mcpConfigs.delete(config.id);
          setOperationResult(
            `MCP config "${config.name}" deleted successfully`,
          );
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
        setSelectedConfig(null);
        if (wasDelete && !hadError) {
          setTimeout(() => refresh(), 0);
        }
      }
      return;
    }

    if (showCreateConfig) {
      return;
    }

    if (showEditConfig) {
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

        if (operationKey === "create") {
          setShowCreateConfig(true);
        } else if (operationKey === "view_details") {
          navigate("mcp-config-detail", {
            mcpConfigId: selectedConfigItem.id,
          });
        } else if (operationKey === "edit") {
          setEditingConfig(selectedConfigItem);
          setShowEditConfig(true);
        } else if (operationKey === "delete") {
          setSelectedConfig(selectedConfigItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedConfig(selectedConfigItem);
          setExecutingOperation(operationKey);
          executeOperation(selectedConfigItem, operationKey);
        }
      } else if (input === "c") {
        setShowPopup(false);
        setShowCreateConfig(true);
      } else if (input === "v" && selectedConfigItem) {
        setShowPopup(false);
        navigate("mcp-config-detail", {
          mcpConfigId: selectedConfigItem.id,
        });
      } else if (input === "e" && selectedConfigItem) {
        setShowPopup(false);
        setEditingConfig(selectedConfigItem);
        setShowEditConfig(true);
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "d") {
        setShowPopup(false);
        setSelectedConfig(selectedConfigItem);
        setShowDeleteConfirm(true);
      }
      return;
    }

    const pageConfigs = configs.length;

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
      setSelectedIndex(pageConfigs - 1);
    } else if (key.downArrow && selectedIndex < pageConfigs - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      key.downArrow &&
      selectedIndex === pageConfigs - 1 &&
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
    } else if (key.return && selectedConfigItem) {
      navigate("mcp-config-detail", {
        mcpConfigId: selectedConfigItem.id,
      });
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      setShowCreateConfig(true);
    } else if (input === "e" && selectedConfigItem) {
      setEditingConfig(selectedConfigItem);
      setShowEditConfig(true);
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

  if (showDeleteConfirm && selectedConfig) {
    return (
      <ConfirmationPrompt
        title="Delete MCP Config"
        message={`Are you sure you want to delete "${selectedConfig.name}"?`}
        details="This action cannot be undone. Any devboxes using this MCP config will no longer have access to it."
        breadcrumbItems={[
          { label: "MCP Configs" },
          { label: selectedConfig.name || selectedConfig.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedConfig, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedConfig(null);
        }}
      />
    );
  }

  if (operationResult || operationError) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            {
              label: selectedConfig?.name || selectedConfig?.id || "Config",
            },
            { label: operationLabel, active: true },
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

  if (operationLoading && selectedConfig) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting MCP config...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: selectedConfig.name || selectedConfig.id },
            { label: operationLabel, active: true },
          ]}
        />
        <Header title="Executing Operation" />
        <SpinnerComponent
          message={messages[executingOperation as string] || "Please wait..."}
        />
      </>
    );
  }

  if (showCreateConfig) {
    return (
      <McpConfigCreatePage
        onBack={() => setShowCreateConfig(false)}
        onCreate={(config) => {
          setShowCreateConfig(false);
          navigate("mcp-config-detail", { mcpConfigId: config.id });
        }}
      />
    );
  }

  if (showEditConfig && editingConfig) {
    return (
      <McpConfigCreatePage
        onBack={() => {
          setShowEditConfig(false);
          setEditingConfig(null);
        }}
        onCreate={() => {
          setShowEditConfig(false);
          setEditingConfig(null);
          setTimeout(() => refresh(), 0);
        }}
        initialConfig={editingConfig}
      />
    );
  }

  if (loading && configs.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "MCP Configs", active: true }]} />
        <SpinnerComponent message="Loading MCP configs..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "MCP Configs", active: true }]} />
        <ErrorMessage
          message="Failed to list MCP configs"
          error={error}
        />
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "MCP Configs", active: true }]} />

      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search MCP configs..."
      />

      {!showPopup && (
        <Table
          data={configs}
          keyExtractor={(config: McpConfigListItem) => config.id}
          selectedIndex={selectedIndex}
          title={`mcp_configs[${hasMore ? `${totalCount}+` : totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No MCP configs found. Press [c] to create
              one.
            </Text>
          }
        />
      )}

      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.primary} bold>
            {figures.hamburger} {hasMore ? `${totalCount}+` : totalCount}
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
                  Page {currentPage + 1} of{" "}
                  {hasMore ? `${totalPages}+` : totalPages}
                </Text>
              )}
            </>
          )}
          <Text color={colors.textDim} dimColor>
            {" "}
            •{" "}
          </Text>
          <Text color={colors.textDim} dimColor>
            Showing {startIndex + 1}-{endIndex} of{" "}
            {hasMore ? `${totalCount}+` : totalCount}
          </Text>
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

      {showPopup && selectedConfigItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedConfigItem}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "create"
                  ? "c"
                  : op.key === "view_details"
                    ? "v"
                    : op.key === "edit"
                      ? "e"
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
          { key: "Enter", label: "Details" },
          { key: "c", label: "Create" },
          { key: "e", label: "Edit" },
          { key: "a", label: "Actions" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
};

export { ListMcpConfigsUI };

export async function listMcpConfigs(options: ListOptions = {}) {
  try {
    const client = getClient();

    const maxResults = parseLimit(options.limit);
    const allConfigs: unknown[] = [];
    let startingAfter: string | undefined;

    do {
      const remaining = maxResults - allConfigs.length;
      const queryParams: Record<string, unknown> = {
        limit: Math.min(DEFAULT_PAGE_SIZE, remaining),
      };
      if (options.name) {
        queryParams.name = options.name;
      }
      if (startingAfter) {
        queryParams.starting_after = startingAfter;
      }

      const page = (await client.mcpConfigs.list(
        queryParams,
      )) as McpConfigsCursorIDPage<{ id: string }>;

      const pageConfigs = page.mcp_configs || [];
      allConfigs.push(...pageConfigs);

      if (
        page.has_more &&
        pageConfigs.length > 0 &&
        allConfigs.length < maxResults
      ) {
        startingAfter = (pageConfigs[pageConfigs.length - 1] as { id: string })
          .id;
      } else {
        startingAfter = undefined;
      }
    } while (startingAfter !== undefined);

    output(allConfigs, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list MCP configs", error);
  }
}
