/**
 * BlueprintDetailScreen - Detail page for blueprints
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useBlueprintStore, type Blueprint } from "../store/blueprintStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getBlueprint } from "../services/blueprintService.js";
import { getClient } from "../utils/client.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { colors } from "../utils/theme.js";

interface BlueprintDetailScreenProps {
  blueprintId?: string;
}

export function BlueprintDetailScreen({
  blueprintId,
}: BlueprintDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const blueprints = useBlueprintStore((state) => state.blueprints);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedBlueprint, setFetchedBlueprint] =
    React.useState<Blueprint | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Find blueprint in store first
  const blueprintFromStore = blueprints.find((b) => b.id === blueprintId);

  // Polling function - must be defined before any early returns (Rules of Hooks)
  const pollBlueprint = React.useCallback(async () => {
    if (!blueprintId) return null as unknown as Blueprint;
    return getBlueprint(blueprintId);
  }, [blueprintId]);

  // Fetch blueprint from API if not in store or missing full details
  React.useEffect(() => {
    if (blueprintId && !loading && !fetchedBlueprint) {
      // Always fetch full details since store may only have basic info
      setLoading(true);
      setError(null);

      getBlueprint(blueprintId)
        .then((blueprint) => {
          setFetchedBlueprint(blueprint);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [blueprintId, loading, fetchedBlueprint]);

  // Use fetched blueprint for full details, fall back to store for basic display
  const blueprint = fetchedBlueprint || blueprintFromStore;

  // Show loading state while fetching
  if (loading && !blueprint) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading blueprint details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !blueprint) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Blueprints" }, { label: "Error", active: true }]}
        />
        <ErrorMessage
          message="Failed to load blueprint details"
          error={error}
        />
      </>
    );
  }

  // Show error if no blueprint found
  if (!blueprint) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Blueprint ${blueprintId || "unknown"} not found`}
          error={new Error("Blueprint not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  if (blueprint.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(blueprint.create_time_ms),
    });
  }
  if (blueprint.architecture) {
    basicFields.push({
      label: "Architecture",
      value: blueprint.architecture,
    });
  }
  if (blueprint.resources) {
    basicFields.push({
      label: "Resources",
      value: blueprint.resources,
    });
  }

  if (basicFields.length > 0) {
    detailSections.push({
      title: "Details",
      icon: figures.squareSmallFilled,
      color: colors.warning,
      fields: basicFields,
    });
  }

  // Launch parameters section
  const lp = blueprint.parameters?.launch_parameters;
  if (lp) {
    const lpFields = [];
    if (lp.custom_cpu_cores) {
      lpFields.push({
        label: "CPU Cores",
        value: String(lp.custom_cpu_cores),
      });
    }
    if (lp.custom_gb_memory) {
      lpFields.push({
        label: "Memory",
        value: `${lp.custom_gb_memory}GB`,
      });
    }
    if (lp.custom_disk_size) {
      lpFields.push({
        label: "Disk Size",
        value: `${lp.custom_disk_size}GB`,
      });
    }
    if (lp.keep_alive_time_seconds) {
      const minutes = Math.floor(lp.keep_alive_time_seconds / 60);
      const hours = Math.floor(minutes / 60);
      lpFields.push({
        label: "Keep Alive",
        value: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`,
      });
    }
    if (lp.available_ports && lp.available_ports.length > 0) {
      lpFields.push({
        label: "Available Ports",
        value: lp.available_ports.join(", "),
      });
    }
    if (lp.required_services && lp.required_services.length > 0) {
      lpFields.push({
        label: "Required Services",
        value: lp.required_services.join(", "),
      });
    }

    if (lpFields.length > 0) {
      detailSections.push({
        title: "Launch Parameters",
        icon: figures.arrowRight,
        color: colors.secondary,
        fields: lpFields,
      });
    }
  }

  // Setup section
  const params = blueprint.parameters;
  if (params) {
    const setupFields = [];
    if (params.dockerfile) {
      const lineCount = params.dockerfile.split("\n").length;
      setupFields.push({
        label: "Dockerfile",
        value: <Text dimColor>{lineCount} lines</Text>,
      });
    }
    if (
      params.system_setup_commands &&
      params.system_setup_commands.length > 0
    ) {
      setupFields.push({
        label: "Setup Commands",
        value: `${params.system_setup_commands.length} commands`,
      });
    }
    if (params.file_mounts && Object.keys(params.file_mounts).length > 0) {
      setupFields.push({
        label: "File Mounts",
        value: `${Object.keys(params.file_mounts).length} mounts`,
      });
    }

    if (setupFields.length > 0) {
      detailSections.push({
        title: "Build Configuration",
        icon: figures.hamburger,
        color: colors.info,
        fields: setupFields,
      });
    }
  }

  // Error section - show failure reason if present
  if (blueprint.failure_reason) {
    detailSections.push({
      title: "Error",
      icon: figures.cross,
      color: colors.error,
      fields: [
        {
          label: "Failure Reason",
          value: blueprint.failure_reason,
          color: colors.error,
        },
      ],
    });
  }

  // Operations available for blueprints
  const operations: ResourceOperation[] = [
    {
      key: "logs",
      label: "View Build Logs",
      color: colors.info,
      icon: figures.info,
      shortcut: "l",
    },
    {
      key: "create-devbox",
      label: "Create Devbox from Blueprint",
      color: colors.success,
      icon: figures.play,
      shortcut: "c",
    },
    {
      key: "delete",
      label: "Delete Blueprint",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (operation: string, resource: Blueprint) => {
    switch (operation) {
      case "logs":
        navigate("blueprint-logs", { blueprintId: resource.id });
        break;
      case "create-devbox":
        navigate("devbox-create", { blueprintId: resource.id });
        break;
      case "delete":
        // Show confirmation dialog
        setShowDeleteConfirm(true);
        break;
    }
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!blueprint) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const client = getClient();
      await client.blueprints.delete(blueprint.id);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  // Show delete confirmation
  if (showDeleteConfirm && blueprint) {
    return (
      <ConfirmationPrompt
        title="Delete Blueprint"
        message={`Are you sure you want to delete "${blueprint.name || blueprint.id}"?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Blueprints" },
          { label: blueprint.name || blueprint.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    );
  }

  // Show deleting state
  if (deleting) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            { label: blueprint?.name || blueprint?.id || "Blueprint" },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting blueprint..." />
      </>
    );
  }

  // Build detailed info lines for full details view
  const buildDetailLines = (bp: Blueprint): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Blueprint Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {bp.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {bp.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-status" dimColor>
        {" "}
        Status: {bp.status}
      </Text>,
    );
    if (bp.failure_reason) {
      lines.push(
        <Text key="core-failure" color={colors.error}>
          {" "}
          Failure Reason: {bp.failure_reason}
        </Text>,
      );
    }
    if (bp.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(bp.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Launch Parameters
    const lp = bp.parameters?.launch_parameters;
    if (lp) {
      lines.push(
        <Text key="lp-title" color={colors.warning} bold>
          Launch Parameters
        </Text>,
      );
      if (lp.architecture) {
        lines.push(
          <Text key="lp-arch" dimColor>
            {" "}
            Architecture: {lp.architecture}
          </Text>,
        );
      }
      if (lp.resource_size_request) {
        lines.push(
          <Text key="lp-resources" dimColor>
            {" "}
            Resource Size: {lp.resource_size_request}
          </Text>,
        );
      }
      if (lp.custom_cpu_cores) {
        lines.push(
          <Text key="lp-cpu" dimColor>
            {" "}
            CPU Cores: {lp.custom_cpu_cores}
          </Text>,
        );
      }
      if (lp.custom_gb_memory) {
        lines.push(
          <Text key="lp-memory" dimColor>
            {" "}
            Memory: {lp.custom_gb_memory}GB
          </Text>,
        );
      }
      if (lp.custom_disk_size) {
        lines.push(
          <Text key="lp-disk" dimColor>
            {" "}
            Disk Size: {lp.custom_disk_size}GB
          </Text>,
        );
      }
      if (lp.keep_alive_time_seconds) {
        lines.push(
          <Text key="lp-keepalive" dimColor>
            {" "}
            Keep Alive: {lp.keep_alive_time_seconds}s
          </Text>,
        );
      }
      if (lp.available_ports && lp.available_ports.length > 0) {
        lines.push(
          <Text key="lp-ports" dimColor>
            {" "}
            Available Ports: {lp.available_ports.join(", ")}
          </Text>,
        );
      }
      if (lp.launch_commands && lp.launch_commands.length > 0) {
        lines.push(
          <Text key="lp-launch-cmds" dimColor>
            {" "}
            Launch Commands:
          </Text>,
        );
        lp.launch_commands.forEach((cmd, idx) => {
          lines.push(
            <Text key={`lp-cmd-${idx}`} dimColor>
              {"   "}
              {figures.pointer} {cmd}
            </Text>,
          );
        });
      }
      lines.push(<Text key="lp-space"> </Text>);
    }

    // Build Configuration
    const params = bp.parameters;
    if (params) {
      if (params.dockerfile) {
        lines.push(
          <Text key="dockerfile-title" color={colors.warning} bold>
            Dockerfile
          </Text>,
        );
        params.dockerfile.split("\n").forEach((line, idx) => {
          lines.push(
            <Text key={`dockerfile-${idx}`} dimColor>
              {" "}
              {line}
            </Text>,
          );
        });
        lines.push(<Text key="dockerfile-space"> </Text>);
      }

      if (
        params.system_setup_commands &&
        params.system_setup_commands.length > 0
      ) {
        lines.push(
          <Text key="setup-title" color={colors.warning} bold>
            System Setup Commands
          </Text>,
        );
        params.system_setup_commands.forEach((cmd, idx) => {
          lines.push(
            <Text key={`setup-${idx}`} dimColor>
              {" "}
              {idx + 1}. {cmd}
            </Text>,
          );
        });
        lines.push(<Text key="setup-space"> </Text>);
      }

      if (params.file_mounts && Object.keys(params.file_mounts).length > 0) {
        lines.push(
          <Text key="mounts-title" color={colors.warning} bold>
            File Mounts
          </Text>,
        );
        Object.entries(params.file_mounts).forEach(([path, _content], idx) => {
          lines.push(
            <Text key={`mount-${idx}`} dimColor>
              {" "}
              {path}
            </Text>,
          );
        });
        lines.push(<Text key="mounts-space"> </Text>);
      }
    }

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(bp, null, 2).split("\n");
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

  return (
    <ResourceDetailPage
      resource={blueprint}
      resourceType="Blueprints"
      getDisplayName={(bp) => bp.name || bp.id}
      getId={(bp) => bp.id}
      getStatus={(bp) => bp.status}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      pollResource={blueprint.status === "building" ? pollBlueprint : undefined}
    />
  );
}
