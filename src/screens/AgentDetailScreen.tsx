/**
 * AgentDetailScreen - Detail page for agents
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useAgentStore, type Agent } from "../store/agentStore.js";
import { getAgent, deleteAgent } from "../services/agentService.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
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
  const { goBack } = useNavigation();
  const agents = useAgentStore((state) => state.agents);
  const agentFromStore = agents.find((a) => a.id === agentId);

  const { data: agent, error } = useResourceDetail<Agent>({
    id: agentId,
    fetch: getAgent,
    initialData: agentFromStore ?? undefined,
    pollInterval: 5000,
  });

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

  // Build detail sections
  const detailSections: DetailSection[] = [];

  const basicFields = [];
  basicFields.push({ label: "Version", value: agent.version });
  basicFields.push({
    label: "Public",
    value: agent.is_public ? "Yes" : "No",
  });
  if (agent.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(agent.create_time_ms),
    });
  }

  if (agent.source) {
    basicFields.push({
      label: "Source Type",
      value: agent.source.type || "-",
    });
    if (agent.source.npm) {
      basicFields.push({
        label: "Package",
        value: agent.source.npm.package_name,
      });
      if (agent.source.npm.registry_url) {
        basicFields.push({
          label: "Registry",
          value: agent.source.npm.registry_url,
        });
      }
    }
    if (agent.source.pip) {
      basicFields.push({
        label: "Package",
        value: agent.source.pip.package_name,
      });
      if (agent.source.pip.registry_url) {
        basicFields.push({
          label: "Registry",
          value: agent.source.pip.registry_url,
        });
      }
    }
    if (agent.source.git) {
      basicFields.push({
        label: "Repository",
        value: agent.source.git.repository,
      });
      if (agent.source.git.ref) {
        basicFields.push({ label: "Ref", value: agent.source.git.ref });
      }
    }
    if (agent.source.object) {
      basicFields.push({
        label: "Object ID",
        value: agent.source.object.object_id,
      });
    }
  }

  detailSections.push({
    title: "Details",
    icon: figures.squareSmallFilled,
    color: colors.warning,
    fields: basicFields,
  });

  const operations: ResourceOperation[] = [
    {
      key: "delete",
      label: "Delete",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  const handleOperation = async (operation: string) => {
    if (operation === "delete") {
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
    lines.push(
      <Text key="public" dimColor>
        {" "}
        Public: {a.is_public ? "Yes" : "No"}
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

    if (a.source) {
      lines.push(
        <Text key="source-title" color={colors.warning} bold>
          Source
        </Text>,
      );
      lines.push(
        <Text key="source-type" dimColor>
          {" "}
          Type: {a.source.type}
        </Text>,
      );
      if (a.source.npm) {
        lines.push(
          <Text key="npm-pkg" dimColor>
            {" "}
            Package: {a.source.npm.package_name}
          </Text>,
        );
      }
      if (a.source.pip) {
        lines.push(
          <Text key="pip-pkg" dimColor>
            {" "}
            Package: {a.source.pip.package_name}
          </Text>,
        );
      }
      if (a.source.git) {
        lines.push(
          <Text key="git-repo" dimColor>
            {" "}
            Repository: {a.source.git.repository}
          </Text>,
        );
      }
      if (a.source.object) {
        lines.push(
          <Text key="obj-id" dimColor>
            {" "}
            Object ID: {a.source.object.object_id}
          </Text>,
        );
      }
      lines.push(<Text key="source-space"> </Text>);
    }

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
        message={`Are you sure you want to delete "${agent.name}"?`}
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
      getStatus={(a) => (a.is_public ? "public" : "private")}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
