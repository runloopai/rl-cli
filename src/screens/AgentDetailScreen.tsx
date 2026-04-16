/**
 * AgentDetailScreen - Detail page for agents
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
import { getAgent, deleteAgent, type Agent } from "../services/agentService.js";
import {
  getObject,
  buildObjectDetailFields,
} from "../services/objectService.js";
import { useResourceDetail } from "../hooks/useResourceDetail.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { colors } from "../utils/theme.js";

interface AgentDetailScreenProps {
  agentId?: string;
}

export function AgentDetailScreen({ agentId }: AgentDetailScreenProps) {
  const { goBack, navigate } = useNavigation();

  const {
    data: agent,
    loading,
    error,
  } = useResourceDetail<Agent>({
    id: agentId,
    fetch: getAgent,
  });

  // Fetch underlying object details for object-based agents
  const [objectDetails, setObjectDetails] = React.useState<Awaited<
    ReturnType<typeof getObject>
  > | null>(null);

  React.useEffect(() => {
    const source = (agent as any)?.source;
    if (source?.type === "object" && source.object?.object_id) {
      getObject(source.object.object_id)
        .then((obj) => setObjectDetails(obj))
        .catch(() => {
          /* silently ignore - object may have been deleted */
        });
    }
  }, [agent]);

  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [operationError, setOperationError] = React.useState<Error | null>(
    null,
  );
  const displayError = error ?? operationError;

  if (!agent && agentId && !error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Loading...", active: true }]}
        />
        <SpinnerComponent message="Loading agent details..." />
      </>
    );
  }

  if (displayError && !agent) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Error", active: true }]}
        />
        <ErrorMessage
          message="Failed to load agent details"
          error={displayError}
        />
      </>
    );
  }

  if (!agent) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Not Found", active: true }]}
        />
        <ErrorMessage
          message={`Agent ${agentId || "unknown"} not found`}
          error={new Error("Agent not found")}
        />
      </>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const source = (agent as any).source;

  // Build detail sections
  const detailSections: DetailSection[] = [];

  const basicFields = [];
  basicFields.push({ label: "Version", value: agent.version });
  if (agent.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(agent.create_time_ms),
    });
  }
  basicFields.push({
    label: "Public",
    value: (agent as any).is_public ? "Yes" : "No",
  });

  detailSections.push({
    title: "Details",
    icon: figures.squareSmallFilled,
    color: colors.warning,
    fields: basicFields,
  });

  // Source section
  if (source) {
    const sourceFields = [{ label: "Type", value: source.type || "-" }];

    if (source.npm) {
      sourceFields.push({
        label: "Package",
        value: source.npm.package_name,
      });
      if (source.npm.registry_url) {
        sourceFields.push({
          label: "Registry",
          value: source.npm.registry_url,
        });
      }
    } else if (source.pip) {
      sourceFields.push({
        label: "Package",
        value: source.pip.package_name,
      });
      if (source.pip.registry_url) {
        sourceFields.push({
          label: "Registry",
          value: source.pip.registry_url,
        });
      }
    } else if (source.git) {
      sourceFields.push({
        label: "Repository",
        value: source.git.repository,
      });
      if (source.git.ref) {
        sourceFields.push({ label: "Ref", value: source.git.ref });
      }
    } else if (source.object) {
      sourceFields.push({
        label: "Object ID",
        value: source.object.object_id,
      });
    }

    detailSections.push({
      title: "Source",
      icon: figures.info,
      color: colors.info,
      fields: sourceFields,
    });

    // Add a dedicated "Object Details" section for object-based agents,
    // reusing the same field builder as the Object detail screen
    if (source?.type === "object" && objectDetails) {
      const objectFields = buildObjectDetailFields(objectDetails);
      if (objectDetails.name) {
        objectFields.unshift({ label: "Name", value: objectDetails.name });
      }
      detailSections.push({
        title: "Object Details",
        icon: figures.squareSmallFilled,
        color: colors.secondary,
        fields: objectFields,
      });
    }
  }

  const isPublic = (agent as any).is_public;
  const operations: ResourceOperation[] = [
    {
      key: "create-devbox",
      label: "Create Devbox with Agent",
      color: colors.success,
      icon: figures.play,
      shortcut: "c",
    },
    ...(isPublic
      ? []
      : [
          {
            key: "delete",
            label: "Delete Agent",
            color: colors.error,
            icon: figures.cross,
            shortcut: "d",
          },
        ]),
  ];

  const handleOperation = async (operation: string) => {
    if (operation === "create-devbox") {
      navigate("devbox-create", { agentId: agent.id });
    } else if (operation === "delete") {
      setShowDeleteConfirm(true);
    }
  };

  const executeDelete = async () => {
    if (!agent) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteAgent(agent.id);
      goBack();
    } catch (err) {
      setOperationError(err as Error);
      setDeleting(false);
    }
  };

  const buildDetailLines = (a: Agent): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    lines.push(
      <Text key="title" color={colors.warning} bold>
        Agent Details
      </Text>,
    );
    lines.push(
      <Text key="id" color={colors.idColor}>
        {" "}
        ID: {a.id}
      </Text>,
    );
    lines.push(
      <Text key="name" dimColor>
        {" "}
        Name: {a.name}
      </Text>,
    );
    lines.push(
      <Text key="version" dimColor>
        {" "}
        Version: {a.version}
      </Text>,
    );
    if (a.create_time_ms) {
      lines.push(
        <Text key="created" dimColor>
          {" "}
          Created: {new Date(a.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="space"> </Text>);

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(a, null, 2).split("\n");
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

  if (showDeleteConfirm && agent) {
    return (
      <ConfirmationPrompt
        title="Delete Agent"
        message={`Are you sure you want to delete "${agent.name}" (${agent.id})?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Agents" },
          { label: agent.name },
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
            { label: "Agents" },
            { label: agent.name },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting agent..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={agent}
      resourceType="Agents"
      getDisplayName={(a) => a.name}
      getId={(a) => a.id}
      getStatus={() => ((agent as any).is_public ? "public" : "private")}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
