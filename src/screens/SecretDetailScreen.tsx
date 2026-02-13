/**
 * SecretDetailScreen - Detail page for secrets
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getClient } from "../utils/client.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { SecretCreatePage } from "../components/SecretCreatePage.js";
import { colors } from "../utils/theme.js";

interface SecretDetailScreenProps {
  secretId?: string;
}

interface Secret {
  id: string;
  name: string;
  create_time_ms?: number;
  update_time_ms?: number;
}

export function SecretDetailScreen({ secretId }: SecretDetailScreenProps) {
  const { goBack } = useNavigation();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [secret, setSecret] = React.useState<Secret | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showUpdateForm, setShowUpdateForm] = React.useState(false);

  // Fetch secret from API
  React.useEffect(() => {
    if (secretId && !loading && !secret) {
      setLoading(true);
      setError(null);

      const client = getClient();
      // Secrets API doesn't have a direct get by ID, so we list all and find
      client.secrets
        .list({ limit: 5000 })
        .then((result) => {
          const found = result.secrets?.find(
            (s: Secret) => s.id === secretId || s.name === secretId,
          );
          if (found) {
            setSecret(found as Secret);
          } else {
            setError(new Error("Secret not found"));
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [secretId, loading, secret]);

  // Show loading state while fetching or before fetch starts
  if (!secret && secretId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading secret details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !secret) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: "Error", active: true },
          ]}
        />
        <ErrorMessage message="Failed to load secret details" error={error} />
      </>
    );
  }

  // Show error if no secret found
  if (!secret) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Settings" },
            { label: "Secrets" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Secret ${secretId || "unknown"} not found`}
          error={new Error("Secret not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  basicFields.push({
    label: "Name",
    value: secret.name,
  });
  if (secret.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(secret.create_time_ms),
    });
  }
  if (secret.update_time_ms) {
    basicFields.push({
      label: "Last Updated",
      value: formatTimestamp(secret.update_time_ms),
    });
  }

  detailSections.push({
    title: "Details",
    icon: figures.squareSmallFilled,
    color: colors.warning,
    fields: basicFields,
  });

  // Security notice section
  detailSections.push({
    title: "Security",
    icon: figures.warning,
    color: colors.info,
    fields: [
      {
        label: "Value",
        value: (
          <Text color={colors.textDim} dimColor>
            Secret values are never displayed for security reasons
          </Text>
        ),
      },
    ],
  });

  // Operations available for secrets
  const operations: ResourceOperation[] = [
    {
      key: "update",
      label: "Update Value",
      color: colors.warning,
      icon: figures.pointer,
      shortcut: "u",
    },
    {
      key: "delete",
      label: "Delete Secret",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (operation: string, _resource: Secret) => {
    switch (operation) {
      case "update":
        setShowUpdateForm(true);
        break;
      case "delete":
        // Show confirmation dialog
        setShowDeleteConfirm(true);
        break;
    }
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!secret) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const client = getClient();
      await client.secrets.delete(secret.name);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (s: Secret): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Secret Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {s.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {s.name}
      </Text>,
    );
    if (s.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(s.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (s.update_time_ms) {
      lines.push(
        <Text key="core-updated" dimColor>
          {" "}
          Last Updated: {new Date(s.update_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Security Notice
    lines.push(
      <Text key="security-title" color={colors.warning} bold>
        Security Notice
      </Text>,
    );
    lines.push(
      <Text key="security-notice" color={colors.textDim} dimColor>
        {" "}
        Secret values are write-only and cannot be retrieved.
      </Text>,
    );
    lines.push(
      <Text key="security-notice2" color={colors.textDim} dimColor>
        {" "}
        Use the Update Value operation to change a secret&apos;s value.
      </Text>,
    );
    lines.push(<Text key="security-space"> </Text>);

    // Raw JSON (without value)
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonObj = {
      id: s.id,
      name: s.name,
      create_time_ms: s.create_time_ms,
      update_time_ms: s.update_time_ms,
    };
    const jsonLines = JSON.stringify(jsonObj, null, 2).split("\n");
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

  // Show update form
  if (showUpdateForm && secret) {
    return (
      <SecretCreatePage
        onBack={() => setShowUpdateForm(false)}
        onCreate={(updatedSecret) => {
          // Refresh the secret data
          setSecret({
            ...secret,
            ...updatedSecret,
            update_time_ms: Date.now(),
          });
          setShowUpdateForm(false);
        }}
        initialSecret={{ id: secret.id, name: secret.name }}
      />
    );
  }

  // Show delete confirmation
  if (showDeleteConfirm && secret) {
    return (
      <ConfirmationPrompt
        title="Delete Secret"
        message={`Are you sure you want to delete "${secret.name}"?`}
        details="This action cannot be undone. Any devboxes using this secret will no longer have access to it."
        breadcrumbItems={[
          { label: "Settings" },
          { label: "Secrets" },
          { label: secret.name || secret.id },
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
            { label: "Settings" },
            { label: "Secrets" },
            { label: secret.name || secret.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting secret..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={secret}
      resourceType="Secrets"
      breadcrumbPrefix={[{ label: "Settings" }]}
      getDisplayName={(s) => s.name || s.id}
      getId={(s) => s.id}
      getStatus={() => "active"} // Secrets don't have a status field
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
