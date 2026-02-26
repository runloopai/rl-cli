import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import type { McpConfigView } from "@runloop/api-client/resources/mcp-configs";
import { getClient } from "../utils/client.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SuccessMessage } from "./SuccessMessage.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { FormTextInput, FormActionButton } from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { validateMcpConfig } from "../utils/mcpConfigValidation.js";

interface McpConfigCreatePageProps {
  onBack: () => void;
  onCreate?: (config: McpConfigView) => void;
  initialConfig?: {
    id?: string;
    name: string;
    endpoint: string;
    description?: string | null;
    allowed_tools: string[];
  };
}

type FormField =
  | "create"
  | "name"
  | "endpoint"
  | "allowed_tools"
  | "description";

interface FormData {
  name: string;
  endpoint: string;
  allowed_tools: string;
  description: string;
}

export const McpConfigCreatePage = ({
  onBack,
  onCreate,
  initialConfig,
}: McpConfigCreatePageProps) => {
  const isEditing = !!initialConfig?.id;

  const [currentField, setCurrentField] = React.useState<FormField>("create");

  const [formData, setFormData] = React.useState<FormData>({
    name: initialConfig?.name || "",
    endpoint: initialConfig?.endpoint || "",
    allowed_tools: initialConfig?.allowed_tools?.join(", ") || "",
    description: initialConfig?.description || "",
  });
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<McpConfigView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const fields: Array<{
    key: FormField;
    label: string;
    type: "text" | "action";
    placeholder?: string;
  }> = [
    {
      key: "create",
      label: isEditing ? "Update MCP Config" : "Create MCP Config",
      type: "action",
    },
    {
      key: "name",
      label: "Name (required)",
      type: "text",
      placeholder: "github-readonly",
    },
    {
      key: "endpoint",
      label: "Endpoint URL (required)",
      type: "text",
      placeholder: "https://mcp.example.com",
    },
    {
      key: "allowed_tools",
      label: "Allowed Tools (required, comma-separated)",
      type: "text",
      placeholder: "* or github.search_*, github.get_*",
    },
    {
      key: "description",
      label: "Description (optional)",
      type: "text",
      placeholder: "MCP config for...",
    },
  ];

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  useExitOnCtrlC();

  useInput(
    (input, key) => {
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

      if (error) {
        if (input === "r" || key.return) {
          setError(null);
        } else if (input === "q" || key.escape) {
          onBack();
        }
        return;
      }

      if (creating) {
        return;
      }

      if (input === "q" || key.escape) {
        onBack();
        return;
      }

      if (input === "s" && key.ctrl) {
        handleCreate();
        return;
      }

      if (key.return) {
        handleCreate();
        return;
      }

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
    { isActive: true },
  );

  const handleCreate = async () => {
    const validation = validateMcpConfig(
      {
        name: formData.name,
        endpoint: formData.endpoint,
        allowedTools: formData.allowed_tools,
      },
      {
        requireName: true,
        requireEndpoint: true,
        requireAllowedTools: true,
      },
    );

    if (!validation.valid) {
      setError(new Error(validation.errors.join("\n")));
      return;
    }

    const { sanitized } = validation;

    setCreating(true);
    setError(null);

    try {
      const client = getClient();

      let config: McpConfigView;

      if (isEditing && initialConfig?.id) {
        config = await client.mcpConfigs.update(initialConfig.id, {
          name: sanitized!.name!,
          endpoint: sanitized!.endpoint!,
          allowed_tools: sanitized!.allowedTools!,
          description: formData.description.trim() || undefined,
        });
      } else {
        config = await client.mcpConfigs.create({
          name: sanitized!.name!,
          endpoint: sanitized!.endpoint!,
          allowed_tools: sanitized!.allowedTools!,
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

  if (result) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: isEditing ? "Update" : "Create", active: true },
          ]}
        />
        <SuccessMessage
          message={`MCP config ${isEditing ? "updated" : "created"} successfully!`}
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
          <Box>
            <Text color={colors.textDim} dimColor>
              Allowed Tools: {result.allowed_tools?.join(", ") || "(none)"}
            </Text>
          </Box>
        </Box>
        <NavigationTips
          tips={[{ key: "Enter/q/esc", label: "Return to list" }]}
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: isEditing ? "Update" : "Create", active: true },
          ]}
        />
        <ErrorMessage
          message={`Failed to ${isEditing ? "update" : "create"} MCP config`}
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

  if (creating) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "MCP Configs" },
            { label: isEditing ? "Update" : "Create", active: true },
          ]}
        />
        <SpinnerComponent
          message={`${isEditing ? "Updating" : "Creating"} MCP config...`}
        />
      </>
    );
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "MCP Configs" },
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
        })}
      </Box>

      <Box marginLeft={2} marginBottom={1}>
        <Text color={colors.textDim} dimColor>
          {figures.info} Allowed Tools:
        </Text>
      </Box>
      <Box marginLeft={4} flexDirection="column">
        <Text color={colors.textDim} dimColor>
          {"• Use '*' to allow all tools"}
        </Text>
        <Text color={colors.textDim} dimColor>
          {"• Use glob patterns like 'github.search_*', 'github.get_*'"}
        </Text>
        <Text color={colors.textDim} dimColor>
          {"• Separate multiple patterns with commas"}
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
