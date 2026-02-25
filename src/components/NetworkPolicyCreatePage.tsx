/**
 * NetworkPolicyCreatePage - Form for creating or editing a network policy
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import type { NetworkPolicyView } from "@runloop/api-client/resources/network-policies";
import { getClient } from "../utils/client.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SuccessMessage } from "./SuccessMessage.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import {
  FormTextInput,
  FormSelect,
  FormActionButton,
  FormListManager,
  useFormSelectNavigation,
} from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import type { NetworkPolicy } from "../store/networkPolicyStore.js";

interface NetworkPolicyCreatePageProps {
  onBack: () => void;
  onCreate?: (policy: NetworkPolicyView) => void;
  /** If provided, the form will be in edit mode with pre-filled values */
  initialPolicy?: NetworkPolicy;
}

type FormField =
  | "submit"
  | "name"
  | "description"
  | "allow_all"
  | "allow_devbox_to_devbox"
  | "allow_ai_gateway"
  | "allow_mcp_gateway"
  | "allowed_hostnames";

interface FormData {
  name: string;
  description: string;
  allow_all: "Yes" | "No";
  allow_devbox_to_devbox: "Yes" | "No";
  allow_ai_gateway: "Yes" | "No";
  allow_mcp_gateway: "Yes" | "No";
  allowed_hostnames: string[];
}

const BOOLEAN_OPTIONS = ["Yes", "No"] as const;

