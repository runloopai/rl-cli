import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import type {
  DevboxCreateParams,
  DevboxView,
} from "@runloop/api-client/resources/devboxes/devboxes";
import type { LaunchParameters } from "@runloop/api-client/resources/shared";
import { getClient } from "../utils/client.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SuccessMessage } from "./SuccessMessage.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { MetadataDisplay } from "./MetadataDisplay.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface DevboxCreatePageProps {
  onBack: () => void;
  onCreate?: (devbox: DevboxView) => void;
  initialBlueprintId?: string;
  initialSnapshotId?: string;
}

type FormField =
  | "create"
  | "name"
  | "architecture"
  | "resource_size"
  | "custom_cpu"
  | "custom_memory"
  | "custom_disk"
  | "keep_alive"
  | "metadata"
  | "blueprint_id"
  | "snapshot_id";

interface FormData {
  name: string;
  architecture: "arm64" | "x86_64";
  resource_size:
    | "X_SMALL"
    | "SMALL"
    | "MEDIUM"
    | "LARGE"
    | "X_LARGE"
    | "XX_LARGE"
    | "CUSTOM_SIZE"
    | "";
  custom_cpu: string;
  custom_memory: string;
  custom_disk: string;
  keep_alive: string;
  metadata: Record<string, string>;
  blueprint_id: string;
  snapshot_id: string;
}

