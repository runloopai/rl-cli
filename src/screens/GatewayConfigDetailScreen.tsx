/**
 * GatewayConfigDetailScreen - Detail page for gateway configs
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  useGatewayConfigStore,
  type GatewayConfig,
} from "../store/gatewayConfigStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import {
  getGatewayConfig,
  deleteGatewayConfig,
} from "../services/gatewayConfigService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { GatewayConfigCreatePage } from "../components/GatewayConfigCreatePage.js";
import { colors } from "../utils/theme.js";

interface GatewayConfigDetailScreenProps {
  gatewayConfigId?: string;
}

/**
 * Get a display label for the auth mechanism type
 */
function getAuthTypeLabel(
  authMechanism: GatewayConfig["auth_mechanism"],
): string {
  if (authMechanism.type === "bearer") {
    return "Bearer Token";
  }
  if (authMechanism.type === "header") {
    return authMechanism.key ? `Header: ${authMechanism.key}` : "Header";
  }
  return authMechanism.type;
}

export function GatewayConfigDetailScreen({
  gatewayConfigId,
}: GatewayConfigDetailScreenProps) {
  const { goBack } = useNavigation();
  const gatewayConfigs = useGatewayConfigStore((state) => state.gatewayConfigs);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedConfig, setFetchedConfig] =
    React.useState<GatewayConfig | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showEditForm, setShowEditForm] = React.useState(false);

  // Find config in store first
  const configFromStore = gatewayConfigs.find((c) => c.id === gatewayConfigId);

  // Fetch config from API if not in store or missing full details
  React.useEffect(() => {
    if (gatewayConfigId && !loading && !fetchedConfig) {
      // Always fetch full details since store may only have basic info
      setLoading(true);
      setError(null);

      getGatewayConfig(gatewayConfigId)
        .then((config) => {
          setFetchedConfig(config);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [gatewayConfigId, loading, fetchedConfig]);

  // Use fetched config for full details, fall back to store for basic display
  const config = fetchedConfig || configFromStore;

  // Show loading state while fetching or before fetch starts
  if (!config && gatewayConfigId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "AI Gateway Configs" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading AI gateway config details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !config) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "AI Gateway Configs" }, { label: "Error", active: true }]}
        />
        <ErrorMessage
          message="Failed to load AI gateway config details"
          error={error}
        />
      </>
    );
  }

  // Show error if no config found
  if (!config) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "AI Gateway Configs" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`AI gateway config ${gatewayConfigId || "unknown"} not found`}
          error={new Error("AI gateway config not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
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
  if (config.account_id) {
    basicFields.push({
      label: "Account ID",
      value: config.account_id,
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

  // Auth mechanism section
  const authFields = [];
  authFields.push({
    label: "Auth Type",
    value: (
      <Text color={colors.info} bold>
        {getAuthTypeLabel(config.auth_mechanism)}
      </Text>
    ),
  });
  if (config.auth_mechanism.type === "header" && config.auth_mechanism.key) {
    authFields.push({
      label: "Header Key",
      value: config.auth_mechanism.key,
    });
  }

  detailSections.push({
    title: "Authentication",
    icon: figures.arrowRight,
    color: colors.info,
    fields: authFields,
  });

  // Operations available for gateway configs
  const operations: ResourceOperation[] = [
    {
      key: "edit",
      label: "Edit AI Gateway Config",
      color: colors.warning,
      icon: figures.pointer,
      shortcut: "e",
    },
    {
      key: "delete",
      label: "Delete AI Gateway Config",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (
    operation: string,
    _resource: GatewayConfig,
  ) => {
    switch (operation) {
      case "edit":
        setShowEditForm(true);
        break;
      case "delete":
        // Show confirmation dialog
        setShowDeleteConfirm(true);
        break;
    }
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!config) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteGatewayConfig(config.id);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (gc: GatewayConfig): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        AI Gateway Config Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {gc.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {gc.name}
      </Text>,
    );
    if (gc.description) {
      lines.push(
        <Text key="core-desc" dimColor>
          {" "}
          Description: {gc.description}
        </Text>,
      );
    }
    lines.push(
      <Text key="core-endpoint" dimColor>
        {" "}
        Endpoint: {gc.endpoint}
      </Text>,
    );
    if (gc.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(gc.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (gc.account_id) {
      lines.push(
        <Text key="core-account" dimColor>
          {" "}
          Account ID: {gc.account_id}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Auth Mechanism
    lines.push(
      <Text key="auth-title" color={colors.warning} bold>
        Authentication
      </Text>,
    );
    lines.push(
      <Text key="auth-type" dimColor>
        {" "}
        Type: {getAuthTypeLabel(gc.auth_mechanism)}
      </Text>,
    );
    if (gc.auth_mechanism.type === "header" && gc.auth_mechanism.key) {
      lines.push(
        <Text key="auth-key" dimColor>
          {" "}
          Header Key: {gc.auth_mechanism.key}
        </Text>,
      );
    }
    lines.push(<Text key="auth-space"> </Text>);

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(gc, null, 2).split("\n");
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

  // Show edit form
  if (showEditForm && config) {
    return (
      <GatewayConfigCreatePage
        onBack={() => setShowEditForm(false)}
        onCreate={(updatedConfig) => {
          // Update the fetched config with the new data
          setFetchedConfig(updatedConfig as GatewayConfig);
          setShowEditForm(false);
        }}
        initialConfig={config}
      />
    );
  }

  // Show delete confirmation
  if (showDeleteConfirm && config) {
    return (
      <ConfirmationPrompt
        title="Delete AI Gateway Config"
        message={`Are you sure you want to delete "${config.name || config.id}"?`}
        details="This action cannot be undone. Any devboxes using this AI gateway config will no longer have access to it."
        breadcrumbItems={[
          { label: "AI Gateway Configs" },
          { label: config.name || config.id },
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
            { label: "AI Gateway Configs" },
            { label: config.name || config.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting AI gateway config..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={config}
      resourceType="AI Gateway Configs"
      getDisplayName={(gc) => gc.name || gc.id}
      getId={(gc) => gc.id}
      getStatus={() => "active"} // Gateway configs don't have a status field
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
