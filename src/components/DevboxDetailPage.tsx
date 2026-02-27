/**
 * DevboxDetailPage - Detail page for devboxes
 * Uses the generic ResourceDetailPage component with devbox-specific customizations
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { DevboxActionsMenu } from "./DevboxActionsMenu.js";
import { buildStateHistorySection } from "./StateHistory.js";
import {
  ResourceDetailPage,
  type DetailSection,
  type ResourceOperation,
} from "./ResourceDetailPage.js";
import { getDevboxUrl } from "../utils/url.js";
import { colors } from "../utils/theme.js";
import { formatTimeAgo } from "../utils/time.js";
import { getMcpConfig } from "../services/mcpConfigService.js";
import type { Devbox } from "../store/devboxStore.js";

interface DevboxDetailPageProps {
  devbox: Devbox;
  onBack: () => void;
}

export const DevboxDetailPage = ({ devbox, onBack }: DevboxDetailPageProps) => {
  const [showActions, setShowActions] = React.useState(false);
  const [mcpEndpoints, setMcpEndpoints] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    if (!devbox.mcp_specs || Object.keys(devbox.mcp_specs).length === 0) return;

    for (const [, spec] of Object.entries(devbox.mcp_specs)) {
      getMcpConfig(spec.mcp_config_id)
        .then((config) => {
          setMcpEndpoints((prev) => ({
            ...prev,
            [spec.mcp_config_id]: config.endpoint,
          }));
        })
        .catch(() => {});
    }
  }, [devbox.mcp_specs]);
  const [selectedOperationKey, setSelectedOperationKey] = React.useState<
    string | null
  >(null);

  // All possible operations for devboxes
  const allOperations: ResourceOperation[] = [
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
  const getFilteredOperations = (devbox: Devbox): ResourceOperation[] => {
    const hasTunnel = !!(devbox.tunnel && devbox.tunnel.tunnel_key);

    return allOperations
      .filter((op) => {
        const status = devbox.status;

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
      .map((op) => {
        // Dynamic tunnel label based on whether tunnel is active
        if (op.key === "tunnel") {
          return hasTunnel
            ? {
                ...op,
                label: "Tunnel (Active)",
                color: colors.success,
                icon: figures.tick,
              }
            : op;
        }
        return op;
      });
  };

  // Build detail sections for the devbox
  const buildDetailSections = (devbox: Devbox): DetailSection[] => {
    const sections: DetailSection[] = [];
    const lp = devbox.launch_parameters;

    // Calculate uptime
    const uptime = devbox.create_time_ms
      ? Math.floor((Date.now() - devbox.create_time_ms) / 1000 / 60)
      : null;

    // Details section
    const detailFields = [];

    // Created / Ended time
    if (devbox.create_time_ms) {
      const createTime = new Date(devbox.create_time_ms).toLocaleString();
      const timeAgo = formatTimeAgo(devbox.create_time_ms);
      if (devbox.end_time_ms) {
        const endTime = new Date(devbox.end_time_ms).toLocaleString();
        detailFields.push({
          label: "Created",
          value: `${createTime} → ${endTime}`,
        });
      } else {
        detailFields.push({
          label: "Created",
          value: `${createTime} (${timeAgo})`,
        });
      }
    }

    // Resources
    if (
      lp?.resource_size_request ||
      lp?.custom_cpu_cores ||
      lp?.custom_gb_memory ||
      lp?.custom_disk_size ||
      lp?.architecture
    ) {
      const resources = [
        lp?.resource_size_request,
        lp?.architecture,
        lp?.custom_cpu_cores && `${lp.custom_cpu_cores}VCPU`,
        lp?.custom_gb_memory && `${lp.custom_gb_memory}GB RAM`,
        lp?.custom_disk_size && `${lp.custom_disk_size}GB DISC`,
      ]
        .filter(Boolean)
        .join(" • ");
      detailFields.push({
        label: "Resources",
        value: resources,
      });
    }

    // Lifetime with remaining time
    if (lp?.keep_alive_time_seconds) {
      const lifetimeStr =
        lp.keep_alive_time_seconds < 3600
          ? `${Math.floor(lp.keep_alive_time_seconds / 60)}m`
          : `${Math.floor(lp.keep_alive_time_seconds / 3600)}h ${Math.floor((lp.keep_alive_time_seconds % 3600) / 60)}m`;

      let remainingText = "";
      if (uptime !== null && devbox.status === "running") {
        const maxLifetimeMinutes = Math.floor(lp.keep_alive_time_seconds / 60);
        const remainingMinutes = maxLifetimeMinutes - uptime;
        if (remainingMinutes <= 0) {
          remainingText = " (Expired)";
        } else if (remainingMinutes < 60) {
          remainingText = ` (${remainingMinutes}m remaining)`;
        } else {
          const hours = Math.floor(remainingMinutes / 60);
          const mins = remainingMinutes % 60;
          remainingText = ` (${hours}h ${mins}m remaining)`;
        }
      }

      detailFields.push({
        label: "Lifetime",
        value: lifetimeStr + remainingText,
      });
    }

    // User
    if (lp?.user_parameters) {
      const username = lp.user_parameters.username || "default";
      const uid =
        lp.user_parameters.uid != null && lp.user_parameters.uid !== 0
          ? ` (UID: ${lp.user_parameters.uid})`
          : "";
      detailFields.push({
        label: "User",
        value: username + uid,
      });
    }

    // Source
    if (devbox.blueprint_id) {
      detailFields.push({
        label: "Source",
        value: <Text color={colors.success}>{devbox.blueprint_id}</Text>,
        action: {
          type: "navigate" as const,
          screen: "blueprint-detail" as const,
          params: { blueprintId: devbox.blueprint_id },
          hint: "View Blueprint",
        },
      });
    } else if (devbox.snapshot_id) {
      detailFields.push({
        label: "Source",
        value: <Text color={colors.success}>{devbox.snapshot_id}</Text>,
        action: {
          type: "navigate" as const,
          screen: "snapshot-detail" as const,
          params: { snapshotId: devbox.snapshot_id },
          hint: "View Snapshot",
        },
      });
    }

    // Network Policy
    if (lp?.network_policy_id) {
      detailFields.push({
        label: "Network Policy",
        value: <Text color={colors.info}>{lp.network_policy_id}</Text>,
        action: {
          type: "navigate" as const,
          screen: "network-policy-detail" as const,
          params: { networkPolicyId: lp.network_policy_id },
          hint: "View Policy",
        },
      });
    }

    // Gateway Specs
    if (devbox.gateway_specs && Object.keys(devbox.gateway_specs).length > 0) {
      Object.entries(devbox.gateway_specs).forEach(([envPrefix, spec]) => {
        detailFields.push({
          label: `Gateway (${envPrefix})`,
          value: <Text color={colors.success}>{spec.gateway_config_id}</Text>,
          action: {
            type: "navigate" as const,
            screen: "gateway-config-detail" as const,
            params: { gatewayConfigId: spec.gateway_config_id },
            hint: "View Config",
          },
        });
      });
    }

    // MCP Specs
    if (devbox.mcp_specs && Object.keys(devbox.mcp_specs).length > 0) {
      const entries = Object.entries(devbox.mcp_specs);
      entries.forEach(([envVarName, spec]) => {
        const endpoint = mcpEndpoints[spec.mcp_config_id];
        detailFields.push({
          label: `MCP (${envVarName})`,
          value: (
            <Text>
              <Text color={colors.success}>{spec.mcp_config_id}</Text>
              {endpoint ? (
                <Text color={colors.textDim}> ({endpoint})</Text>
              ) : null}
            </Text>
          ),
          action: {
            type: "navigate" as const,
            screen: "mcp-config-detail" as const,
            params: { mcpConfigId: spec.mcp_config_id },
            hint: "View Config",
          },
        });
      });
    }

    // Tunnel status - always show when running
    if (devbox.tunnel && devbox.tunnel.tunnel_key) {
      const tunnelKey = devbox.tunnel.tunnel_key;
      const authMode = devbox.tunnel.auth_mode;
      const tunnelUrl = `https://{port}-${tunnelKey}.tunnel.runloop.ai`;

      detailFields.push({
        label: "Tunnel",
        value: (
          <>
            <Text color={colors.success} bold>
              {figures.tick} Active
            </Text>
            <Text color={colors.textDim}> • </Text>
            <Text color={colors.success}>{tunnelUrl}</Text>
            {authMode === "authenticated" && (
              <Text color={colors.warning}> (authenticated)</Text>
            )}
          </>
        ),
      });
    } else if (devbox.status === "running") {
      detailFields.push({
        label: "Tunnel",
        value: (
          <Text color={colors.textDim} dimColor>
            {figures.cross} Off
          </Text>
        ),
      });
    }

    // Initiator
    if (devbox.initiator_id) {
      detailFields.push({
        label: "Initiator",
        value: <Text color={colors.secondary}>{devbox.initiator_id}</Text>,
      });
    }

    // Capabilities
    const hasCapabilities =
      devbox.capabilities &&
      devbox.capabilities.filter((c: string) => c !== "unknown").length > 0;
    if (hasCapabilities) {
      detailFields.push({
        label: "Capabilities",
        value: devbox.capabilities
          .filter((c: string) => c !== "unknown")
          .join(", "),
      });
    }

    if (detailFields.length > 0) {
      sections.push({
        title: "Details",
        icon: figures.squareSmallFilled,
        color: colors.warning,
        fields: detailFields,
      });
    }

    // Metadata section
    if (devbox.metadata && Object.keys(devbox.metadata).length > 0) {
      sections.push({
        title: "Metadata",
        icon: figures.identical,
        color: colors.secondary,
        fields: Object.entries(devbox.metadata).map(([key, value]) => ({
          label: key,
          value: value as string,
        })),
      });
    }

    // Error section
    if (devbox.failure_reason) {
      sections.push({
        title: "Error",
        icon: figures.cross,
        color: colors.error,
        fields: [
          {
            label: "Failure Reason",
            value: devbox.failure_reason,
            color: colors.error,
          },
        ],
      });
    }

    // State History section (under same section control as Details/Metadata - truncates when viewport is small)
    const stateHistorySection = buildStateHistorySection(
      devbox.state_transitions,
      devbox.shutdown_reason ?? undefined,
    );
    if (stateHistorySection) {
      sections.push(stateHistorySection);
    }

    return sections;
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (devbox: Devbox): React.ReactElement[] => {
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
        ID: {devbox.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {devbox.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-status" dimColor>
        {" "}
        Status: {capitalize(devbox.status)}
      </Text>,
    );
    if (devbox.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(devbox.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (devbox.end_time_ms) {
      lines.push(
        <Text key="core-ended" dimColor>
          {" "}
          Ended: {new Date(devbox.end_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Capabilities
    if (devbox.capabilities && devbox.capabilities.length > 0) {
      lines.push(
        <Text key="cap-title" color={colors.warning} bold>
          Capabilities
        </Text>,
      );
      devbox.capabilities.forEach((cap: string, idx: number) => {
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
    if (devbox.launch_parameters) {
      lines.push(
        <Text key="launch-title" color={colors.warning} bold>
          Launch Parameters
        </Text>,
      );

      const lp = devbox.launch_parameters;

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
            {Math.floor(lp.keep_alive_time_seconds / 60)}m)
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
        lp.launch_commands.forEach((cmd: string, idx: number) => {
          lines.push(
            <Text key={`launch-cmd-${idx}`} dimColor>
              {"   "}
              {figures.pointer} {cmd}
            </Text>,
          );
        });
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
              {"   "}
              Username: {lp.user_parameters.username}
            </Text>,
          );
        }
        if (lp.user_parameters.uid) {
          lines.push(
            <Text key="user-uid" dimColor>
              {"   "}
              UID: {lp.user_parameters.uid}
            </Text>,
          );
        }
      }
      lines.push(<Text key="launch-space"> </Text>);
    }

    // Tunnel Information
    if (devbox.tunnel && devbox.tunnel.tunnel_key) {
      lines.push(
        <Text key="tunnel-title" color={colors.warning} bold>
          Tunnel
        </Text>,
      );
      lines.push(
        <Text key="tunnel-key" dimColor>
          {" "}
          Tunnel Key: {devbox.tunnel.tunnel_key}
        </Text>,
      );
      lines.push(
        <Text key="tunnel-auth" dimColor>
          {" "}
          Auth Mode: {devbox.tunnel.auth_mode}
        </Text>,
      );

      const tunnelUrl = `https://{port}-${devbox.tunnel.tunnel_key}.tunnel.runloop.ai`;
      lines.push(
        <Text key="tunnel-url" color={colors.success}>
          {" "}
          Tunnel URL: {tunnelUrl}
        </Text>,
      );

      if (devbox.tunnel.auth_token) {
        lines.push(
          <Text key="tunnel-token" color={colors.warning}>
            {" "}
            Auth Token: {devbox.tunnel.auth_token}
          </Text>,
        );
      }

      lines.push(<Text key="tunnel-space"> </Text>);
    }

    // Source
    if (devbox.blueprint_id || devbox.snapshot_id) {
      lines.push(
        <Text key="source-title" color={colors.warning} bold>
          Source
        </Text>,
      );
      if (devbox.blueprint_id) {
        lines.push(
          <Text key="source-bp" color={colors.idColor}>
            {" "}
            Blueprint: {devbox.blueprint_id}
          </Text>,
        );
      }
      if (devbox.snapshot_id) {
        lines.push(
          <Text key="source-snap" color={colors.idColor}>
            {" "}
            Snapshot: {devbox.snapshot_id}
          </Text>,
        );
      }
      lines.push(<Text key="source-space"> </Text>);
    }

    // Initiator
    if (devbox.initiator_type) {
      lines.push(
        <Text key="init-title" color={colors.warning} bold>
          Initiator
        </Text>,
      );
      lines.push(
        <Text key="init-type" dimColor>
          {" "}
          Type: {devbox.initiator_type}
        </Text>,
      );
      if (devbox.initiator_id) {
        lines.push(
          <Text key="init-id" color={colors.idColor}>
            {" "}
            ID: {devbox.initiator_id}
          </Text>,
        );
      }
      lines.push(<Text key="init-space"> </Text>);
    }

    // Status Details
    if (devbox.failure_reason || devbox.shutdown_reason) {
      lines.push(
        <Text key="status-title" color={colors.warning} bold>
          Status Details
        </Text>,
      );
      if (devbox.failure_reason) {
        lines.push(
          <Text key="status-fail" color={colors.error}>
            {" "}
            Failure Reason: {devbox.failure_reason}
          </Text>,
        );
      }
      if (devbox.shutdown_reason) {
        lines.push(
          <Text key="status-shut" dimColor>
            {" "}
            Shutdown Initiator: {devbox.shutdown_reason}
          </Text>,
        );
      }
      lines.push(<Text key="status-space"> </Text>);
    }

    // Metadata
    if (devbox.metadata && Object.keys(devbox.metadata).length > 0) {
      lines.push(
        <Text key="meta-title" color={colors.warning} bold>
          Metadata
        </Text>,
      );
      Object.entries(devbox.metadata).forEach(([key, value], idx) => {
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
    if (devbox.state_transitions && devbox.state_transitions.length > 0) {
      lines.push(
        <Text key="state-title" color={colors.warning} bold>
          State History
        </Text>,
      );
      (
        devbox.state_transitions as Array<{
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
    const jsonLines = JSON.stringify(devbox, null, 2).split("\n");
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

  // Handle operation selection
  const handleOperation = (operation: string, _devbox: Devbox) => {
    setSelectedOperationKey(operation);
    setShowActions(true);
  };

  // Polling function
  // Show DevboxActionsMenu when an action is selected
  if (showActions) {
    return (
      <DevboxActionsMenu
        devbox={devbox}
        onBack={() => {
          setShowActions(false);
          setSelectedOperationKey(null);
        }}
        breadcrumbItems={[
          { label: "Devboxes" },
          { label: devbox.name || devbox.id },
        ]}
        initialOperation={selectedOperationKey || undefined}
        skipOperationsMenu={true}
      />
    );
  }

  return (
    <ResourceDetailPage
      resource={devbox}
      resourceType="Devboxes"
      getDisplayName={(d) => d.name || d.id}
      getId={(d) => d.id}
      getStatus={(d) => d.status}
      getUrl={(d) => getDevboxUrl(d.id)}
      detailSections={buildDetailSections(devbox)}
      operations={getFilteredOperations(devbox)}
      onOperation={handleOperation}
      onBack={onBack}
      buildDetailLines={buildDetailLines}
    />
  );
};