export const DevboxCreatePage = ({
  onBack,
  onCreate,
  initialBlueprintId,
  initialSnapshotId,
}: DevboxCreatePageProps) => {
  const [currentField, setCurrentField] = React.useState<FormField>("create");
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    architecture: "x86_64",
    resource_size: "SMALL",
    custom_cpu: "",
    custom_memory: "",
    custom_disk: "",
    keep_alive: "3600", // 1 hour
    metadata: {},
    blueprint_id: initialBlueprintId || "",
    snapshot_id: initialSnapshotId || "",
  });
  const [metadataKey, setMetadataKey] = React.useState("");
  const [metadataValue, setMetadataValue] = React.useState("");
  const [inMetadataSection, setInMetadataSection] = React.useState(false);
  const [metadataInputMode, setMetadataInputMode] = React.useState<
    "key" | "value" | null
  >(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = React.useState(-1); // -1 means "add new" row
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<DevboxView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const baseFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "metadata" | "action";
  }> = [
    { key: "create", label: "Devbox Create", type: "action" },
    { key: "name", label: "Name", type: "text" },
    { key: "architecture", label: "Architecture", type: "select" },
    { key: "resource_size", label: "Resource Size", type: "select" },
  ];

  // Add custom resource fields if CUSTOM_SIZE is selected
  const customFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "metadata" | "action";
  }> =
    formData.resource_size === "CUSTOM_SIZE"
      ? [
          { key: "custom_cpu", label: "CPU Cores (2-16, even)", type: "text" },
          {
            key: "custom_memory",
            label: "Memory GB (2-64, even)",
            type: "text",
          },
          { key: "custom_disk", label: "Disk GB (2-64, even)", type: "text" },
        ]
      : [];

  const remainingFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "metadata" | "action";
  }> = [
    { key: "keep_alive", label: "Keep Alive (seconds)", type: "text" },
    { key: "blueprint_id", label: "Blueprint ID (optional)", type: "text" },
    { key: "snapshot_id", label: "Snapshot ID (optional)", type: "text" },
    { key: "metadata", label: "Metadata (optional)", type: "metadata" },
  ];

  const fields = [...baseFields, ...customFields, ...remainingFields];

  const architectures = ["arm64", "x86_64"] as const;
  const resourceSizes = [
    "X_SMALL",
    "SMALL",
    "MEDIUM",
    "LARGE",
    "X_LARGE",
    "XX_LARGE",
    "CUSTOM_SIZE",
  ] as const;

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

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

    // Back to list
    if (input === "q" || key.escape) {
      onBack();
      return;
    }

    // Submit form
    if (input === "s" && key.ctrl) {
      handleCreate();
      return;
    }

    // Handle Enter on create field
    if (currentField === "create" && key.return) {
      handleCreate();
      return;
    }

    // Handle metadata section
    if (inMetadataSection) {
      const metadataKeys = Object.keys(formData.metadata);
      // Selection model: 0 = "Add new", 1..n = Existing items, n+1 = "Done"
      const maxIndex = metadataKeys.length + 1;

      // Handle input mode (typing key or value)
      if (metadataInputMode) {
        if (metadataInputMode === "key" && key.return && metadataKey.trim()) {
          setMetadataInputMode("value");
          return;
        } else if (metadataInputMode === "value" && key.return) {
          if (metadataKey.trim() && metadataValue.trim()) {
            setFormData({
              ...formData,
              metadata: {
                ...formData.metadata,
                [metadataKey.trim()]: metadataValue.trim(),
              },
            });
          }
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode(null);
          setSelectedMetadataIndex(0); // Back to "add new" row
          return;
        } else if (key.escape) {
          // Cancel input
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode(null);
          return;
        } else if (key.tab) {
          // Tab between key and value
          setMetadataInputMode(metadataInputMode === "key" ? "value" : "key");
          return;
        }
        return; // Don't process other keys while in input mode
      }

      // Navigation mode
      if (key.upArrow && selectedMetadataIndex > 0) {
        setSelectedMetadataIndex(selectedMetadataIndex - 1);
      } else if (key.downArrow && selectedMetadataIndex < maxIndex) {
        setSelectedMetadataIndex(selectedMetadataIndex + 1);
      } else if (key.return) {
        if (selectedMetadataIndex === 0) {
          // Add new
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode("key");
        } else if (selectedMetadataIndex === maxIndex) {
          // Done - exit metadata section
          setInMetadataSection(false);
          setSelectedMetadataIndex(0);
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode(null);
        } else if (
          selectedMetadataIndex >= 1 &&
          selectedMetadataIndex <= metadataKeys.length
        ) {
          // Edit existing (selectedMetadataIndex - 1 gives array index)
          const keyToEdit = metadataKeys[selectedMetadataIndex - 1];
          setMetadataKey(keyToEdit || "");
          setMetadataValue(formData.metadata[keyToEdit] || "");

          // Remove old entry
          const newMetadata = { ...formData.metadata };
          delete newMetadata[keyToEdit];
          setFormData({ ...formData, metadata: newMetadata });

          setMetadataInputMode("key");
        }
      } else if (
        (input === "d" || key.delete) &&
        selectedMetadataIndex >= 1 &&
        selectedMetadataIndex <= metadataKeys.length
      ) {
        // Delete selected item (selectedMetadataIndex - 1 gives array index)
        const keyToDelete = metadataKeys[selectedMetadataIndex - 1];
        const newMetadata = { ...formData.metadata };
        delete newMetadata[keyToDelete];
        setFormData({ ...formData, metadata: newMetadata });
        // Stay at same position or move to add new if we deleted the last item
        const newLength = Object.keys(newMetadata).length;
        if (selectedMetadataIndex > newLength) {
          setSelectedMetadataIndex(Math.max(0, newLength));
        }
      } else if (key.escape || input === "q") {
        // Exit metadata section
        setInMetadataSection(false);
        setSelectedMetadataIndex(0);
        setMetadataKey("");
        setMetadataValue("");
        setMetadataInputMode(null);
      }
      return;
    }

    // Now safe to get field from list
    const field = fields[currentFieldIndex];

    // Navigation
    if (key.upArrow && currentFieldIndex > 0) {
      setCurrentField(fields[currentFieldIndex - 1].key);
      return;
    }

    if (key.downArrow && currentFieldIndex < fields.length - 1) {
      setCurrentField(fields[currentFieldIndex + 1].key);
      return;
    }

    // Enter key on metadata field to enter metadata section
    if (currentField === "metadata" && key.return) {
      setInMetadataSection(true);
      setSelectedMetadataIndex(0); // Start at "add new" row
      return;
    }

    // Handle select fields
    if (field && field.type === "select" && (key.leftArrow || key.rightArrow)) {
      if (currentField === "architecture") {
        const currentIndex = architectures.indexOf(formData.architecture);
        const newIndex = key.leftArrow
          ? Math.max(0, currentIndex - 1)
          : Math.min(architectures.length - 1, currentIndex + 1);
        setFormData({
          ...formData,
          architecture: architectures[newIndex] as "arm64" | "x86_64",
        });
      } else if (currentField === "resource_size") {
        // Find current index, defaulting to 0 if not found (e.g., empty string)
        const currentSize = formData.resource_size || "SMALL";
        const currentIndex = resourceSizes.indexOf(
          currentSize as (typeof resourceSizes)[number],
        );
        const safeIndex = currentIndex === -1 ? 0 : currentIndex;
        const newIndex = key.leftArrow
          ? Math.max(0, safeIndex - 1)
          : Math.min(resourceSizes.length - 1, safeIndex + 1);
        setFormData({
          ...formData,
          resource_size: resourceSizes[newIndex],
        });
      }
      return;
    }
  });

  // Validate custom resource configuration
  const validateCustomResources = (): string | null => {
    if (formData.resource_size !== "CUSTOM_SIZE") {
      return null;
    }

    const cpu = parseInt(formData.custom_cpu);
    const memory = parseInt(formData.custom_memory);
    const disk = parseInt(formData.custom_disk);

    if (
      formData.custom_cpu &&
      (isNaN(cpu) || cpu < 2 || cpu > 16 || cpu % 2 !== 0)
    ) {
      return "CPU cores must be an even number between 2 and 16";
    }

    if (
      formData.custom_memory &&
      (isNaN(memory) || memory < 2 || memory > 64 || memory % 2 !== 0)
    ) {
      return "Memory must be an even number between 2 and 64 GB";
    }

    if (
      formData.custom_disk &&
      (isNaN(disk) || disk < 2 || disk > 64 || disk % 2 !== 0)
    ) {
      return "Disk must be an even number between 2 and 64 GB";
    }

    // Validate CPU to memory ratio (1:2 to 1:8)
    if (formData.custom_cpu && formData.custom_memory) {
      const ratio = memory / cpu;
      if (ratio < 2 || ratio > 8) {
        return `CPU to memory ratio must be 1:2 to 1:8 (got ${cpu}:${memory}, ratio 1:${ratio.toFixed(1)})`;
      }
    }

    return null;
  };

  const handleCreate = async () => {
    // Validate before creating
    const validationError = validateCustomResources();
    if (validationError) {
      setError(new Error(validationError));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const client = getClient();

      const launchParameters: LaunchParameters = {};

      if (formData.architecture) {
        launchParameters.architecture = formData.architecture;
      }

      if (formData.resource_size) {
        launchParameters.resource_size_request = formData.resource_size;
      }

      if (formData.resource_size === "CUSTOM_SIZE") {
        if (formData.custom_cpu)
          launchParameters.custom_cpu_cores = parseInt(formData.custom_cpu);
        if (formData.custom_memory)
          launchParameters.custom_gb_memory = parseInt(formData.custom_memory);
        if (formData.custom_disk)
          launchParameters.custom_disk_size = parseInt(formData.custom_disk);
      }

      if (formData.keep_alive) {
        launchParameters.keep_alive_time_seconds = parseInt(
          formData.keep_alive,
        );
      }

      const createParams: DevboxCreateParams = {};

      if (formData.name) {
        createParams.name = formData.name;
      }

      if (Object.keys(formData.metadata).length > 0) {
        createParams.metadata = formData.metadata;
      }

      if (formData.blueprint_id) {
        createParams.blueprint_id = formData.blueprint_id;
      }

      if (formData.snapshot_id) {
        createParams.snapshot_id = formData.snapshot_id;
      }

      if (Object.keys(launchParameters).length > 0) {
        createParams.launch_parameters = launchParameters;
      }

      const devbox = await client.devboxes.create(createParams);
      setResult(devbox);
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
          items={[{ label: "Devboxes" }, { label: "Create", active: true }]}
        />
        <SuccessMessage message="Devbox created successfully!" />
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
              Status: {result.status}
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
          items={[{ label: "Devboxes" }, { label: "Create", active: true }]}
        />
        <ErrorMessage message="Failed to create devbox" error={error} />
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
          items={[{ label: "Devboxes" }, { label: "Create", active: true }]}
        />
        <SpinnerComponent message="Creating devbox..." />
      </>
    );
  }

  // Form screen
  return (
    <>
      <Breadcrumb
        items={[{ label: "Devboxes" }, { label: "Create", active: true }]}
      />

      <Box flexDirection="column" marginBottom={1}>
        {fields.map((field) => {
          const isActive = currentField === field.key;
          const fieldData = formData[field.key as keyof FormData];

          if (field.type === "action") {
            return (
              <Box key={field.key} marginBottom={0}>
                <Text
                  color={isActive ? colors.success : colors.textDim}
                  bold={isActive}
                >
                  {isActive ? figures.pointer : " "} {field.label}
                </Text>
                {isActive && (
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [Enter to create]
                  </Text>
                )}
              </Box>
            );
          }

          if (field.type === "text") {
            return (
              <Box key={field.key} marginBottom={0}>
                <Text color={isActive ? colors.primary : colors.textDim}>
                  {isActive ? figures.pointer : " "} {field.label}:{" "}
                </Text>
                {isActive ? (
                  <TextInput
                    value={String(fieldData || "")}
                    onChange={(value) => {
                      setFormData({ ...formData, [field.key]: value });
                    }}
                    placeholder={
                      field.key === "name"
                        ? "my-devbox"
                        : field.key === "keep_alive"
                          ? "3600"
                          : field.key === "blueprint_id"
                            ? "bp_xxx"
                            : field.key === "snapshot_id"
                              ? "snap_xxx"
                              : ""
                    }
                  />
                ) : (
                  <Text color={colors.text}>
                    {String(fieldData || "(empty)")}
                  </Text>
                )}
              </Box>
            );
          }

          if (field.type === "select") {
            const value = fieldData as string;
            return (
              <Box key={field.key} marginBottom={0}>
                <Text color={isActive ? colors.primary : colors.textDim}>
                  {isActive ? figures.pointer : " "} {field.label}:
                </Text>
                <Text
                  color={isActive ? colors.primary : colors.text}
                  bold={isActive}
                >
                  {" "}
                  {value || "(none)"}
                </Text>
                {isActive && (
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [{figures.arrowLeft}
                    {figures.arrowRight} to change]
                  </Text>
                )}
              </Box>
            );
          }

          if (field.type === "metadata") {
            if (!inMetadataSection) {
              // Collapsed view
              return (
                <Box key={field.key} flexDirection="column" marginBottom={0}>
                  <Box>
                    <Text color={isActive ? colors.primary : colors.textDim}>
                      {isActive ? figures.pointer : " "} {field.label}:{" "}
                    </Text>
                    <Text color={colors.text}>
                      {Object.keys(formData.metadata).length} item(s)
                    </Text>
                    {isActive && (
                      <Text color={colors.textDim} dimColor>
                        {" "}
                        [Enter to manage]
                      </Text>
                    )}
                  </Box>
                  {Object.keys(formData.metadata).length > 0 && (
                    <Box marginLeft={2}>
                      <MetadataDisplay
                        metadata={formData.metadata}
                        title=""
                        showBorder={false}
                        compact
                      />
                    </Box>
                  )}
                </Box>
              );
            }

            // Expanded metadata section view
            const metadataKeys = Object.keys(formData.metadata);
            // Selection model: 0 = "Add new", 1..n = Existing items, n+1 = "Done"
            const maxIndex = metadataKeys.length + 1;

            return (
              <Box
                key={field.key}
                flexDirection="column"
                borderStyle="round"
                borderColor={colors.primary}
                paddingX={1}
                paddingY={1}
                marginBottom={1}
              >
                <Text color={colors.primary} bold>
                  {figures.hamburger} Manage Metadata
                </Text>

                {/* Input form - shown when adding or editing */}
                {metadataInputMode && (
                  <Box
                    flexDirection="column"
                    marginTop={1}
                    borderStyle="single"
                    borderColor={
                      selectedMetadataIndex === 0
                        ? colors.success
                        : colors.warning
                    }
                    paddingX={1}
                  >
                    <Text
                      color={
                        selectedMetadataIndex === 0
                          ? colors.success
                          : colors.warning
                      }
                      bold
                    >
                      {selectedMetadataIndex === 0 ? "Adding New" : "Editing"}
                    </Text>
                    <Box>
                      {metadataInputMode === "key" ? (
                        <>
                          <Text color={colors.primary}>Key: </Text>
                          <TextInput
                            value={metadataKey || ""}
                            onChange={setMetadataKey}
                            placeholder="env"
                          />
                        </>
                      ) : (
                        <Text dimColor>Key: {metadataKey || ""}</Text>
                      )}
                    </Box>
                    <Box>
                      {metadataInputMode === "value" ? (
                        <>
                          <Text color={colors.primary}>Value: </Text>
                          <TextInput
                            value={metadataValue || ""}
                            onChange={setMetadataValue}
                            placeholder="production"
                          />
                        </>
                      ) : (
                        <Text dimColor>Value: {metadataValue || ""}</Text>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Navigation menu - shown when not in input mode */}
                {!metadataInputMode && (
                  <>
                    {/* Add new option */}
                    <Box marginTop={1}>
                      <Text
                        color={
                          selectedMetadataIndex === 0
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {selectedMetadataIndex === 0
                          ? figures.pointer
                          : " "}{" "}
                      </Text>
                      <Text
                        color={
                          selectedMetadataIndex === 0
                            ? colors.success
                            : colors.textDim
                        }
                        bold={selectedMetadataIndex === 0}
                      >
                        + Add new metadata
                      </Text>
                    </Box>

                    {/* Existing items */}
                    {metadataKeys.length > 0 && (
                      <Box flexDirection="column" marginTop={1}>
                        {metadataKeys.map((key, index) => {
                          const itemIndex = index + 1; // Items are at indices 1..n
                          const isSelected =
                            selectedMetadataIndex === itemIndex;
                          return (
                            <Box key={key}>
                              <Text
                                color={
                                  isSelected ? colors.primary : colors.textDim
                                }
                              >
                                {isSelected ? figures.pointer : " "}{" "}
                              </Text>
                              <Text
                                color={
                                  isSelected ? colors.primary : colors.textDim
                                }
                                bold={isSelected}
                              >
                                {key}: {formData.metadata[key]}
                              </Text>
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {/* Done option */}
                    <Box marginTop={1}>
                      <Text
                        color={
                          selectedMetadataIndex === maxIndex
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {selectedMetadataIndex === maxIndex
                          ? figures.pointer
                          : " "}{" "}
                      </Text>
                      <Text
                        color={
                          selectedMetadataIndex === maxIndex
                            ? colors.success
                            : colors.textDim
                        }
                        bold={selectedMetadataIndex === maxIndex}
                      >
                        {figures.tick} Done
                      </Text>
                    </Box>
                  </>
                )}

                {/* Help text */}
                <Box
                  marginTop={1}
                  borderStyle="single"
                  borderColor={colors.border}
                  paddingX={1}
                >
                  <Text color={colors.textDim} dimColor>
                    {metadataInputMode
                      ? `[Tab] Switch field • [Enter] ${metadataInputMode === "key" ? "Next" : "Save"} • [esc] Cancel`
                      : `${figures.arrowUp}${figures.arrowDown} Navigate • [Enter] ${selectedMetadataIndex === 0 ? "Add" : selectedMetadataIndex === maxIndex ? "Done" : "Edit"} • [d] Delete • [esc] Back`}
                  </Text>
                </Box>
              </Box>
            );
          }

          return null;
        })}
      </Box>

      {/* Validation warning */}
      {formData.resource_size === "CUSTOM_SIZE" &&
        validateCustomResources() && (
          <Box
            borderStyle="round"
            borderColor={colors.error}
            paddingX={1}
            paddingY={0}
            marginTop={1}
          >
            <Text color={colors.error} bold>
              {figures.cross} Validation Error
            </Text>
            <Text color={colors.error} dimColor>
              {validateCustomResources()}
            </Text>
          </Box>
        )}

      {!inMetadataSection && (
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Navigate • [Enter] Create • [q] Cancel
          </Text>
        </Box>
      )}
    </>
  );
};
