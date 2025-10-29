/**
 * DevboxListScreen - Pure UI component using devboxStore
 * Refactored from commands/devbox/list.tsx to remove heavy state
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { Devbox, useDevboxStore } from "../store/devboxStore.js";
import { useNavigation } from "../store/navigationStore.js";
import { listDevboxes } from "../services/devboxService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { getStatusDisplay } from "../components/StatusBadge.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { Table, createTextColumn } from "../components/Table.js";
import { formatTimeAgo } from "../components/ResourceListView.js";
import { ActionsPopup } from "../components/ActionsPopup.js";
import { getDevboxUrl } from "../utils/url.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { colors, sanitizeWidth } from "../utils/theme.js";
import type { SSHSessionConfig } from "../utils/sshSession.js";

interface DevboxListScreenProps {
  onSSHRequest?: (config: SSHSessionConfig) => void;
}

export function DevboxListScreen({ onSSHRequest }: DevboxListScreenProps) {
  // Get state from store
  const devboxes = useDevboxStore((state) => state.devboxes);
  const loading = useDevboxStore((state) => state.loading);
  const initialLoading = useDevboxStore((state) => state.initialLoading);
  const error = useDevboxStore((state) => state.error);
  const currentPage = useDevboxStore((state) => state.currentPage);
  const pageSize = useDevboxStore((state) => state.pageSize);
  const totalCount = useDevboxStore((state) => state.totalCount);
  const selectedIndex = useDevboxStore((state) => state.selectedIndex);
  const searchQuery = useDevboxStore((state) => state.searchQuery);
  const statusFilter = useDevboxStore((state) => state.statusFilter);

  // Get store actions
  const setDevboxes = useDevboxStore((state) => state.setDevboxes);
  const setLoading = useDevboxStore((state) => state.setLoading);
  const setInitialLoading = useDevboxStore((state) => state.setInitialLoading);
  const setError = useDevboxStore((state) => state.setError);
  const setCurrentPage = useDevboxStore((state) => state.setCurrentPage);
  const setPageSize = useDevboxStore((state) => state.setPageSize);
  const setTotalCount = useDevboxStore((state) => state.setTotalCount);
  const setHasMore = useDevboxStore((state) => state.setHasMore);
  const setSelectedIndex = useDevboxStore((state) => state.setSelectedIndex);
  const setSearchQuery = useDevboxStore((state) => state.setSearchQuery);
  const getCachedPage = useDevboxStore((state) => state.getCachedPage);
  const cachePageData = useDevboxStore((state) => state.cachePageData);
  const clearCache = useDevboxStore((state) => state.clearCache);

  // Navigation
  const { push, goBack } = useNavigation();

  // Local UI state only
  const [searchMode, setSearchMode] = React.useState(false);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const isNavigating = React.useRef(false);

  // Calculate viewport
  const overhead = 13 + (searchMode || searchQuery ? 2 : 0);
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  // Update page size based on viewport
  React.useEffect(() => {
    if (viewportHeight !== pageSize) {
      setPageSize(viewportHeight);
    }
  }, [viewportHeight, pageSize, setPageSize]);

  // Fetch data from service
  React.useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      // Check cache first
      const cached = getCachedPage(currentPage);
      if (cached && !initialLoading) {
        if (!abortController.signal.aborted) {
          setDevboxes(cached);
        }
        return;
      }

      try {
        if (!isNavigating.current) {
          setLoading(true);
        }

        // Get starting_after from previous page
        const lastIdCache = useDevboxStore.getState().lastIdCache;
        const startingAfter =
          currentPage > 0 ? lastIdCache.get(currentPage - 1) : undefined;

        const result = await listDevboxes({
          limit: pageSize,
          startingAfter,
          status: statusFilter,
          search: searchQuery || undefined,
          signal: abortController.signal,
        });

        // Don't update state if aborted
        if (abortController.signal.aborted) return;

        setDevboxes(result.devboxes);
        setTotalCount(result.totalCount);
        setHasMore(result.hasMore);

        // Cache the result
        if (result.devboxes.length > 0) {
          const lastId = result.devboxes[result.devboxes.length - 1].id;
          cachePageData(currentPage, result.devboxes, lastId);
        }

        if (initialLoading) {
          setInitialLoading(false);
        }
      } catch (err) {
        // Ignore abort errors
        if ((err as Error).name === "AbortError") {
          return;
        }
        if (!abortController.signal.aborted) {
          setError(err as Error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
          isNavigating.current = false;
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [currentPage, pageSize, statusFilter, searchQuery]);

  // Clear cache when search changes
  React.useEffect(() => {
    clearCache();
    setCurrentPage(0);
    setSelectedIndex(0);
  }, [searchQuery]);

  // Column layout calculations
  // CRITICAL: Sanitize terminalWidth IMMEDIATELY to prevent negative calculations during transitions
  // During transitions, terminalWidth can be 0, causing subtractions to produce negatives that crash Yoga WASM
  const safeTerminalWidth = sanitizeWidth(
    Number.isFinite(terminalWidth) && terminalWidth >= 80 ? terminalWidth : 120,
    80,
    500,
  );

  const fixedWidth = 4;
  const statusIconWidth = 2;
  const statusTextWidth = sanitizeWidth(10, 1, 100);
  const timeWidth = sanitizeWidth(20, 1, 100);
  const capabilitiesWidth = sanitizeWidth(18, 1, 100);
  const sourceWidth = sanitizeWidth(26, 1, 100);
  const idWidth = sanitizeWidth(26, 1, 100);

  const showCapabilities = safeTerminalWidth >= 140;
  const showSource = safeTerminalWidth >= 120;

  const ABSOLUTE_MAX_NAME_WIDTH = 80;

  // CRITICAL: Guard ALL subtractions with Math.max to ensure remainingWidth is never negative
  // This prevents Yoga WASM crashes when terminalWidth is invalid during transitions
  let nameWidth = 15;
  if (safeTerminalWidth >= 120) {
    const remainingWidth = Math.max(
      15, // Minimum safe value
      safeTerminalWidth -
        fixedWidth -
        statusIconWidth -
        idWidth -
        statusTextWidth -
        timeWidth -
        capabilitiesWidth -
        sourceWidth -
        12,
    );
    nameWidth = sanitizeWidth(
      Math.min(ABSOLUTE_MAX_NAME_WIDTH, remainingWidth),
      15,
      ABSOLUTE_MAX_NAME_WIDTH,
    );
  } else if (safeTerminalWidth >= 110) {
    const remainingWidth = Math.max(
      12, // Minimum safe value
      safeTerminalWidth -
        fixedWidth -
        statusIconWidth -
        idWidth -
        statusTextWidth -
        timeWidth -
        sourceWidth -
        10,
    );
    nameWidth = sanitizeWidth(
      Math.min(ABSOLUTE_MAX_NAME_WIDTH, remainingWidth),
      12,
      ABSOLUTE_MAX_NAME_WIDTH,
    );
  } else {
    const remainingWidth = Math.max(
      8, // Minimum safe value
      safeTerminalWidth -
        fixedWidth -
        statusIconWidth -
        idWidth -
        statusTextWidth -
        timeWidth -
        10,
    );
    nameWidth = sanitizeWidth(
      Math.min(ABSOLUTE_MAX_NAME_WIDTH, remainingWidth),
      8,
      ABSOLUTE_MAX_NAME_WIDTH,
    );
  }

  // Build table columns
  const ABSOLUTE_MAX_NAME = 80;
  const ABSOLUTE_MAX_ID = 50;

  const columns = [
    createTextColumn(
      "name",
      "Name",
      (devbox: any) => {
        const name = String(devbox?.name || devbox?.id || "");
        const safeMax = Math.min(nameWidth || 15, ABSOLUTE_MAX_NAME);
        return name.length > safeMax
          ? name.substring(0, Math.max(1, safeMax - 3)) + "..."
          : name;
      },
      {
        width: sanitizeWidth(
          Math.min(nameWidth || 15, ABSOLUTE_MAX_NAME),
          15,
          ABSOLUTE_MAX_NAME,
        ),
        dimColor: false,
      },
    ),
    createTextColumn(
      "id",
      "ID",
      (devbox: any) => {
        const id = String(devbox?.id || "");
        const safeMax = Math.min(idWidth || 26, ABSOLUTE_MAX_ID);
        return id.length > safeMax
          ? id.substring(0, Math.max(1, safeMax - 3)) + "..."
          : id;
      },
      {
        width: sanitizeWidth(
          Math.min(idWidth || 26, ABSOLUTE_MAX_ID),
          1,
          ABSOLUTE_MAX_ID,
        ),
        color: colors.textDim,
        dimColor: false,
        bold: false,
      },
    ),
    createTextColumn(
      "status",
      "Status",
      (devbox: any) => {
        const statusDisplay = getStatusDisplay(devbox?.status);
        const text = String(statusDisplay?.text || "-");
        return text.length > 20 ? text.substring(0, 17) + "..." : text;
      },
      {
        width: sanitizeWidth(statusTextWidth, 1, 100),
        dimColor: false,
      },
    ),
    createTextColumn(
      "created",
      "Created",
      (devbox: any) => {
        const time = formatTimeAgo(devbox?.create_time_ms || Date.now());
        const text = String(time || "-");
        return text.length > 25 ? text.substring(0, 22) + "..." : text;
      },
      {
        width: sanitizeWidth(timeWidth, 1, 100),
        color: colors.textDim,
        dimColor: false,
      },
    ),
  ];

  if (showSource) {
    columns.push(
      createTextColumn(
        "source",
        "Source",
        (devbox: any) => {
          if (devbox?.blueprint_id) {
            const bpId = String(devbox.blueprint_id);
            const truncated = bpId.slice(0, 10);
            const text = `blueprint:${truncated}`;
            return text.length > 30 ? text.substring(0, 27) + "..." : text;
          }
          return "-";
        },
        {
          width: sanitizeWidth(sourceWidth, 1, 100),
          color: colors.textDim,
          dimColor: false,
        },
      ),
    );
  }

  if (showCapabilities) {
    columns.push(
      createTextColumn(
        "capabilities",
        "Capabilities",
        (devbox: any) => {
          const caps = [];
          if (devbox?.entitlements?.network_enabled) caps.push("net");
          if (devbox?.entitlements?.gpu_enabled) caps.push("gpu");
          const text = caps.length > 0 ? caps.join(",") : "-";
          return text.length > 20 ? text.substring(0, 17) + "..." : text;
        },
        {
          width: sanitizeWidth(capabilitiesWidth, 1, 100),
          color: colors.textDim,
          dimColor: false,
        },
      ),
    );
  }

  const tableColumns = columns;

  // Define operations
  const allOperations = [
    {
      key: "logs",
      label: "View Logs",
      color: colors.info,
      icon: figures.info,
      shortcut: "l",
    },
    {
      key: "exec",
      label: "Execute Command",
      color: colors.primary,
      icon: figures.play,
      shortcut: "e",
    },
    {
      key: "ssh",
      label: "SSH",
      color: colors.accent1,
      icon: figures.arrowRight,
      shortcut: "s",
    },
    {
      key: "suspend",
      label: "Suspend",
      color: colors.warning,
      icon: figures.circleFilled,
      shortcut: "p",
    },
    {
      key: "resume",
      label: "Resume",
      color: colors.success,
      icon: figures.play,
      shortcut: "r",
    },
    {
      key: "delete",
      label: "Delete",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Input handling
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      process.exit(130);
    }

    const pageDevboxes = devboxes.length;

    // Search mode
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery("");
      }
      return;
    }

    // Actions popup
    if (showPopup) {
      if (key.escape) {
        setShowPopup(false);
      } else if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (
        key.downArrow &&
        selectedOperation < allOperations.length - 1
      ) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        const operation = allOperations[selectedOperation];
        setShowPopup(false);
        push("devbox-actions", {
          devboxId: devboxes[selectedIndex]?.id,
          operation: operation.key,
        });
      } else if (input) {
        const matchedOpIndex = allOperations.findIndex(
          (op) => op.shortcut === input,
        );
        if (matchedOpIndex !== -1) {
          const operation = allOperations[matchedOpIndex];
          setShowPopup(false);
          push("devbox-actions", {
            devboxId: devboxes[selectedIndex]?.id,
            operation: operation.key,
          });
        }
      }
      return;
    }

    // List navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageDevboxes - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      (input === "n" || key.rightArrow) &&
      !isNavigating.current &&
      currentPage < Math.ceil(totalCount / pageSize) - 1
    ) {
      isNavigating.current = true;
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if (
      (input === "p" || key.leftArrow) &&
      !isNavigating.current &&
      currentPage > 0
    ) {
      isNavigating.current = true;
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (key.return) {
      push("devbox-detail", { devboxId: devboxes[selectedIndex]?.id });
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      push("devbox-create", {});
    } else if (input === "o" && devboxes[selectedIndex]) {
      const url = getDevboxUrl(devboxes[selectedIndex].id);
      const openBrowser = async () => {
        const { exec } = await import("child_process");
        exec(`open "${url}"`);
      };
      openBrowser();
    } else if (input === "/" || input === "f") {
      setSearchMode(true);
    } else if (key.escape || input === "q") {
      goBack();
    }
  });

  const selectedDevbox = devboxes[selectedIndex];
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = startIndex + devboxes.length;

  // Render states
  if (initialLoading && !devboxes.length) {
    return (
      <>
        <Breadcrumb items={[{ label: "Devboxes", active: true }]} />
        <SpinnerComponent message="Loading..." />
      </>
    );
  }

  if (error && !devboxes.length) {
    return (
      <>
        <Breadcrumb items={[{ label: "Devboxes", active: true }]} />
        <ErrorMessage message="Failed to list devboxes" error={error} />
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Devboxes", active: true }]} />

      {searchMode && (
        <Box marginBottom={1} paddingX={1}>
          <Text color={colors.primary} bold>
            🔍 Search:{" "}
          </Text>
          <TextInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Type to search..."
          />
        </Box>
      )}

      {searchQuery && !searchMode && (
        <Box marginBottom={1} paddingX={1}>
          <Text color={colors.primary} bold>
            🔍 Search:{" "}
          </Text>
          <Text color={colors.warning} bold>
            {searchQuery.length > 50
              ? searchQuery.substring(0, 50) + "..."
              : searchQuery}
          </Text>
          <Text color={colors.textDim}> [/ to change, Esc to clear]</Text>
        </Box>
      )}

      {!showPopup && (
        <Box>
          <Table
            data={devboxes}
            columns={tableColumns}
            keyExtractor={(devbox: Devbox) => devbox.id}
            selectedIndex={selectedIndex}
          />
        </Box>
      )}

      {showPopup && selectedDevbox && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedDevbox}
            operations={allOperations}
            selectedOperation={selectedOperation}
            onClose={() => setShowPopup(false)}
          />
        </Box>
      )}

      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.primary} bold>
            {figures.hamburger} {totalCount}
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            • Page {currentPage + 1}/{totalPages || 1}
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            ({startIndex + 1}-{endIndex})
          </Text>
        </Box>
      )}

      <Box marginTop={1} paddingX={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate
        </Text>
        {totalPages > 1 && (
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
          • [a] Actions
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [c] Create
        </Text>
        {selectedDevbox && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • [o] Open in Browser
          </Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          • [/] Search
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [Esc] Back
        </Text>
      </Box>
    </>
  );
}
