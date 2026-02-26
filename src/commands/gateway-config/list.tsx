import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import type { GatewayConfigsCursorIDPage } from "@runloop/api-client/pagination";
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
import { GatewayConfigCreatePage } from "../../components/GatewayConfigCreatePage.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

interface ListOptions {
  name?: string;
  limit?: string;
  output?: string;
}

// Local interface for gateway config data used in this component
interface GatewayConfigListItem {
  id: string;
  name: string;
  description?: string;
  endpoint: string;
  create_time_ms: number;
  auth_mechanism: {
    type: string;
    key?: string | null;
  };
  account_id?: string | null;
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * Get a display label for the auth mechanism type
 */
function getAuthTypeLabel(
  authMechanism: GatewayConfigListItem["auth_mechanism"],
): string {
  if (authMechanism.type === "bearer") {
    return "Bearer";
  }
  if (authMechanism.type === "header") {
    return authMechanism.key ? `Header: ${authMechanism.key}` : "Header";
  }
  return authMechanism.type;
}

const ListGatewayConfigsUI = ({
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
    React.useState<GatewayConfigListItem | null>(null);
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
    React.useState<GatewayConfigListItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

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

  // All width constants
  const fixedWidth = 6; // border + padding
  const idWidth = 25;
  const authWidth = 15;
  const timeWidth = 20;
  const showEndpoint = terminalWidth >= 100;
  const endpointWidth = Math.max(20, terminalWidth >= 140 ? 40 : 25);

  // Name width uses remaining space after fixed columns
  const baseWidth = fixedWidth + idWidth + authWidth + timeWidth;
  const optionalWidth = showEndpoint ? endpointWidth : 0;
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageConfigs: GatewayConfigListItem[] = [];

      // Build query params
      const queryParams: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (search.submittedSearchQuery) {
        queryParams.name = search.submittedSearchQuery;
      }

      // Fetch ONE page only
      const page = (await client.gatewayConfigs.list(
        queryParams,
      )) as unknown as GatewayConfigsCursorIDPage<GatewayConfigListItem>;

      // Extract data and create defensive copies
      if (page.gateway_configs && Array.isArray(page.gateway_configs)) {
        page.gateway_configs.forEach((g: GatewayConfigListItem) => {
          pageConfigs.push({
            id: g.id,
            name: g.name,
            description: g.description,
            endpoint: g.endpoint,
            create_time_ms: g.create_time_ms,
            auth_mechanism: {
              type: g.auth_mechanism.type,
              key: g.auth_mechanism.key,
            },
            account_id: g.account_id,
          });
        });
      }

      const result = {
        items: pageConfigs,
        hasMore: page.has_more || false,
        totalCount: pageConfigs.length,
      };

      return result;
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
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
    getItemId: (config: GatewayConfigListItem) => config.id,
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

  // Operations for a specific gateway config (shown in popup)
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
        label: "Edit Agent Gateway Config",
        color: colors.warning,
        icon: figures.pointer,
      },
      {
        key: "delete",
        label: "Delete Agent Gateway Config",
        color: colors.error,
        icon: figures.cross,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn(
        "id",
        "ID",
        (config: GatewayConfigListItem) => config.id,
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
        (config: GatewayConfigListItem) => config.name || "",
        {
          width: nameWidth,
        },
      ),
      ...(showEndpoint
        ? [
            createTextColumn(
              "endpoint",
              "Endpoint",
              (config: GatewayConfigListItem) => config.endpoint || "",
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
        "auth",
        "Auth",
        (config: GatewayConfigListItem) =>
          getAuthTypeLabel(config.auth_mechanism),
        {
          width: authWidth,
          color: colors.info,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (config: GatewayConfigListItem) =>
          config.create_time_ms ? formatTimeAgo(config.create_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, endpointWidth, authWidth, timeWidth, showEndpoint],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (configs.length > 0 && selectedIndex >= configs.length) {
      setSelectedIndex(Math.max(0, configs.length - 1));
    }
  }, [configs.length, selectedIndex]);

  const selectedConfigItem = configs[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + configs.length;

  const executeOperation = async (
    config: GatewayConfigListItem,
    operationKey: string,
  ) => {
    const client = getClient();

    if (!config) return;

    try {
      setOperationLoading(true);
      switch (operationKey) {
        case "delete":
          await client.gatewayConfigs.delete(config.id);
          setOperationResult(
            `Agent gateway config "${config.name}" deleted successfully`,
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
    // Handle search mode input
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        const wasDelete = executingOperation === "delete";
        const hadError = operationError !== null;
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setSelectedConfig(null);
        // Refresh the list after delete to show updated data
        if (wasDelete && !hadError) {
          setTimeout(() => refresh(), 0);
        }
      }
      return;
    }

    // Handle create config screen
    if (showCreateConfig) {
      return;
    }

    // Handle edit config screen
    if (showEditConfig) {
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

        if (operationKey === "create") {
          setShowCreateConfig(true);
        } else if (operationKey === "view_details") {
          navigate("gateway-config-detail", {
            gatewayConfigId: selectedConfigItem.id,
          });
        } else if (operationKey === "edit") {
          // Show edit form
          setEditingConfig(selectedConfigItem);
          setShowEditConfig(true);
        } else if (operationKey === "delete") {
          // Show delete confirmation
          setSelectedConfig(selectedConfigItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedConfig(selectedConfigItem);
          setExecutingOperation(operationKey);
          // Execute immediately with values passed directly
          executeOperation(selectedConfigItem, operationKey);
        }
      } else if (input === "c") {
        // Create hotkey
        setShowPopup(false);
        setShowCreateConfig(true);
      } else if (input === "v" && selectedConfigItem) {
        // View details hotkey
        setShowPopup(false);
        navigate("gateway-config-detail", {
          gatewayConfigId: selectedConfigItem.id,
        });
      } else if (input === "e" && selectedConfigItem) {
        // Edit hotkey
        setShowPopup(false);
        setEditingConfig(selectedConfigItem);
        setShowEditConfig(true);
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "d") {
        // Delete hotkey - show confirmation
        setShowPopup(false);
        setSelectedConfig(selectedConfigItem);
        setShowDeleteConfirm(true);
      }
      return;
    }

    const pageConfigs = configs.length;

    // Handle list view navigation
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
      // Enter key navigates to detail view
      navigate("gateway-config-detail", {
        gatewayConfigId: selectedConfigItem.id,
      });
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      // Create shortcut
      setShowCreateConfig(true);
    } else if (input === "e" && selectedConfigItem) {
      // Edit shortcut
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

  // Delete confirmation
  if (showDeleteConfirm && selectedConfig) {
    return (
      <ConfirmationPrompt
        title="Delete Agent Gateway Config"
        message={`Are you sure you want to delete "${selectedConfig.name}"?`}
        details="This action cannot be undone. Any devboxes using this Agent gateway config will no longer have access to it."
        breadcrumbItems={[
          { label: "Agent Gateway Configs" },
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

  // Operation result display
  if (operationResult || operationError) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Agent Gateway Configs" },
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

  // Operation loading state
  if (operationLoading && selectedConfig) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting Agent gateway config...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Agent Gateway Configs" },
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

  // Create config screen
  if (showCreateConfig) {
    return (
      <GatewayConfigCreatePage
        onBack={() => setShowCreateConfig(false)}
        onCreate={(config) => {
          setShowCreateConfig(false);
          navigate("gateway-config-detail", { gatewayConfigId: config.id });
        }}
      />
    );
  }

  // Edit config screen
  if (showEditConfig && editingConfig) {
    return (
      <GatewayConfigCreatePage
        onBack={() => {
          setShowEditConfig(false);
          setEditingConfig(null);
        }}
        onCreate={() => {
          setShowEditConfig(false);
          setEditingConfig(null);
          // Refresh the list to show updated data
          setTimeout(() => refresh(), 0);
        }}
        initialConfig={editingConfig}
      />
    );
  }

  // Loading state
  if (loading && configs.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Agent Gateway Configs", active: true }]} />
        <SpinnerComponent message="Loading Agent gateway configs..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Agent Gateway Configs", active: true }]} />
        <ErrorMessage
          message="Failed to list Agent gateway configs"
          error={error}
        />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Agent Gateway Configs", active: true }]} />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search Agent gateway configs..."
      />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={configs}
          keyExtractor={(config: GatewayConfigListItem) => config.id}
          selectedIndex={selectedIndex}
          title={`gateway_configs[${hasMore ? `${totalCount}+` : totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No Agent gateway configs found. Press [c] to create
              one.
            </Text>
          }
        />
      )}

      {/* Statistics Bar - hide when popup is shown */}
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

      {/* Actions Popup */}
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

// Export the UI component for use in the main menu
export { ListGatewayConfigsUI };

export async function listGatewayConfigs(options: ListOptions = {}) {
  try {
    const client = getClient();

    const maxResults = parseLimit(options.limit);
    const allConfigs: unknown[] = [];
    let startingAfter: string | undefined;

    do {
      const remaining = maxResults - allConfigs.length;
      // Build query params
      const queryParams: Record<string, unknown> = {
        limit: Math.min(DEFAULT_PAGE_SIZE, remaining),
      };
      if (options.name) {
        queryParams.name = options.name;
      }
      if (startingAfter) {
        queryParams.starting_after = startingAfter;
      }

      // Fetch one page
      const page = (await client.gatewayConfigs.list(
        queryParams,
      )) as GatewayConfigsCursorIDPage<{ id: string }>;

      const pageConfigs = page.gateway_configs || [];
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
    outputError("Failed to list gateway configs", error);
  }
}
