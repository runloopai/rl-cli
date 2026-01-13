import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { Header } from "./Header.js";
import { StatusBadge } from "./StatusBadge.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { DevboxActionsMenu } from "./DevboxActionsMenu.js";
import { StateHistory } from "./StateHistory.js";
import { getDevboxUrl } from "../utils/url.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { getDevbox } from "../services/devboxService.js";
import type { Devbox } from "../store/devboxStore.js";

interface DevboxDetailPageProps {
  devbox: Devbox;
  onBack: () => void;
}

// Format time ago in a succinct way
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

// Truncate long strings to prevent layout issues
const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
};

export const DevboxDetailPage = ({
  devbox: initialDevbox,
  onBack,
}: DevboxDetailPageProps) => {
  const isMounted = React.useRef(true);

  // Track mounted state
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Local state for devbox data (updated by polling)
  const [currentDevbox, setCurrentDevbox] = React.useState(initialDevbox);

  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);
  const [detailScroll, setDetailScroll] = React.useState(0);
  const [showActions, setShowActions] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);

  // Background polling for devbox details
  React.useEffect(() => {
    // Skip polling if showing actions, detailed info, or not mounted
    if (showActions || showDetailedInfo) return;

    const interval = setInterval(async () => {
      // Only poll when not in actions/detail mode and component is mounted
      if (!showActions && !showDetailedInfo && isMounted.current) {
        try {
          const updatedDevbox = await getDevbox(initialDevbox.id);

          // Only update if still mounted
          if (isMounted.current) {
            setCurrentDevbox(updatedDevbox);
          }
        } catch {
          // Silently ignore polling errors to avoid disrupting user experience
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [initialDevbox.id, showActions, showDetailedInfo]);

  // Calculate viewport for detailed info view:
  // - Breadcrumb (3 lines + marginBottom): 4 lines
  // - Header (title + underline + marginBottom): 3 lines
  // - Status box (content + marginBottom): 2 lines
  // - Content box (marginTop + border + paddingY top/bottom + border + marginBottom): 6 lines
  // - Help bar (marginTop + content): 2 lines
  // - Safety buffer: 1 line
  // Total: 18 lines
  const detailViewport = useViewportHeight({ overhead: 18, minHeight: 10 });

  const selectedDevbox = currentDevbox;

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
      color: colors.success,
      icon: figures.play,
      shortcut: "e",
    },
    {
      key: "upload",
      label: "Upload File",
      color: colors.success,
      icon: figures.arrowUp,
      shortcut: "u",
    },
    {
      key: "snapshot",
      label: "Create Snapshot",
      color: colors.warning,
      icon: figures.circleFilled,
      shortcut: "n",
    },
    {
      key: "ssh",
      label: "SSH onto the box",
      color: colors.primary,
      icon: figures.arrowRight,
      shortcut: "s",
    },
    {
      key: "tunnel",
      label: "Open Tunnel",
      color: colors.secondary,
      icon: figures.pointerSmall,
      shortcut: "t",
    },
    {
      key: "suspend",
      label: "Suspend Devbox",
      color: colors.warning,
      icon: figures.squareSmallFilled,
      shortcut: "p",
    },
    {
      key: "resume",
      label: "Resume Devbox",
      color: colors.success,
      icon: figures.play,
      shortcut: "r",
    },
    {
      key: "delete",
      label: "Shutdown Devbox",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Filter operations based on devbox status
  const operations = selectedDevbox
    ? allOperations.filter((op) => {
        const status = selectedDevbox.status;

        // When suspended: logs and resume
        if (status === "suspended") {
          return op.key === "resume" || op.key === "logs";
        }

        // When not running (shutdown, failure, etc): only logs
        if (
          status !== "running" &&
          status !== "provisioning" &&
          status !== "initializing"
        ) {
          return op.key === "logs";
        }

        // When running: everything except resume
        if (status === "running") {
          return op.key !== "resume";
        }

        // Default for transitional states (provisioning, initializing)
        return op.key === "logs" || op.key === "delete";
      })
    : allOperations;

  const formattedCreateTime = selectedDevbox.create_time_ms
    ? new Date(selectedDevbox.create_time_ms).toLocaleString()
    : "";

  const createTimeAgo = selectedDevbox.create_time_ms
    ? formatTimeAgo(selectedDevbox.create_time_ms)
    : "";

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  useInput((input, key) => {
    // Don't process input if unmounting
    if (!isMounted.current) return;

    // Skip input handling when in actions view
    if (showActions) {
      return;
    }

    // Handle detailed info mode
    if (showDetailedInfo) {
      if (input === "q" || key.escape) {
        setShowDetailedInfo(false);
        setDetailScroll(0);
      } else if (input === "j" || input === "s" || key.downArrow) {
        // Scroll down in detailed info
        setDetailScroll(detailScroll + 1);
      } else if (input === "k" || input === "w" || key.upArrow) {
        // Scroll up in detailed info
        setDetailScroll(Math.max(0, detailScroll - 1));
      } else if (key.pageDown) {
        // Page down
        setDetailScroll(detailScroll + 10);
      } else if (key.pageUp) {
        // Page up
        setDetailScroll(Math.max(0, detailScroll - 10));
      }
      return;
    }

    // Main view input handling
    if (input === "q" || key.escape) {
      onBack();
    } else if (input === "i") {
      setShowDetailedInfo(true);
      setDetailScroll(0);
    } else if (key.upArrow && selectedOperation > 0) {
      setSelectedOperation(selectedOperation - 1);
    } else if (key.downArrow && selectedOperation < operations.length - 1) {
      setSelectedOperation(selectedOperation + 1);
    } else if (key.return || input === "a") {
      setShowActions(true);
    } else if (input) {
      // Check if input matches any operation shortcut
      const matchedOpIndex = operations.findIndex(
        (op) => op.shortcut === input,
      );
      if (matchedOpIndex !== -1) {
        setSelectedOperation(matchedOpIndex);
        setShowActions(true);
      }
    }

    if (input === "o") {
      // Open in browser
      const url = getDevboxUrl(selectedDevbox.id);
      const openBrowser = async () => {
        const { exec } = await import("child_process");
        const platform = process.platform;

        let openCommand: string;
        if (platform === "darwin") {
          openCommand = `open "${url}"`;
        } else if (platform === "win32") {
          openCommand = `start "${url}"`;
        } else {
          openCommand = `xdg-open "${url}"`;
        }

        exec(openCommand);
      };
      openBrowser();
    }
  });

  const uptime = selectedDevbox.create_time_ms
    ? Math.floor((Date.now() - selectedDevbox.create_time_ms) / 1000 / 60)
    : null;

  // Build detailed info lines for scrolling
  const buildDetailLines = (): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    const capitalize = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1);

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Devbox Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {selectedDevbox.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {selectedDevbox.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-status" dimColor>
        {" "}
        Status: {capitalize(selectedDevbox.status)}
      </Text>,
    );
    if (selectedDevbox.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(selectedDevbox.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (selectedDevbox.end_time_ms) {
      lines.push(
        <Text key="core-ended" dimColor>
          {" "}
          Ended: {new Date(selectedDevbox.end_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Capabilities
    if (selectedDevbox.capabilities && selectedDevbox.capabilities.length > 0) {
      lines.push(
        <Text key="cap-title" color={colors.warning} bold>
          Capabilities
        </Text>,
      );
      selectedDevbox.capabilities.forEach((cap: string, idx: number) => {
        lines.push(
          <Text key={`cap-${idx}`} dimColor>
            {" "}
            {figures.pointer} {cap}
          </Text>,
        );
      });
      lines.push(<Text key="cap-space"> </Text>);
    }

    // Launch Parameters
    if (selectedDevbox.launch_parameters) {
      lines.push(
        <Text key="launch-title" color={colors.warning} bold>
          Launch Parameters
        </Text>,
      );

      const lp = selectedDevbox.launch_parameters;

      if (lp.resource_size_request) {
        lines.push(
          <Text key="launch-size-req" dimColor>
            {" "}
            Resource Size Request: {lp.resource_size_request}
          </Text>,
        );
      }
      if (lp.architecture) {
        lines.push(
          <Text key="launch-arch" dimColor>
            {" "}
            Architecture: {lp.architecture}
          </Text>,
        );
      }
      if (lp.custom_cpu_cores) {
        lines.push(
          <Text key="launch-cpu" dimColor>
            {" "}
            CPU Cores: {lp.custom_cpu_cores}
          </Text>,
        );
      }
      if (lp.custom_gb_memory) {
        lines.push(
          <Text key="launch-memory" dimColor>
            {" "}
            Memory: {lp.custom_gb_memory}GB
          </Text>,
        );
      }
      if (lp.custom_disk_size) {
        lines.push(
          <Text key="launch-disk" dimColor>
            {" "}
            Disk Size: {lp.custom_disk_size}GB
          </Text>,
        );
      }
      if (lp.keep_alive_time_seconds) {
        lines.push(
          <Text key="launch-keepalive" dimColor>
            {" "}
            Keep Alive: {lp.keep_alive_time_seconds}s (
            {Math.floor(lp.keep_alive_time_seconds / 60)}
            m)
          </Text>,
        );
      }
      if (lp.after_idle) {
        lines.push(
          <Text key="launch-afteridle" dimColor>
            {" "}
            After Idle: {lp.after_idle.on_idle} after{" "}
            {lp.after_idle.idle_time_seconds}s
          </Text>,
        );
      }
      if (lp.available_ports && lp.available_ports.length > 0) {
        lines.push(
          <Text key="launch-ports" dimColor>
            {" "}
            Available Ports: {lp.available_ports.join(", ")}
          </Text>,
        );
      }
      if (lp.launch_commands && lp.launch_commands.length > 0) {
        lines.push(
          <Text key="launch-launch-cmds" dimColor>
            {" "}
            Launch Commands:
          </Text>,
        );
        // lp.launch_commands.forEach((cmd: string, idx: number) => {
        //   lines.push(
        //     <Text key={`launch-cmd-${idx}`} dimColor>
        //       {" "}
        //       {figures.pointer} {cmd}
        //     </Text>,
        //   );
        // });
      }
      if (lp.required_services && lp.required_services.length > 0) {
        lines.push(
          <Text key="launch-services" dimColor>
            {" "}
            Required Services: {lp.required_services.join(", ")}
          </Text>,
        );
      }
      if (lp.user_parameters) {
        lines.push(
          <Text key="launch-user" dimColor>
            {" "}
            User Parameters:
          </Text>,
        );
        if (lp.user_parameters.username) {
          lines.push(
            <Text key="user-name" dimColor>
              {" "}
              Username: {lp.user_parameters.username}
            </Text>,
          );
        }
        if (lp.user_parameters.uid) {
          lines.push(
            <Text key="user-uid" dimColor>
              {" "}
              UID: {lp.user_parameters.uid}
            </Text>,
          );
        }
      }
      lines.push(<Text key="launch-space"> </Text>);
    }

    // Source
    if (selectedDevbox.blueprint_id || selectedDevbox.snapshot_id) {
      lines.push(
        <Text key="source-title" color={colors.warning} bold>
          Source
        </Text>,
      );
      if (selectedDevbox.blueprint_id) {
        lines.push(
          <Text key="source-bp" color={colors.idColor}>
            {" "}
            {selectedDevbox.blueprint_id}
          </Text>,
        );
      }
      if (selectedDevbox.snapshot_id) {
        lines.push(
          <Text key="source-snap" color={colors.idColor}>
            {" "}
            {selectedDevbox.snapshot_id}
          </Text>,
        );
      }
      lines.push(<Text key="source-space"> </Text>);
    }

    // Initiator
    if (selectedDevbox.initiator_type) {
      lines.push(
        <Text key="init-title" color={colors.warning} bold>
          Initiator
        </Text>,
      );
      lines.push(
        <Text key="init-type" dimColor>
          {" "}
          Type: {selectedDevbox.initiator_type}
        </Text>,
      );
      if (selectedDevbox.initiator_id) {
        lines.push(
          <Text key="init-id" color={colors.idColor}>
            {" "}
            ID: {selectedDevbox.initiator_id}
          </Text>,
        );
      }
      lines.push(<Text key="init-space"> </Text>);
    }

    // Status Details
    if (selectedDevbox.failure_reason || selectedDevbox.shutdown_reason) {
      lines.push(
        <Text key="status-title" color={colors.warning} bold>
          Status Details
        </Text>,
      );
      if (selectedDevbox.failure_reason) {
        lines.push(
          <Text key="status-fail" color={colors.error} dimColor>
            {" "}
            Failure Reason: {selectedDevbox.failure_reason}
          </Text>,
        );
      }
      if (selectedDevbox.shutdown_reason) {
        lines.push(
          <Text key="status-shut" dimColor>
            {" "}
            Shutdown Initiator: {selectedDevbox.shutdown_reason}
          </Text>,
        );
      }
      lines.push(<Text key="status-space"> </Text>);
    }

    // Metadata
    if (
      selectedDevbox.metadata &&
      Object.keys(selectedDevbox.metadata).length > 0
    ) {
      lines.push(
        <Text key="meta-title" color={colors.warning} bold>
          Metadata
        </Text>,
      );
      Object.entries(selectedDevbox.metadata).forEach(([key, value], idx) => {
        lines.push(
          <Text key={`meta-${idx}`} dimColor>
            {" "}
            {key}: {value as string}
          </Text>,
        );
      });
      lines.push(<Text key="meta-space"> </Text>);
    }

    // State Transitions
    if (
      selectedDevbox.state_transitions &&
      selectedDevbox.state_transitions.length > 0
    ) {
      lines.push(
        <Text key="state-title" color={colors.warning} bold>
          State History
        </Text>,
      );
      (
        selectedDevbox.state_transitions as Array<{
          status: string;
          transition_time_ms?: number;
        }>
      ).forEach((transition, idx: number) => {
        const text = `${idx + 1}. ${capitalize(transition.status)}${transition.transition_time_ms ? ` at ${new Date(transition.transition_time_ms).toLocaleString()}` : ""}`;
        lines.push(
          <Text key={`state-${idx}`} dimColor>
            {" "}
            {text}
          </Text>,
        );
      });
      lines.push(<Text key="state-space"> </Text>);
    }

    // Raw JSON (full)
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(selectedDevbox, null, 2).split("\n");
    jsonLines.forEach((line, idx) => {
      lines.push(
        <Text key={`json-${idx}`} dimColor>
          {" "}
          {line}
        </Text>,
      );
    });

    return lines;
  };

  // Actions view - show the DevboxActionsMenu when an action is triggered
  if (showActions) {
    const selectedOp = operations[selectedOperation];
    return (
      <DevboxActionsMenu
        devbox={selectedDevbox}
        onBack={() => {
          setShowActions(false);
          setSelectedOperation(0);
        }}
        breadcrumbItems={[
          { label: "Devboxes" },
          { label: selectedDevbox.name || selectedDevbox.id },
        ]}
        initialOperation={selectedOp?.key}
        skipOperationsMenu={true}
      />
    );
  }

  // Detailed info mode - full screen
  if (showDetailedInfo) {
    const detailLines = buildDetailLines();
    const viewportHeight = detailViewport.viewportHeight;
    const maxScroll = Math.max(0, detailLines.length - viewportHeight);
    const actualScroll = Math.min(detailScroll, maxScroll);
    const visibleLines = detailLines.slice(
      actualScroll,
      actualScroll + viewportHeight,
    );
    const hasMore = actualScroll + viewportHeight < detailLines.length;
    const hasLess = actualScroll > 0;

    return (
      <>
        <Breadcrumb
          items={[
            { label: "Devboxes" },
            { label: selectedDevbox.name || selectedDevbox.id },
            { label: "Full Details", active: true },
          ]}
        />
        <Header
          title={`${selectedDevbox.name || selectedDevbox.id} - Complete Information`}
        />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <StatusBadge status={selectedDevbox.status} />
            <Text> </Text>
            <Text color={colors.idColor}>{selectedDevbox.id}</Text>
          </Box>
        </Box>

        <Box
          flexDirection="column"
          marginTop={1}
          marginBottom={1}
          borderStyle="round"
          borderColor={colors.border}
          paddingX={2}
          paddingY={1}
        >
          <Box flexDirection="column">{visibleLines}</Box>
        </Box>

        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Scroll • Line {actualScroll + 1}-
            {Math.min(actualScroll + viewportHeight, detailLines.length)} of{" "}
            {detailLines.length}
          </Text>
          {hasLess && <Text color={colors.primary}> {figures.arrowUp}</Text>}
          {hasMore && <Text color={colors.primary}> {figures.arrowDown}</Text>}
          <Text color={colors.textDim} dimColor>
            {" "}
            • [q or esc] Back to Details
          </Text>
        </Box>
      </>
    );
  }

  // Main detail view
  const lp = selectedDevbox.launch_parameters;
  const hasCapabilities =
    selectedDevbox.capabilities &&
    selectedDevbox.capabilities.filter((c: string) => c !== "unknown").length >
      0;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Devboxes" },
          { label: selectedDevbox.name || selectedDevbox.id, active: true },
        ]}
      />

      {/* Main info section */}
      <Box flexDirection="column" marginTop={1} marginBottom={1} paddingX={1}>
        <Box flexDirection="row" flexWrap="wrap">
          <Text color={colors.primary} bold>
            {truncateString(
              selectedDevbox.name || selectedDevbox.id,
              Math.max(20, detailViewport.terminalWidth - 35),
            )}
          </Text>
          {/* Only show ID separately if there's a name */}
          {selectedDevbox.name && (
            <Text color={colors.idColor}> • {selectedDevbox.id}</Text>
          )}
        </Box>
        <Box>
          <StatusBadge status={selectedDevbox.status} fullText />
          {uptime !== null && selectedDevbox.status === "running" && (
            <Text color={colors.success} dimColor>
              {" "}
              • Uptime:{" "}
              {uptime < 60
                ? `${uptime}m`
                : `${Math.floor(uptime / 60)}h ${uptime % 60}m`}
            </Text>
          )}
          {selectedDevbox.status !== "running" &&
            selectedDevbox.create_time_ms &&
            selectedDevbox.end_time_ms && (
              <Text color={colors.textDim} dimColor>
                {" "}
                • Ran for:{" "}
                {(() => {
                  const runtime = Math.floor(
                    (selectedDevbox.end_time_ms -
                      selectedDevbox.create_time_ms) /
                      1000,
                  );
                  if (runtime < 60) return `${runtime}s`;
                  const mins = Math.floor(runtime / 60);
                  if (mins < 60) return `${mins}m ${runtime % 60}s`;
                  const hours = Math.floor(mins / 60);
                  return `${hours}h ${mins % 60}m`;
                })()}
              </Text>
            )}
        </Box>
      </Box>

      {/* Details section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.warning} bold>
          {figures.squareSmallFilled} Details
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          {/* Created / Ended */}
        {selectedDevbox.create_time_ms && (
          <Box>
            <Text color={colors.textDim}>Created    </Text>
            <Text dimColor>{formattedCreateTime}</Text>
            {selectedDevbox.end_time_ms ? (
              <Text dimColor>
                {" "}
                {figures.arrowRight} {new Date(selectedDevbox.end_time_ms).toLocaleString()}
              </Text>
            ) : (
              <Text dimColor> ({createTimeAgo})</Text>
            )}
          </Box>
        )}

        {/* Resources */}
        {(lp?.resource_size_request ||
          lp?.custom_cpu_cores ||
          lp?.custom_gb_memory ||
          lp?.custom_disk_size ||
          lp?.architecture) && (
          <Box>
            <Text color={colors.textDim}>Resources  </Text>
            <Text dimColor>
              {[
                lp?.resource_size_request,
                lp?.architecture,
                lp?.custom_cpu_cores && `${lp.custom_cpu_cores}VCPU`,
                lp?.custom_gb_memory && `${lp.custom_gb_memory}GB RAM`,
                lp?.custom_disk_size && `${lp.custom_disk_size}GB DISC`,
              ]
                .filter(Boolean)
                .join(" • ")}
            </Text>
          </Box>
        )}

        {/* Lifetime and User on same line */}
        {(lp?.keep_alive_time_seconds || lp?.user_parameters) && (
          <Box>
            {lp?.keep_alive_time_seconds && (
              <>
                <Text color={colors.textDim}>Lifetime   </Text>
                <Text dimColor>
                  {lp.keep_alive_time_seconds < 3600
                    ? `${Math.floor(lp.keep_alive_time_seconds / 60)}m`
                    : `${Math.floor(lp.keep_alive_time_seconds / 3600)}h ${Math.floor((lp.keep_alive_time_seconds % 3600) / 60)}m`}
                </Text>
                {uptime !== null && selectedDevbox.status === "running" && (
                  <Text>
                    {" "}
                    •{" "}
                    {(() => {
                      const maxLifetimeMinutes = Math.floor(
                        lp.keep_alive_time_seconds / 60,
                      );
                      const remainingMinutes = maxLifetimeMinutes - uptime;
                      if (remainingMinutes <= 0) {
                        return <Text color={colors.error}>Expired</Text>;
                      } else if (remainingMinutes < 5) {
                        return (
                          <Text color={colors.error}>
                            {remainingMinutes}m remaining
                          </Text>
                        );
                      } else if (remainingMinutes < 15) {
                        return (
                          <Text color={colors.warning}>
                            {remainingMinutes}m remaining
                          </Text>
                        );
                      } else if (remainingMinutes < 60) {
                        return (
                          <Text color={colors.success}>
                            {remainingMinutes}m remaining
                          </Text>
                        );
                      } else {
                        const hours = Math.floor(remainingMinutes / 60);
                        const mins = remainingMinutes % 60;
                        return (
                          <Text color={colors.success}>
                            {hours}h {mins}m remaining
                          </Text>
                        );
                      }
                    })()}
                  </Text>
                )}
                {lp?.user_parameters && (
                  <Text color={colors.textDim}> • </Text>
                )}
              </>
            )}
            {lp?.user_parameters && (
              <>
                {!lp?.keep_alive_time_seconds && (
                  <Text color={colors.textDim}>User       </Text>
                )}
                <Text color={colors.textDim}>User: </Text>
                <Text dimColor>
                  {lp.user_parameters.username || "default"}
                  {lp.user_parameters.uid != null &&
                    lp.user_parameters.uid !== 0 &&
                    ` (UID: ${lp.user_parameters.uid})`}
                </Text>
              </>
            )}
          </Box>
        )}

        {/* Source */}
        {(selectedDevbox.blueprint_id || selectedDevbox.snapshot_id) && (
          <Box>
            <Text color={colors.textDim}>Source     </Text>
            <Text color={colors.idColor}>
              {selectedDevbox.blueprint_id || selectedDevbox.snapshot_id}
            </Text>
          </Box>
        )}

        {/* Initiator */}
        {selectedDevbox.initiator_id && (
          <Box>
            <Text color={colors.textDim}>Initiator  </Text>
            <Text color={colors.idColor}>{selectedDevbox.initiator_id}</Text>
          </Box>
        )}

          {/* Capabilities */}
          {hasCapabilities && (
            <Box>
              <Text color={colors.textDim}>Capabilities </Text>
              <Text dimColor>
                {selectedDevbox.capabilities
                  .filter((c: string) => c !== "unknown")
                  .join(", ")}
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Metadata section */}
      {selectedDevbox.metadata &&
        Object.keys(selectedDevbox.metadata).length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={colors.info} bold>
              {figures.identical} Metadata
            </Text>
            <Box flexDirection="column" paddingLeft={2}>
              {Object.entries(selectedDevbox.metadata).map(([key, value]) => (
                <Box key={key}>
                  <Text color={colors.primary}>{key}</Text>
                  <Text color={colors.textDim}>=</Text>
                  <Text color={colors.idColor}>{value as string}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}

      {/* Failure */}
      {selectedDevbox.failure_reason && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={colors.error} bold>
            {figures.cross} Error
          </Text>
          <Box paddingLeft={2}>
            <Text color={colors.error}>
              {selectedDevbox.failure_reason}
            </Text>
          </Box>
        </Box>
      )}

      {/* State History */}
      <StateHistory
        stateTransitions={selectedDevbox.state_transitions}
        shutdownReason={selectedDevbox.shutdown_reason ?? undefined}
      />

      {/* Actions section */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.primary} bold>
          {figures.play} Actions
        </Text>
        <Box flexDirection="column" paddingLeft={1}>
          {operations.map((op, index) => {
            const isSelected = index === selectedOperation;
            return (
              <Box key={op.key}>
                <Text color={isSelected ? colors.primary : colors.textDim}>
                  {isSelected ? figures.pointer : " "}{" "}
                </Text>
                <Text
                  color={isSelected ? op.color : colors.textDim}
                  bold={isSelected}
                >
                  {op.icon} {op.label}
                </Text>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  [{op.shortcut}]
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate • [Enter] Execute • [i] Full Details •
          [o] Browser • [q] Back
        </Text>
      </Box>
    </>
  );
};
