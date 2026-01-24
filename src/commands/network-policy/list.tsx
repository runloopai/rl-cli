import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import type { NetworkPoliciesCursorIDPage } from "@runloop/api-client/pagination";
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
import { output, outputError } from "../../utils/output.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useListSearch } from "../../hooks/useListSearch.js";
import { useNavigation } from "../../store/navigationStore.js";
import { NetworkPolicyCreatePage } from "../../components/NetworkPolicyCreatePage.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

interface ListOptions {
  name?: string;
  output?: string;
}

// Local interface for network policy data used in this component
interface NetworkPolicyListItem {
  id: string;
  name: string;
  description?: string;
  create_time_ms: number;
  update_time_ms: number;
  egress: {
    allow_all: boolean;
    allow_devbox_to_devbox: boolean;
    allowed_hostnames: string[];
  };
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * Get a display label for the egress policy type
 */
function getEgressTypeLabel(egress: NetworkPolicyListItem["egress"]): string {
  if (egress.allow_all) {
    return "Allow All";
  }
  if (egress.allowed_hostnames.length === 0) {
    return "Deny All";
  }
  return `Custom (${egress.allowed_hostnames.length})`;
}

/**
 * Get color for egress type
 */
function getEgressTypeColor(egress: NetworkPolicyListItem["egress"]): string {
  if (egress.allow_all) {
    return colors.success;
  }
  if (egress.allowed_hostnames.length === 0) {
    return colors.error;
  }
  return colors.warning;
}

const ListNetworkPoliciesUI = ({
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
  const [selectedPolicy, setSelectedPolicy] =
    React.useState<NetworkPolicyListItem | null>(null);
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
  const [showCreatePolicy, setShowCreatePolicy] = React.useState(false);
  const [showEditPolicy, setShowEditPolicy] = React.useState(false);
  const [editingPolicy, setEditingPolicy] =
    React.useState<NetworkPolicyListItem | null>(null);
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
  const egressWidth = 15;
  const timeWidth = 20;
  const showDescription = terminalWidth >= 100;
  const descriptionWidth = Math.max(20, terminalWidth >= 140 ? 40 : 25);

  // Name width uses remaining space after fixed columns
  const baseWidth = fixedWidth + idWidth + egressWidth + timeWidth;
  const optionalWidth = showDescription ? descriptionWidth : 0;
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pagePolicies: NetworkPolicyListItem[] = [];

      // Build query params
      const queryParams: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (search.submittedSearchQuery) {
        queryParams.search = search.submittedSearchQuery;
      }

      // Fetch ONE page only
      const page = (await client.networkPolicies.list(
        queryParams,
      )) as unknown as NetworkPoliciesCursorIDPage<NetworkPolicyListItem>;

      // Extract data and create defensive copies
      if (page.network_policies && Array.isArray(page.network_policies)) {
        page.network_policies.forEach((p: NetworkPolicyListItem) => {
          pagePolicies.push({
            id: p.id,
            name: p.name,
            description: p.description,
            create_time_ms: p.create_time_ms,
            update_time_ms: p.update_time_ms,
            egress: {
              allow_all: p.egress.allow_all,
              allow_devbox_to_devbox: p.egress.allow_devbox_to_devbox,
              allowed_hostnames: [...(p.egress.allowed_hostnames || [])],
            },
          });
        });
      }

      const result = {
        items: pagePolicies,
        hasMore: page.has_more || false,
        totalCount: page.total_count || pagePolicies.length,
      };

      return result;
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: policies,
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
    getItemId: (policy: NetworkPolicyListItem) => policy.id,
    pollInterval: 5000,
    pollingEnabled:
      !showPopup &&
      !executingOperation &&
      !showCreatePolicy &&
      !showEditPolicy &&
      !showDeleteConfirm &&
      !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

  // Operations for a specific network policy (shown in popup)
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
        label: "Edit Network Policy",
        color: colors.warning,
        icon: figures.pointer,
      },
      {
        key: "delete",
        label: "Delete Network Policy",
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
        (policy: NetworkPolicyListItem) => policy.id,
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
        (policy: NetworkPolicyListItem) => policy.name || "",
        {
          width: nameWidth,
        },
      ),
      ...(showDescription
        ? [
            createTextColumn(
              "description",
              "Description",
              (policy: NetworkPolicyListItem) => policy.description || "",
              {
                width: descriptionWidth,
                color: colors.textDim,
                dimColor: false,
                bold: false,
              },
            ),
          ]
        : []),
      {
        key: "egress",
        label: "Egress",
        width: egressWidth,
        render: (
          policy: NetworkPolicyListItem,
          _index: number,
          isSelected: boolean,
        ) => {
          const label = getEgressTypeLabel(policy.egress);
          const color = getEgressTypeColor(policy.egress);
          const safeWidth = Math.max(1, egressWidth);
          const truncated = label.slice(0, safeWidth);
          const padded = truncated.padEnd(safeWidth, " ");
          return (
            <Text
              color={isSelected ? "white" : color}
              bold={true}
              dimColor={false}
              inverse={isSelected}
              wrap="truncate"
            >
              {padded}
            </Text>
          );
        },
      },
      createTextColumn(
        "created",
        "Created",
        (policy: NetworkPolicyListItem) =>
          policy.create_time_ms ? formatTimeAgo(policy.create_time_ms) : "",
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
      descriptionWidth,
      egressWidth,
      timeWidth,
      showDescription,
    ],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (policies.length > 0 && selectedIndex >= policies.length) {
      setSelectedIndex(Math.max(0, policies.length - 1));
    }
  }, [policies.length, selectedIndex]);

  const selectedPolicyItem = policies[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + policies.length;

  const executeOperation = async (
    policy: NetworkPolicyListItem,
    operationKey: string,
  ) => {
    const client = getClient();

    if (!policy) return;

    try {
      setOperationLoading(true);
      switch (operationKey) {
        case "delete":
          await client.networkPolicies.delete(policy.id);
          setOperationResult(
            `Network policy "${policy.name}" deleted successfully`,
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
        setSelectedPolicy(null);
        // Refresh the list after delete to show updated data
        if (wasDelete && !hadError) {
          setTimeout(() => refresh(), 0);
        }
      }
      return;
    }

    // Handle create policy screen
    if (showCreatePolicy) {
      return;
    }

    // Handle edit policy screen
    if (showEditPolicy) {
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
          setShowCreatePolicy(true);
        } else if (operationKey === "view_details") {
          navigate("network-policy-detail", {
            networkPolicyId: selectedPolicyItem.id,
          });
        } else if (operationKey === "edit") {
          // Show edit form
          setEditingPolicy(selectedPolicyItem);
          setShowEditPolicy(true);
        } else if (operationKey === "delete") {
          // Show delete confirmation
          setSelectedPolicy(selectedPolicyItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedPolicy(selectedPolicyItem);
          setExecutingOperation(operationKey);
          // Execute immediately with values passed directly
          executeOperation(selectedPolicyItem, operationKey);
        }
      } else if (input === "c") {
        // Create hotkey
        setShowPopup(false);
        setShowCreatePolicy(true);
      } else if (input === "v" && selectedPolicyItem) {
        // View details hotkey
        setShowPopup(false);
        navigate("network-policy-detail", {
          networkPolicyId: selectedPolicyItem.id,
        });
      } else if (input === "e" && selectedPolicyItem) {
        // Edit hotkey
        setShowPopup(false);
        setEditingPolicy(selectedPolicyItem);
        setShowEditPolicy(true);
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "d") {
        // Delete hotkey - show confirmation
        setShowPopup(false);
        setSelectedPolicy(selectedPolicyItem);
        setShowDeleteConfirm(true);
      }
      return;
    }

    const pagePolicies = policies.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pagePolicies - 1) {
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
    } else if (key.return && selectedPolicyItem) {
      // Enter key navigates to detail view
      navigate("network-policy-detail", {
        networkPolicyId: selectedPolicyItem.id,
      });
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      // Create shortcut
      setShowCreatePolicy(true);
    } else if (input === "e" && selectedPolicyItem) {
      // Edit shortcut
      setEditingPolicy(selectedPolicyItem);
      setShowEditPolicy(true);
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
  if (showDeleteConfirm && selectedPolicy) {
    return (
      <ConfirmationPrompt
        title="Delete Network Policy"
        message={`Are you sure you want to delete "${selectedPolicy.name}"?`}
        details="This action cannot be undone. Any devboxes using this policy will lose their network restrictions."
        breadcrumbItems={[
          { label: "Network Policies" },
          { label: selectedPolicy.name || selectedPolicy.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedPolicy, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedPolicy(null);
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
            { label: "Network Policies" },
            {
              label: selectedPolicy?.name || selectedPolicy?.id || "Policy",
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
  if (operationLoading && selectedPolicy) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting network policy...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: selectedPolicy.name || selectedPolicy.id },
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

  // Create policy screen
  if (showCreatePolicy) {
    return (
      <NetworkPolicyCreatePage
        onBack={() => setShowCreatePolicy(false)}
        onCreate={(policy) => {
          setShowCreatePolicy(false);
          navigate("network-policy-detail", { networkPolicyId: policy.id });
        }}
      />
    );
  }

  // Edit policy screen
  if (showEditPolicy && editingPolicy) {
    return (
      <NetworkPolicyCreatePage
        onBack={() => {
          setShowEditPolicy(false);
          setEditingPolicy(null);
        }}
        onCreate={() => {
          setShowEditPolicy(false);
          setEditingPolicy(null);
          // Refresh the list to show updated data
          setTimeout(() => refresh(), 0);
        }}
        initialPolicy={editingPolicy}
      />
    );
  }

  // Loading state
  if (loading && policies.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Network Policies", active: true }]} />
        <SpinnerComponent message="Loading network policies..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Network Policies", active: true }]} />
        <ErrorMessage message="Failed to list network policies" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Network Policies", active: true }]} />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search network policies..."
      />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={policies}
          keyExtractor={(policy: NetworkPolicyListItem) => policy.id}
          selectedIndex={selectedIndex}
          title={`network_policies[${totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No network policies found. Press [c] to create one.
            </Text>
          }
        />
      )}

      {/* Statistics Bar - hide when popup is shown */}
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
      {showPopup && selectedPolicyItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedPolicyItem}
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
export { ListNetworkPoliciesUI };

export async function listNetworkPolicies(options: ListOptions = {}) {
  try {
    const client = getClient();

    // Build query params
    const queryParams: Record<string, unknown> = {
      limit: DEFAULT_PAGE_SIZE,
    };
    if (options.name) {
      queryParams.name = options.name;
    }

    // Fetch network policies
    const page = (await client.networkPolicies.list(
      queryParams,
    )) as NetworkPoliciesCursorIDPage<{ id: string }>;

    // Extract network policies array
    const networkPolicies = page.network_policies || [];

    output(networkPolicies, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list network policies", error);
  }
}
