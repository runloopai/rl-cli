/**
 * NetworkPolicyDetailScreen - Detail page for network policies
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  useNetworkPolicyStore,
  type NetworkPolicy,
} from "../store/networkPolicyStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import {
  getNetworkPolicy,
  deleteNetworkPolicy,
  updateNetworkPolicy,
} from "../services/networkPolicyService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { NetworkPolicyCreatePage } from "../components/NetworkPolicyCreatePage.js";
import { colors } from "../utils/theme.js";

interface NetworkPolicyDetailScreenProps {
  networkPolicyId?: string;
}

/**
 * Get a display label for the egress policy type
 */
function getEgressTypeLabel(egress: NetworkPolicy["egress"]): string {
  if (egress.allow_all) {
    return "Allow All";
  }
  if (egress.allowed_hostnames.length === 0) {
    return "Deny All";
  }
  return "Custom";
}

export function NetworkPolicyDetailScreen({
  networkPolicyId,
}: NetworkPolicyDetailScreenProps) {
  const { goBack } = useNavigation();
  const networkPolicies = useNetworkPolicyStore(
    (state) => state.networkPolicies,
  );

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedPolicy, setFetchedPolicy] =
    React.useState<NetworkPolicy | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showEditForm, setShowEditForm] = React.useState(false);

  // Find policy in store first
  const policyFromStore = networkPolicies.find((p) => p.id === networkPolicyId);

  // Fetch policy from API if not in store or missing full details
  React.useEffect(() => {
    if (networkPolicyId && !loading && !fetchedPolicy) {
      // Always fetch full details since store may only have basic info
      setLoading(true);
      setError(null);

      getNetworkPolicy(networkPolicyId)
        .then((policy) => {
          setFetchedPolicy(policy);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [networkPolicyId, loading, fetchedPolicy]);

  // Use fetched policy for full details, fall back to store for basic display
  const policy = fetchedPolicy || policyFromStore;

  // Show loading state while fetching
  if (loading && !policy) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading network policy details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !policy) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: "Error", active: true },
          ]}
        />
        <ErrorMessage
          message="Failed to load network policy details"
          error={error}
        />
      </>
    );
  }

  // Show error if no policy found
  if (!policy) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Network policy ${networkPolicyId || "unknown"} not found`}
          error={new Error("Network policy not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  if (policy.description) {
    basicFields.push({
      label: "Description",
      value: policy.description,
    });
  }
  if (policy.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(policy.create_time_ms),
    });
  }
  if (policy.update_time_ms) {
    basicFields.push({
      label: "Last Updated",
      value: formatTimestamp(policy.update_time_ms),
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

  // Egress rules section
  const egressFields = [];
  egressFields.push({
    label: "Policy Type",
    value: (
      <Text
        color={
          policy.egress.allow_all
            ? colors.success
            : policy.egress.allowed_hostnames.length === 0
              ? colors.error
              : colors.warning
        }
        bold
      >
        {getEgressTypeLabel(policy.egress)}
      </Text>
    ),
  });
  egressFields.push({
    label: "Allow Devbox-to-Devbox",
    value: policy.egress.allow_devbox_to_devbox ? "Yes" : "No",
  });

  if (
    policy.egress.allowed_hostnames &&
    policy.egress.allowed_hostnames.length > 0
  ) {
    egressFields.push({
      label: "Allowed Hostnames",
      value: `${policy.egress.allowed_hostnames.length} hostname(s)`,
    });
  }

  detailSections.push({
    title: "Egress Rules",
    icon: figures.arrowRight,
    color: colors.info,
    fields: egressFields,
  });

  // Operations available for network policies
  const operations: ResourceOperation[] = [
    {
      key: "edit",
      label: "Edit Network Policy",
      color: colors.warning,
      icon: figures.pointer,
      shortcut: "e",
    },
    {
      key: "delete",
      label: "Delete Network Policy",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (
    operation: string,
    _resource: NetworkPolicy,
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
    if (!policy) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteNetworkPolicy(policy.id);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (np: NetworkPolicy): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Network Policy Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {np.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {np.name}
      </Text>,
    );
    if (np.description) {
      lines.push(
        <Text key="core-desc" dimColor>
          {" "}
          Description: {np.description}
        </Text>,
      );
    }
    if (np.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(np.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (np.update_time_ms) {
      lines.push(
        <Text key="core-updated" dimColor>
          {" "}
          Last Updated: {new Date(np.update_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Egress Rules
    lines.push(
      <Text key="egress-title" color={colors.warning} bold>
        Egress Rules
      </Text>,
    );
    lines.push(
      <Text key="egress-type" dimColor>
        {" "}
        Policy Type: {getEgressTypeLabel(np.egress)}
      </Text>,
    );
    lines.push(
      <Text key="egress-allow-all" dimColor>
        {" "}
        Allow All: {np.egress.allow_all ? "Yes" : "No"}
      </Text>,
    );
    lines.push(
      <Text key="egress-devbox" dimColor>
        {" "}
        Allow Devbox-to-Devbox:{" "}
        {np.egress.allow_devbox_to_devbox ? "Yes" : "No"}
      </Text>,
    );
    lines.push(<Text key="egress-space"> </Text>);

    // Allowed Hostnames
    if (np.egress.allowed_hostnames && np.egress.allowed_hostnames.length > 0) {
      lines.push(
        <Text key="hostnames-title" color={colors.warning} bold>
          Allowed Hostnames ({np.egress.allowed_hostnames.length})
        </Text>,
      );
      np.egress.allowed_hostnames.forEach((hostname, idx) => {
        lines.push(
          <Text key={`hostname-${idx}`} dimColor>
            {" "}
            {figures.pointer} {hostname}
          </Text>,
        );
      });
      lines.push(<Text key="hostnames-space"> </Text>);
    }

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(np, null, 2).split("\n");
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
  if (showEditForm && policy) {
    return (
      <NetworkPolicyCreatePage
        onBack={() => setShowEditForm(false)}
        onCreate={(updatedPolicy) => {
          // Update the fetched policy with the new data
          setFetchedPolicy(updatedPolicy as NetworkPolicy);
          setShowEditForm(false);
        }}
        initialPolicy={policy}
      />
    );
  }

  // Show delete confirmation
  if (showDeleteConfirm && policy) {
    return (
      <ConfirmationPrompt
        title="Delete Network Policy"
        message={`Are you sure you want to delete "${policy.name || policy.id}"?`}
        details="This action cannot be undone. Any devboxes using this policy will lose their network restrictions."
        breadcrumbItems={[
          { label: "Network Policies" },
          { label: policy.name || policy.id },
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
            { label: "Network Policies" },
            { label: policy.name || policy.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting network policy..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={policy}
      resourceType="Network Policies"
      getDisplayName={(np) => np.name || np.id}
      getId={(np) => np.id}
      getStatus={() => "active"} // Network policies don't have a status field
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
    />
  );
}
