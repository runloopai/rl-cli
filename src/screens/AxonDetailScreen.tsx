/**
 * AxonDetailScreen - Detail page for axons
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
} from "../components/ResourceDetailPage.js";
import { getAxon, type Axon } from "../services/axonService.js";
import { useResourceDetail } from "../hooks/useResourceDetail.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface AxonDetailScreenProps {
  axonId?: string;
}

export function AxonDetailScreen({ axonId }: AxonDetailScreenProps) {
  const { goBack } = useNavigation();

  const { data: axon, error } = useResourceDetail<Axon>({
    id: axonId,
    fetch: getAxon,
  });

  if (!axon && axonId && !error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Axons" }, { label: "Loading...", active: true }]}
        />
        <SpinnerComponent message="Loading axon details..." />
      </>
    );
  }

  if (error && !axon) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Axons" }, { label: "Error", active: true }]}
        />
        <ErrorMessage message="Failed to load axon details" error={error} />
      </>
    );
  }

  if (!axon) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Axons" }, { label: "Not Found", active: true }]}
        />
        <ErrorMessage
          message={`Axon ${axonId || "unknown"} not found`}
          error={new Error("Axon not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  const basicFields = [];
  if (axon.name) {
    basicFields.push({ label: "Name", value: axon.name });
  }
  if (axon.created_at_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(axon.created_at_ms),
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

  const buildDetailLines = (a: Axon): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    lines.push(
      <Text key="title" color={colors.warning} bold>
        Axon Details
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
        Name: {a.name ?? "(none)"}
      </Text>,
    );
    if (a.created_at_ms) {
      lines.push(
        <Text key="created" dimColor>
          {" "}
          Created: {new Date(a.created_at_ms).toLocaleString()}
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

  return (
    <ResourceDetailPage
      resource={axon}
      resourceType="Axons"
      getDisplayName={(a) => a.name ?? a.id}
      getId={(a) => a.id}
      getStatus={() => "active"}
      detailSections={detailSections}
      operations={[]}
      onOperation={async () => {}}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
