/**
 * NetworkPolicyCreatePage - Form for creating a new network policy
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
import {
  FormTextInput,
  FormSelect,
  FormActionButton,
  FormListManager,
  useFormSelectNavigation,
} from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface NetworkPolicyCreatePageProps {
  onBack: () => void;
  onCreate?: (policy: NetworkPolicyView) => void;
}

type FormField =
  | "create"
  | "name"
  | "description"
  | "allow_all"
  | "allow_devbox_to_devbox"
  | "allowed_hostnames";

interface FormData {
  name: string;
  description: string;
  allow_all: "Yes" | "No";
  allow_devbox_to_devbox: "Yes" | "No";
  allowed_hostnames: string[];
}

const BOOLEAN_OPTIONS = ["Yes", "No"] as const;

export const NetworkPolicyCreatePage = ({
  onBack,
  onCreate,
}: NetworkPolicyCreatePageProps) => {
  const [currentField, setCurrentField] = React.useState<FormField>("create");
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    description: "",
    allow_all: "No",
    allow_devbox_to_devbox: "No",
    allowed_hostnames: [],
  });
  const [hostnamesExpanded, setHostnamesExpanded] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<NetworkPolicyView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const allFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "list" | "action";
  }> = [
    { key: "create", label: "Create Network Policy", type: "action" },
    { key: "name", label: "Name (required)", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "allow_all", label: "Allow All Egress", type: "select" },
    { key: "allow_devbox_to_devbox", label: "Allow Devbox-to-Devbox", type: "select" },
    { key: "allowed_hostnames", label: "Allowed Hostnames", type: "list" },
  ];

  // Hide allowed_hostnames when allow_all is enabled
  const fields = formData.allow_all === "Yes"
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

  useInput((input, key) => {
    // Handle result screen
    if (result) {
      if (input === "q" || key.escape || key.return) {
        if (onCreate) {
          onCreate(result);
        }
        onBack();
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

    // Handle creating state
    if (creating) {
      return;
    }

    // Handle hostnames expanded mode - let FormListManager handle input
    if (hostnamesExpanded) {
      return;
    }

    // Back to list
    if (input === "q" || key.escape) {
      onBack();
      return;
    }

    // Submit form with Ctrl+S
    if (input === "s" && key.ctrl) {
      handleCreate();
      return;
    }

    // Handle Enter on create field
    if (currentField === "create" && key.return) {
      handleCreate();
      return;
    }

    // Handle Enter on hostnames field to expand
    if (currentField === "allowed_hostnames" && key.return) {
      setHostnamesExpanded(true);
      return;
    }

    // Handle select field navigation
    if (handleAllowAllNav(input, key)) return;
    if (handleDevboxNav(input, key)) return;

    // Navigation between fields
    if (key.upArrow && currentFieldIndex > 0) {
      setCurrentField(fields[currentFieldIndex - 1].key);
      return;
    }

    if (key.downArrow && currentFieldIndex < fields.length - 1) {
      setCurrentField(fields[currentFieldIndex + 1].key);
      return;
    }
  });

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setValidationError("Name is required");
      setCurrentField("name");
      return;
    }

    setCreating(true);
    setError(null);
    setValidationError(null);

    try {
      const client = getClient();

      const createParams: {
        name: string;
        description?: string;
        allow_all?: boolean;
        allow_devbox_to_devbox?: boolean;
        allowed_hostnames?: string[];
      } = {
        name: formData.name.trim(),
      };

      if (formData.description.trim()) {
        createParams.description = formData.description.trim();
      }

      createParams.allow_all = formData.allow_all === "Yes";
      createParams.allow_devbox_to_devbox = formData.allow_devbox_to_devbox === "Yes";

      if (formData.allowed_hostnames.length > 0) {
        createParams.allowed_hostnames = formData.allowed_hostnames;
      }

      const policy = await client.networkPolicies.create(createParams);
      setResult(policy);
    } catch (err) {
      setError(err as Error);
    } finally {
      setCreating(false);
    }
  };

  // Result screen
  if (result) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: "Create", active: true },
          ]}
        />
        <SuccessMessage message="Network policy created successfully!" />
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
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter], [q], or [esc] to return to list
          </Text>
        </Box>
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
            { label: "Create", active: true },
          ]}
        />
        <ErrorMessage message="Failed to create network policy" error={error} />
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter] or [r] to retry • [q] or [esc] to cancel
          </Text>
        </Box>
      </>
    );
  }

  // Creating screen
  if (creating) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Network Policies" },
            { label: "Create", active: true },
          ]}
        />
        <SpinnerComponent message="Creating network policy..." />
      </>
    );
  }

  // Form screen
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Network Policies" },
          { label: "Create", active: true },
        ]}
      />

      <Box flexDirection="column" marginBottom={1}>
        {fields.map((field) => {
          const isActive = currentField === field.key;

          if (field.type === "action") {
            return (
              <FormActionButton
                key={field.key}
                label={field.label}
                isActive={isActive}
                hint="[Enter to create]"
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
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Navigate • [Enter] Create/Expand • [q] Cancel
          </Text>
        </Box>
      )}
    </>
  );
};
