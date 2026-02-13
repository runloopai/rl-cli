import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import type { GatewayConfigView } from "@runloop/api-client/resources/gateway-configs";
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
  useFormSelectNavigation,
} from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface GatewayConfigCreatePageProps {
  onBack: () => void;
  onCreate?: (config: GatewayConfigView) => void;
  initialConfig?: {
    id?: string;
    name: string;
    endpoint: string;
    description?: string | null;
    auth_mechanism: {
      type: string;
      key?: string | null;
    };
  };
}

type FormField =
  | "create"
  | "name"
  | "endpoint"
  | "auth_type"
  | "auth_key"
  | "description";

const authTypes = ["bearer", "header"] as const;
type AuthType = (typeof authTypes)[number];

interface FormData {
  name: string;
  endpoint: string;
  auth_type: AuthType;
  auth_key: string;
  description: string;
}

export const GatewayConfigCreatePage = ({
  onBack,
  onCreate,
  initialConfig,
}: GatewayConfigCreatePageProps) => {
  const isEditing = !!initialConfig?.id;

  const [currentField, setCurrentField] = React.useState<FormField>("create");

  // Normalize auth type from API to match our options (lowercase)
  const normalizeAuthType = (type: string | undefined): AuthType => {
    const normalized = (type || "").toLowerCase();
    if (normalized === "header" || normalized === "bearer") {
      return normalized;
    }
    return "bearer"; // default
  };

  const [formData, setFormData] = React.useState<FormData>({
    name: initialConfig?.name || "",
    endpoint: initialConfig?.endpoint || "",
    auth_type: normalizeAuthType(initialConfig?.auth_mechanism?.type),
    auth_key: initialConfig?.auth_mechanism?.key || "",
    description: initialConfig?.description || "",
  });
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<GatewayConfigView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const fields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "action";
    placeholder?: string;
  }> = [
    {
      key: "create",
      label: isEditing ? "Update AI Gateway" : "Create AI Gateway",
      type: "action",
    },
    {
      key: "name",
      label: "Name (required)",
      type: "text",
      placeholder: "my-gateway",
    },
    {
      key: "endpoint",
      label: "Endpoint URL (required)",
      type: "text",
      placeholder: "https://api.example.com",
    },
    { key: "auth_type", label: "Auth Type", type: "select" },
    {
      key: "auth_key",
      label: "Auth Header Key (for header type)",
      type: "text",
      placeholder: "x-api-key",
    },
    {
      key: "description",
      label: "Description (optional)",
      type: "text",
      placeholder: "Gateway for...",
    },
  ];

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Select navigation handlers using shared hook
  const handleAuthTypeNav = useFormSelectNavigation(
    formData.auth_type,
    authTypes,
    (value) => {
      setFormData({
        ...formData,
        auth_type: value,
        // Clear auth_key if switching from header to bearer
        auth_key: value !== "header" ? "" : formData.auth_key,
      });
      // If switching away from header and currently on auth_key field, move to next field
      if (value !== "header" && currentField === "auth_key") {
        setCurrentField("description");
      }
    },
    currentField === "auth_type",
  );

  // Main form input handler
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

      // Handle creating state
      if (creating) {
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

      // Handle Enter on any field to submit
      if (key.return) {
        handleCreate();
        return;
      }

      // Handle select field navigation using shared hooks
      if (handleAuthTypeNav(input, key)) return;

      // Navigation (up/down arrows and tab/shift+tab)
      // Skip auth_key field if auth_type is not "header"
      const getNextField = (direction: "up" | "down"): FormField | null => {
        let nextIndex =
          direction === "up" ? currentFieldIndex - 1 : currentFieldIndex + 1;

        while (nextIndex >= 0 && nextIndex < fields.length) {
          const nextField = fields[nextIndex].key;
          // Skip auth_key if auth_type is not header
          if (nextField === "auth_key" && formData.auth_type !== "header") {
            nextIndex = direction === "up" ? nextIndex - 1 : nextIndex + 1;
            continue;
          }
          return nextField;
        }
        return null;
      };

      if ((key.upArrow || (key.tab && key.shift)) && currentFieldIndex > 0) {
        const nextField = getNextField("up");
        if (nextField) {
          setCurrentField(nextField);
        }
        return;
      }

      if (
        (key.downArrow || (key.tab && !key.shift)) &&
        currentFieldIndex < fields.length - 1
      ) {
        const nextField = getNextField("down");
        if (nextField) {
          setCurrentField(nextField);
        }
        return;
      }
    },
    { isActive: true },
  );

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setError(new Error("Name is required"));
      return;
    }
    if (!formData.endpoint.trim()) {
      setError(new Error("Endpoint URL is required"));
      return;
    }
    if (formData.auth_type === "header" && !formData.auth_key.trim()) {
      setError(new Error("Auth header key is required for header auth type"));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const client = getClient();

      const authMechanism: { type: string; key?: string } = {
        type: formData.auth_type,
      };
      if (formData.auth_type === "header" && formData.auth_key.trim()) {
        authMechanism.key = formData.auth_key.trim();
      }

      let config: GatewayConfigView;

      if (isEditing && initialConfig?.id) {
        // Update existing config
        config = await client.gatewayConfigs.update(initialConfig.id, {
          name: formData.name.trim(),
          endpoint: formData.endpoint.trim(),
          auth_mechanism: authMechanism,
          description: formData.description.trim() || undefined,
        });
      } else {
        // Create new config
        config = await client.gatewayConfigs.create({
          name: formData.name.trim(),
          endpoint: formData.endpoint.trim(),
          auth_mechanism: authMechanism,
          description: formData.description.trim() || undefined,
        });
      }

      setResult(config);
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
            { label: "AI Gateways" },
            { label: isEditing ? "Update" : "Create", active: true },
          ]}
        />
        <SuccessMessage
          message={`AI gateway ${isEditing ? "updated" : "created"} successfully!`}
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
              Name: {result.name || "(none)"}
            </Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              Endpoint: {result.endpoint}
            </Text>
          </Box>
        </Box>
        <NavigationTips
          tips={[{ key: "Enter/q/esc", label: "Return to list" }]}
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
            { label: "AI Gateways" },
            { label: isEditing ? "Update" : "Create", active: true },
          ]}
        />
        <ErrorMessage
          message={`Failed to ${isEditing ? "update" : "create"} AI gateway`}
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

  // Creating screen
  if (creating) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "AI Gateways" },
            { label: isEditing ? "Update" : "Create", active: true },
          ]}
        />
        <SpinnerComponent
          message={`${isEditing ? "Updating" : "Creating"} AI gateway...`}
        />
      </>
    );
  }

  // Form screen
  return (
    <>
      <Breadcrumb
        items={[
          { label: "AI Gateways" },
          { label: isEditing ? "Update" : "Create", active: true },
        ]}
      />

      <Box flexDirection="column" marginBottom={1}>
        {fields.map((field) => {
          const isActive = currentField === field.key;
          const fieldData = formData[field.key as keyof FormData];

          if (field.type === "action") {
            return (
              <FormActionButton
                key={field.key}
                label={field.label}
                isActive={isActive}
                hint={`[Enter to ${isEditing ? "update" : "create"}]`}
              />
            );
          }

          if (field.type === "text") {
            // Skip auth_key field if auth type is bearer
            if (field.key === "auth_key" && formData.auth_type !== "header") {
              return null;
            }

            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={String(fieldData || "")}
                onChange={(value) =>
                  setFormData({ ...formData, [field.key]: value })
                }
                onSubmit={handleCreate}
                isActive={isActive}
                placeholder={field.placeholder}
              />
            );
          }

          if (field.type === "select") {
            const value = fieldData as string;
            return (
              <FormSelect
                key={field.key}
                label={field.label}
                value={value || ""}
                options={authTypes}
                onChange={(newValue) =>
                  setFormData({
                    ...formData,
                    [field.key]: newValue,
                    // Clear auth_key if switching from header to bearer
                    auth_key: newValue !== "header" ? "" : formData.auth_key,
                  })
                }
                isActive={isActive}
              />
            );
          }

          return null;
        })}
      </Box>

      <Box marginLeft={2} marginBottom={1}>
        <Text color={colors.textDim} dimColor>
          {figures.info} Auth Types:
        </Text>
      </Box>
      <Box marginLeft={4} flexDirection="column">
        <Text color={colors.textDim} dimColor>
          • bearer: Uses Bearer token authentication
        </Text>
        <Text color={colors.textDim} dimColor>
          • header: Uses custom header (specify header key)
        </Text>
      </Box>

      <NavigationTips
        showArrows
        tips={[
          { key: "Enter", label: isEditing ? "Update" : "Create" },
          { key: "q", label: "Cancel" },
        ]}
      />
    </>
  );
};