export const NetworkPolicyCreatePage = ({
  onBack,
  onCreate,
  initialPolicy,
}: NetworkPolicyCreatePageProps) => {
  const isEditMode = !!initialPolicy;
  const [currentField, setCurrentField] = React.useState<FormField>("submit");
  const [formData, setFormData] = React.useState<FormData>(() => {
    if (initialPolicy) {
      return {
        name: initialPolicy.name || "",
        description: initialPolicy.description || "",
        allow_all: initialPolicy.egress.allow_all ? "Yes" : "No",
        allow_devbox_to_devbox: initialPolicy.egress.allow_devbox_to_devbox
          ? "Yes"
          : "No",
        allow_ai_gateway: (initialPolicy.egress as any).allow_ai_gateway
          ? "Yes"
          : "No",
        allow_mcp_gateway: (initialPolicy.egress as any).allow_mcp_gateway
          ? "Yes"
          : "No",
        allowed_hostnames: initialPolicy.egress.allowed_hostnames || [],
      };
    }
    return {
      name: "",
      description: "",
      allow_all: "No",
      allow_devbox_to_devbox: "No",
      allow_ai_gateway: "No",
      allow_mcp_gateway: "No",
      allowed_hostnames: [],
    };
  });
  const [hostnamesExpanded, setHostnamesExpanded] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<NetworkPolicyView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  const allFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "list" | "action";
  }> = [
    {
      key: "submit",
      label: isEditMode ? "Update Network Policy" : "Create Network Policy",
      type: "action",
    },
    { key: "name", label: "Name (required)", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "allow_all", label: "Allow All Egress", type: "select" },
    {
      key: "allow_devbox_to_devbox",
      label: "Allow Devbox-to-Devbox",
      type: "select",
    },
    {
      key: "allow_ai_gateway",
      label: "Allow AI Gateway",
      type: "select",
    },
    {
      key: "allow_mcp_gateway",
      label: "Allow MCP Gateway",
      type: "select",
    },
    { key: "allowed_hostnames", label: "Allowed Hostnames", type: "list" },
  ];

  // Hide allowed_hostnames when allow_all is enabled
  const fields =
    formData.allow_all === "Yes"
      ? allFields.filter((f) => f.key !== "allowed_hostnames")
      : allFields;

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Select navigation handlers
  const handleAllowAllNav = useFormSelectNavigation(
    formData.allow_all,
    BOOLEAN_OPTIONS,
    (value) => {
      setFormData({ ...formData, allow_all: value });
      // If enabling allow_all and currently on hostnames field, move to previous field
      if (value === "Yes" && currentField === "allowed_hostnames") {
        setCurrentField("allow_devbox_to_devbox");
        setHostnamesExpanded(false);
      }
    },
    currentField === "allow_all",
  );

  const handleDevboxNav = useFormSelectNavigation(
    formData.allow_devbox_to_devbox,
    BOOLEAN_OPTIONS,
    (value) => setFormData({ ...formData, allow_devbox_to_devbox: value }),
    currentField === "allow_devbox_to_devbox",
  );

  // Main form input handler - active when not in hostnames expanded mode
  useInput(
    (input, key) => {
      // Handle result screen
      if (result) {
        if (input === "q" || key.escape || key.return) {
          if (onCreate) {
            onCreate(result);
          } else {
            onBack();
          }
        }
        return;
      }

      // Handle error screen
      if (error) {
        if (input === "r" || key.return) {
          // Retry - clear error and return to form
          setError(null);
        } else if (input === "q" || key.escape) {
          // Quit - go back to list
          onBack();
        }
        return;
      }

      // Handle submitting state
      if (submitting) {
        return;
      }

      // Back to list
      if (input === "q" || key.escape) {
        onBack();
        return;
      }

      // Submit form with Ctrl+S
      if (input === "s" && key.ctrl) {
        handleSubmit();
        return;
      }

      // Handle Enter on hostnames field to expand
      if (currentField === "allowed_hostnames" && key.return) {
        setHostnamesExpanded(true);
        return;
      }

      // Handle Enter on any field to submit (including text/select fields)
      if (key.return) {
        handleSubmit();
        return;
      }

      // Handle select field navigation
      if (handleAllowAllNav(input, key)) return;
      if (handleDevboxNav(input, key)) return;

      // Navigation between fields (up/down arrows and tab/shift+tab)
      if ((key.upArrow || (key.tab && key.shift)) && currentFieldIndex > 0) {
        setCurrentField(fields[currentFieldIndex - 1].key);
        return;
      }

      if (
        (key.downArrow || (key.tab && !key.shift)) &&
        currentFieldIndex < fields.length - 1
      ) {
        setCurrentField(fields[currentFieldIndex + 1].key);
        return;
      }
    },
    { isActive: !hostnamesExpanded },
  );

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setValidationError("Name is required");
      setCurrentField("name");
      return;
    }

    setSubmitting(true);
    setError(null);
    setValidationError(null);

    try {
      const client = getClient();

      const params: {
        name?: string;
        description?: string;
        allow_all?: boolean;
        allow_devbox_to_devbox?: boolean;
        allow_ai_gateway?: boolean;
        allow_mcp_gateway?: boolean;
        allowed_hostnames?: string[];
      } = {};

      // For create, name is always required
      // For update, only include if changed
      if (!isEditMode || formData.name.trim() !== initialPolicy?.name) {
        params.name = formData.name.trim();
      }

      // Include description if set (or if clearing in edit mode)
      if (formData.description.trim()) {
        params.description = formData.description.trim();
      } else if (isEditMode && initialPolicy?.description) {
        // Clear description if it was set before but now empty
        params.description = "";
      }

      params.allow_all = formData.allow_all === "Yes";
      params.allow_devbox_to_devbox = formData.allow_devbox_to_devbox === "Yes";
      params.allow_ai_gateway = formData.allow_ai_gateway === "Yes";
      params.allow_mcp_gateway = formData.allow_mcp_gateway === "Yes";

      // For allowed_hostnames, always send the current list
      // (empty array means no hostnames allowed)
      params.allowed_hostnames = formData.allowed_hostnames;

      let policy: NetworkPolicyView;
      if (isEditMode && initialPolicy) {
        policy = await client.networkPolicies.update(initialPolicy.id, params);
      } else {
        // For create, name is required
        policy = await client.networkPolicies.create({
          ...params,
          name: formData.name.trim(),
        });
      }
      setResult(policy);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbLabel = isEditMode ? initialPolicy?.name || "Edit" : "Create";
  const actionLabel = isEditMode ? "Edit" : "Create";

  // Result screen
  if (result) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: breadcrumbLabel, active: true },
          ]}
        />
        <SuccessMessage
          message={`Network policy ${isEditMode ? "updated" : "created"} successfully!`}
        />
        <Box marginLeft={2} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={colors.textDim} dimColor>
              ID:{" "}
            </Text>
            <Text color={colors.idColor}>{result.id}</Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              Name: {result.name}
            </Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              Allow All: {result.egress.allow_all ? "Yes" : "No"}
            </Text>
          </Box>
        </Box>
        {isEditMode && (
          <Box marginTop={1} marginLeft={2}>
            <Text color={colors.warning}>
              {figures.info} Changes are eventually consistent and may take a
              few moments to propagate.
            </Text>
          </Box>
        )}
        <NavigationTips
          tips={[
            {
              key: "Enter/q/esc",
              label: isEditMode ? "Return to details" : "Return to list",
            },
          ]}
        />
      </>
    );
  }

  // Error screen
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: breadcrumbLabel, active: true },
          ]}
        />
        <ErrorMessage
          message={`Failed to ${isEditMode ? "update" : "create"} network policy`}
          error={error}
        />
        <NavigationTips
          tips={[
            { key: "Enter/r", label: "Retry" },
            { key: "q/esc", label: "Cancel" },
          ]}
        />
      </>
    );
  }

  // Submitting screen
  if (submitting) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: breadcrumbLabel, active: true },
          ]}
        />
        <SpinnerComponent
          message={`${isEditMode ? "Updating" : "Creating"} network policy...`}
        />
      </>
    );
  }

  // Form screen
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Network Policies" },
          { label: breadcrumbLabel, active: true },
        ]}
      />

      {isEditMode && (
        <Box
          borderStyle="round"
          borderColor={colors.warning}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <Text color={colors.warning}>
            {figures.warning} <Text bold>Note:</Text> Network policy updates are{" "}
            <Text bold>eventually consistent</Text>. Changes may take a few
            moments to propagate to all devboxes using this policy.
          </Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {fields.map((field) => {
          const isActive = currentField === field.key;

          if (field.type === "action") {
            return (
              <FormActionButton
                key={field.key}
                label={field.label}
                isActive={isActive}
                hint={`[Enter to ${isEditMode ? "update" : "create"}]`}
              />
            );
          }

          if (field.type === "text") {
            const value = formData[field.key as keyof FormData] as string;
            const hasError = field.key === "name" && validationError;
            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={value}
                onChange={(newValue) => {
                  setFormData({ ...formData, [field.key]: newValue });
                  // Clear validation error when typing in the field with error
                  if (field.key === "name" && validationError) {
                    setValidationError(null);
                  }
                }}
                onSubmit={handleSubmit}
                isActive={isActive}
                placeholder={
                  field.key === "name"
                    ? "my-network-policy"
                    : field.key === "description"
                      ? "Policy description"
                      : ""
                }
                error={hasError ? validationError : undefined}
              />
            );
          }

          if (field.type === "select") {
            const value = formData[field.key as keyof FormData] as "Yes" | "No";
            return (
              <FormSelect
                key={field.key}
                label={field.label}
                value={value}
                options={BOOLEAN_OPTIONS}
                onChange={(newValue) =>
                  setFormData({ ...formData, [field.key]: newValue })
                }
                isActive={isActive}
              />
            );
          }

          if (field.type === "list") {
            return (
              <FormListManager
                key={field.key}
                title={field.label}
                items={formData.allowed_hostnames}
                onItemsChange={(items) =>
                  setFormData({ ...formData, allowed_hostnames: items })
                }
                isActive={isActive}
                isExpanded={hostnamesExpanded}
                onExpandedChange={setHostnamesExpanded}
                itemPlaceholder="github.com or *.npmjs.org"
                addLabel="+ Add hostname"
                collapsedLabel="hostname(s)"
              />
            );
          }

          return null;
        })}
      </Box>

      {!hostnamesExpanded && (
        <NavigationTips
          showArrows
          tips={[
            { key: "Enter", label: `${actionLabel}/Expand` },
            { key: "q", label: "Cancel" },
          ]}
        />
      )}
    </>
  );
};
