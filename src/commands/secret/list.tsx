import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
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
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

interface ListOptions {
  limit?: string;
  output?: string;
}

// Local interface for secret data used in this component
interface SecretListItem {
  id: string;
  name: string;
  create_time_ms?: number;
  update_time_ms?: number;
}

const DEFAULT_PAGE_SIZE = 10;

const ListSecretsUI = ({
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
  const [selectedSecret, setSelectedSecret] =
    React.useState<SecretListItem | null>(null);
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
  const idWidth = 30;
  const timeWidth = 20;

  // Name width uses remaining space after fixed columns
  const baseWidth = fixedWidth + idWidth + timeWidth;
  const remainingWidth = terminalWidth - baseWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageSecrets: SecretListItem[] = [];

      // Secrets API doesn't support cursor pagination, fetch all and paginate client-side
      const result = await client.secrets.list({ limit: 5000 });

      // Extract data and filter by search if needed
      if (result.secrets && Array.isArray(result.secrets)) {
        let filtered = result.secrets;

        // Client-side search filtering
        if (search.submittedSearchQuery) {
          const query = search.submittedSearchQuery.toLowerCase();
          filtered = filtered.filter(
            (s: SecretListItem) =>
              s.name?.toLowerCase().includes(query) ||
              s.id?.toLowerCase().includes(query),
          );
        }

        // Client-side pagination
        const startIdx = params.startingAt
          ? filtered.findIndex(
              (s: SecretListItem) => s.id === params.startingAt,
            ) + 1
          : 0;
        const pageItems = filtered.slice(startIdx, startIdx + params.limit);

        pageItems.forEach((s: SecretListItem) => {
          pageSecrets.push({
            id: s.id,
            name: s.name,
            create_time_ms: s.create_time_ms,
            update_time_ms: s.update_time_ms,
          });
        });

        return {
          items: pageSecrets,
          hasMore: startIdx + params.limit < filtered.length,
          totalCount: filtered.length,
        };
      }

      return {
        items: pageSecrets,
        hasMore: false,
        totalCount: 0,
      };
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: secrets,
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
    getItemId: (secret: SecretListItem) => secret.id,
    pollInterval: 10000,
    pollingEnabled:
      !showPopup &&
      !executingOperation &&
      !showDeleteConfirm &&
      !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

  // Operations for a specific secret (shown in popup)
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
        label: "Delete Secret",
        color: colors.error,
        icon: figures.cross,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (secret: SecretListItem) => secret.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn(
        "name",
        "Name",
        (secret: SecretListItem) => secret.name || "",
        {
          width: nameWidth,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (secret: SecretListItem) =>
          secret.create_time_ms ? formatTimeAgo(secret.create_time_ms) : "-",
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

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (secrets.length > 0 && selectedIndex >= secrets.length) {
      setSelectedIndex(Math.max(0, secrets.length - 1));
    }
  }, [secrets.length, selectedIndex]);

  const selectedSecretItem = secrets[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + secrets.length;

  const executeOperation = async (
    secret: SecretListItem,
    operationKey: string,
  ) => {
    const client = getClient();

    if (!secret) return;

    try {
      setOperationLoading(true);
      switch (operationKey) {
        case "delete":
          await client.secrets.delete(secret.name);
          setOperationResult(`Secret "${secret.name}" deleted successfully`);
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
        setSelectedSecret(null);
        // Refresh the list after delete to show updated data
        if (wasDelete && !hadError) {
          setTimeout(() => refresh(), 0);
        }
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
          navigate("secret-detail", {
            secretId: selectedSecretItem.id,
          });
        } else if (operationKey === "delete") {
          // Show delete confirmation
          setSelectedSecret(selectedSecretItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedSecret(selectedSecretItem);
          setExecutingOperation(operationKey);
          // Execute immediately with values passed directly
          executeOperation(selectedSecretItem, operationKey);
        }
      } else if (input === "c") {
        // Create hotkey
        setShowPopup(false);
        navigate("secret-create");
      } else if (input === "v" && selectedSecretItem) {
        // View details hotkey
        setShowPopup(false);
        navigate("secret-detail", {
          secretId: selectedSecretItem.id,
        });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "d") {
        // Delete hotkey - show confirmation
        setShowPopup(false);
        setSelectedSecret(selectedSecretItem);
        setShowDeleteConfirm(true);
      }
      return;
    }

    const pageSecrets = secrets.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageSecrets - 1) {
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
    } else if (key.return && selectedSecretItem) {
      // Enter key navigates to detail view
      navigate("secret-detail", {
        secretId: selectedSecretItem.id,
      });
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      // Create shortcut
      navigate("secret-create");
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
  if (showDeleteConfirm && selectedSecret) {
    return (
      <ConfirmationPrompt
        title="Delete Secret"
        message={`Are you sure you want to delete "${selectedSecret.name}"?`}
        details="This action cannot be undone. Any devboxes using this secret will no longer have access to it."
        breadcrumbItems={[
          { label: "Settings" },
          { label: "Secrets" },
          { label: selectedSecret.name || selectedSecret.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedSecret, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedSecret(null);
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
            { label: "Settings" },
            { label: "Secrets" },
            {
              label: selectedSecret?.name || selectedSecret?.id || "Secret",
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
  if (operationLoading && selectedSecret) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting secret...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: selectedSecret.name || selectedSecret.id },
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

  // Loading state
  if (loading && secrets.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Settings" }, { label: "Secrets", active: true }]}
        />
        <SpinnerComponent message="Loading secrets..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Settings" }, { label: "Secrets", active: true }]}
        />
        <ErrorMessage message="Failed to list secrets" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb
        items={[{ label: "Settings" }, { label: "Secrets", active: true }]}
      />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search secrets..."
      />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={secrets}
          keyExtractor={(secret: SecretListItem) => secret.id}
          selectedIndex={selectedIndex}
          title={`secrets[${totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No secrets found. Press [c] to create one.
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
      {showPopup && selectedSecretItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedSecretItem}
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
          { key: "a", label: "Actions" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
};

// Export the UI component for use in the main menu
export { ListSecretsUI };

export async function listSecrets(options: ListOptions = {}) {
  try {
    const client = getClient();

    const limit = options.limit
      ? parseInt(options.limit, 10)
      : DEFAULT_PAGE_SIZE;

    // Fetch secrets
    const result = await client.secrets.list({ limit });

    // Extract secrets array
    const secrets = result.secrets || [];

    // Default: output JSON for lists
    output(secrets, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list secrets", error);
  }
}
