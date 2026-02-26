/**
 * McpConfigDetailScreen - Detail page for MCP configs
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text, useInput } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useMcpConfigStore, type McpConfig } from "../store/mcpConfigStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getMcpConfig, deleteMcpConfig } from "../services/mcpConfigService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { McpConfigCreatePage } from "../components/McpConfigCreatePage.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface McpConfigDetailScreenProps {
  mcpConfigId?: string;
}

export function McpConfigDetailScreen({
  mcpConfigId,
}: McpConfigDetailScreenProps) {
  const { goBack } = useNavigation();
  const mcpConfigs = useMcpConfigStore((state) => state.mcpConfigs);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedConfig, setFetchedConfig] = React.useState<McpConfig | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showEditForm, setShowEditForm] = React.useState(false);

  useExitOnCtrlC();

  const configFromStore = mcpConfigs.find((c) => c.id === mcpConfigId);

  const hasFetched = React.useRef(false);
  React.useEffect(() => {
    if (mcpConfigId && !hasFetched.current) {
      hasFetched.current = true;
      setLoading(true);
      setError(null);

      getMcpConfig(mcpConfigId)
        .then((config) => {
          setFetchedConfig(config);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [mcpConfigId]);

  const config = fetchedConfig || configFromStore;

  // Back navigation for error/not-found states
  useInput(
    (input, key) => {
      if (input === "q" || key.escape || key.return) {
        goBack();
      }
    },
    {
      isActive:
        !config && !loading && !showEditForm && !showDeleteConfirm && !deleting,
    },
  );

  if (!config && mcpConfigId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading MCP config details..." />
      </>
    );
  }

  if (error && !config) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "MCP Configs" }, { label: "Error", active: true }]}
        />
        <ErrorMessage
          message="Failed to load MCP config details"
          error={error}
        />
        <NavigationTips tips={[{ key: "q/esc/Enter", label: "Go back" }]} />
      </>
    );
  }

  if (!config) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`MCP config ${mcpConfigId || "unknown"} not found`}
          error={new Error("MCP config not found")}
        />
        <NavigationTips tips={[{ key: "q/esc/Enter", label: "Go back" }]} />
      </>
    );
  }

  const detailSections: DetailSection[] = [];

  const basicFields = [];
  if (config.description) {
    basicFields.push({
      label: "Description",
      value: config.description,
    });
  }
  basicFields.push({
    label: "Endpoint",
    value: config.endpoint,
  });
  if (config.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(config.create_time_ms),
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

  const toolsFields = [];
  if (config.allowed_tools && config.allowed_tools.length > 0) {
    toolsFields.push({
      label: "Patterns",
      value: (
        <Text color={colors.info} bold>
          {config.allowed_tools.join(", ")}
        </Text>
      ),
    });
    toolsFields.push({
      label: "Count",
      value: `${config.allowed_tools.length} pattern(s)`,
    });
  } else {
    toolsFields.push({
      label: "Patterns",
      value: "(none)",
    });
  }

  detailSections.push({
    title: "Allowed Tools",
    icon: figures.arrowRight,
    color: colors.info,
    fields: toolsFields,
  });

  const operations: ResourceOperation[] = [
    {
      key: "edit",
      label: "Edit MCP Config",
      color: colors.warning,
      icon: figures.pointer,
      shortcut: "e",
    },
    {
      key: "delete",
      label: "Delete MCP Config",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  const handleOperation = async (operation: string, _resource: McpConfig) => {
    switch (operation) {
      case "edit":
        setShowEditForm(true);
        break;
      case "delete":
        setShowDeleteConfirm(true);
        break;
    }
  };

  const executeDelete = async () => {
    if (!config) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteMcpConfig(config.id);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  const buildDetailLines = (mc: McpConfig): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        MCP Config Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {mc.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {mc.name}
      </Text>,
    );
    if (mc.description) {
      lines.push(
        <Text key="core-desc" dimColor>
          {" "}
          Description: {mc.description}
        </Text>,
      );
    }
    lines.push(
      <Text key="core-endpoint" dimColor>
        {" "}
        Endpoint: {mc.endpoint}
      </Text>,
    );
    if (mc.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(mc.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    lines.push(
      <Text key="tools-title" color={colors.warning} bold>
        Allowed Tools
      </Text>,
    );
    if (mc.allowed_tools && mc.allowed_tools.length > 0) {
      mc.allowed_tools.forEach((tool, idx) => {
        lines.push(
          <Text key={`tool-${idx}`} dimColor>
            {" "}
            {figures.pointer} {tool}
          </Text>,
        );
      });
    } else {
      lines.push(
        <Text key="tools-none" dimColor>
          {" "}
          (none)
        </Text>,
      );
    }
    lines.push(<Text key="tools-space"> </Text>);

    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(mc, null, 2).split("\n");
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

  if (showEditForm && config) {
    return (
      <McpConfigCreatePage
        onBack={() => setShowEditForm(false)}
        onCreate={(updatedConfig) => {
          setFetchedConfig(updatedConfig as McpConfig);
          setShowEditForm(false);
        }}
        initialConfig={config}
      />
    );
  }

  if (showDeleteConfirm && config) {
    return (
      <ConfirmationPrompt
        title="Delete MCP Config"
        message={`Are you sure you want to delete "${config.name || config.id}"?`}
        details="This action cannot be undone. Any devboxes using this MCP config will no longer have access to it."
        breadcrumbItems={[
          { label: "MCP Configs" },
          { label: config.name || config.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    );
  }

  if (deleting) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: config.name || config.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting MCP config..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={config}
      resourceType="MCP Configs"
      getDisplayName={(mc) => mc.name || mc.id}
      getId={(mc) => mc.id}
      getStatus={() => "active"}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
