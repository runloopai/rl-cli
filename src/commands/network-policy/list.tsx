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
import { Table, createTextColumn } from "../../components/Table.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { Operation } from "../../components/OperationsMenu.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { output, outputError } from "../../utils/output.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useNavigation } from "../../store/navigationStore.js";
import { NetworkPolicyCreatePage } from "../../components/NetworkPolicyCreatePage.js";

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

  // Calculate overhead for viewport height
  const overhead = 13;
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // All width constants
  const idWidth = 25;
  const nameWidth = Math.max(15, terminalWidth >= 120 ? 30 : 20);
  const descriptionWidth = Math.max(20, terminalWidth >= 140 ? 40 : 25);
  const egressWidth = 15;
  const timeWidth = 15;
  const showDescription = terminalWidth >= 100;

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
    [],
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
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (policy: NetworkPolicyListItem) => policy.id,
    pollInterval: 5000,
    pollingEnabled: !showPopup && !executingOperation && !showCreatePolicy,
    deps: [PAGE_SIZE],
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

  const executeOperation = async (policy: NetworkPolicyListItem, operationKey: string) => {
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
    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setSelectedPolicy(null);
      }
      return;
    }

    // Handle create policy screen
    if (showCreatePolicy) {
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
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "d") {
        // Delete hotkey
        setShowPopup(false);
        setSelectedPolicy(selectedPolicyItem);
        setExecutingOperation("delete");
        // Execute immediately with values passed directly
        executeOperation(selectedPolicyItem, "delete");
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
    } else if (key.escape) {
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
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter], [q], or [esc] to continue
          </Text>
        </Box>
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
      <Box marginTop={1} paddingX={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate
        </Text>
        {(hasMore || hasPrev) && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • {figures.arrowLeft}
            {figures.arrowRight} Page
          </Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          • [Enter] Details
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [c] Create
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [a] Actions
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [Esc] Back
        </Text>
      </Box>
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
