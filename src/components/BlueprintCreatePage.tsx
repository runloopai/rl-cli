import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { MetadataDisplay } from "./MetadataDisplay.js";
import {
  FormTextInput,
  FormSelect,
  FormActionButton,
  FormListManager,
  useFormSelectNavigation,
} from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { createBlueprint, getBlueprint } from "../services/blueprintService.js";

interface BlueprintCreatePageProps {
  onBack: () => void;
  onCreate: (blueprintId: string) => void;
  baseBlueprintId?: string;
}

type ScreenState = "form" | "loading-base" | "creating" | "error";

type SourceType = "dockerfile" | "base_blueprint";

const SOURCE_TYPE_OPTIONS = ["dockerfile", "base_blueprint"] as const;
const ARCHITECTURE_OPTIONS = ["x86_64", "arm64"] as const;
const RESOURCE_OPTIONS = ["SMALL", "MEDIUM", "LARGE", "X_LARGE"] as const;

interface FormData {
  name: string;
  sourceType: SourceType;
  dockerfile: string;
  baseBlueprintId: string;
  systemSetupCommands: string[];
  architecture: string;
  resources: string;
  metadata: Record<string, string>;
}

type FieldKey =
  | "submit"
  | "name"
  | "sourceType"
  | "dockerfile"
  | "baseBlueprintId"
  | "setupCommands"
  | "architecture"
  | "resources"
  | "metadata";

export const BlueprintCreatePage = ({
  onBack,
  onCreate,
  baseBlueprintId,
}: BlueprintCreatePageProps) => {
  const [screenState, setScreenState] = React.useState<ScreenState>(
    baseBlueprintId ? "loading-base" : "form",
  );
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    sourceType: baseBlueprintId ? "base_blueprint" : "dockerfile",
    dockerfile: "",
    baseBlueprintId: baseBlueprintId || "",
    systemSetupCommands: [],
    architecture: "",
    resources: "",
    metadata: {},
  });
  const [activeFieldIndex, setActiveFieldIndex] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [setupExpanded, setSetupExpanded] = React.useState(false);
  const [inMetadataSection, setInMetadataSection] = React.useState(false);
  const [metadataKey, setMetadataKey] = React.useState("");
  const [metadataValue, setMetadataValue] = React.useState("");
  const [metadataInputMode, setMetadataInputMode] = React.useState<
    "key" | "value" | null
  >(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = React.useState(0);

  useExitOnCtrlC();

  // Load base blueprint for duplication
  React.useEffect(() => {
    if (!baseBlueprintId) return;

    getBlueprint(baseBlueprintId)
      .then((bp) => {
        const lp = bp.parameters?.launch_parameters;
        const params = bp.parameters;
        setFormData({
          name: (bp.name || "blueprint") + "-copy",
          sourceType: "base_blueprint",
          dockerfile: params?.dockerfile || "",
          baseBlueprintId: bp.id,
          systemSetupCommands: params?.system_setup_commands || [],
          architecture: lp?.architecture || "",
          resources: lp?.resource_size_request || "",
          metadata: (bp.metadata as Record<string, string>) || {},
        });
        setScreenState("form");
      })
      .catch((err) => {
        setError(err as Error);
        setScreenState("error");
      });
  }, [baseBlueprintId]);

  const visibleFields = React.useMemo((): Array<{
    key: FieldKey;
    label: string;
    type: "text" | "select" | "action" | "list" | "metadata";
  }> => {
    const f: Array<{
      key: FieldKey;
      label: string;
      type: "text" | "select" | "action" | "list" | "metadata";
    }> = [
      { key: "submit", label: "Create Blueprint", type: "action" },
      { key: "name", label: "Name (required)", type: "text" },
      { key: "sourceType", label: "Source", type: "select" },
    ];
    if (formData.sourceType === "dockerfile") {
      f.push({ key: "dockerfile", label: "Dockerfile", type: "text" });
    } else {
      f.push({
        key: "baseBlueprintId",
        label: "Base Blueprint ID",
        type: "text",
      });
    }
    f.push({
      key: "setupCommands",
      label: "System Setup Commands",
      type: "list",
    });
    f.push({ key: "architecture", label: "Architecture", type: "select" });
    f.push({ key: "resources", label: "Resources", type: "select" });
    f.push({ key: "metadata", label: "Metadata (optional)", type: "metadata" });
    return f;
  }, [formData.sourceType]);

  const activeField = visibleFields[activeFieldIndex]?.key;

  const handleSourceTypeSelect = useFormSelectNavigation(
    formData.sourceType,
    SOURCE_TYPE_OPTIONS,
    (v) => setFormData((prev) => ({ ...prev, sourceType: v as SourceType })),
    activeField === "sourceType",
  );

  const handleArchitectureSelect = useFormSelectNavigation(
    formData.architecture || "x86_64",
    ARCHITECTURE_OPTIONS,
    (v) => setFormData((prev) => ({ ...prev, architecture: v })),
    activeField === "architecture",
  );

  const handleResourcesSelect = useFormSelectNavigation(
    formData.resources || "SMALL",
    RESOURCE_OPTIONS,
    (v) => setFormData((prev) => ({ ...prev, resources: v })),
    activeField === "resources",
  );

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setValidationError("Name is required");
      const idx = visibleFields.findIndex((f) => f.key === "name");
      if (idx >= 0) setActiveFieldIndex(idx);
      return;
    }

    setError(null);
    setValidationError(null);
    setScreenState("creating");

    try {
      const bp = await createBlueprint({
        name: formData.name.trim(),
        dockerfile:
          formData.sourceType === "dockerfile" && formData.dockerfile.trim()
            ? formData.dockerfile.trim()
            : undefined,
        baseBlueprintId:
          formData.sourceType === "base_blueprint" &&
          formData.baseBlueprintId.trim()
            ? formData.baseBlueprintId.trim()
            : undefined,
        systemSetupCommands: formData.systemSetupCommands.filter(
          (c) => c.trim().length > 0,
        ),
        architecture: formData.architecture || undefined,
        resourceSizeRequest: formData.resources || undefined,
        metadata:
          Object.keys(formData.metadata).length > 0
            ? formData.metadata
            : undefined,
      });
      onCreate(bp.id);
    } catch (err) {
      setError(err as Error);
      setScreenState("error");
    }
  };

  // Main form input
  useInput(
    (input, key) => {
      if (screenState === "error") {
        if (input === "r" || key.return) {
          setError(null);
          setScreenState("form");
        } else if (input === "q" || key.escape) {
          onBack();
        }
        return;
      }

      if (screenState !== "form") return;

      if (handleSourceTypeSelect(input, key)) return;
      if (handleArchitectureSelect(input, key)) return;
      if (handleResourcesSelect(input, key)) return;

      if (input === "q" || key.escape) {
        onBack();
        return;
      }

      if (input === "s" && key.ctrl) {
        handleSubmit();
        return;
      }

      if (activeField === "setupCommands" && key.return) {
        setSetupExpanded(true);
        return;
      }

      if (activeField === "metadata" && key.return) {
        setInMetadataSection(true);
        setSelectedMetadataIndex(0);
        return;
      }

      if (key.return) {
        handleSubmit();
        return;
      }

      if (key.upArrow || (key.tab && key.shift)) {
        setActiveFieldIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow || (key.tab && !key.shift)) {
        setActiveFieldIndex((prev) =>
          Math.min(visibleFields.length - 1, prev + 1),
        );
        return;
      }
    },
    { isActive: !setupExpanded && !inMetadataSection },
  );

  // Metadata section input
  useInput(
    (input, key) => {
      const metadataKeys = Object.keys(formData.metadata);
      const maxIndex = metadataKeys.length + 1;

      if (metadataInputMode) {
        if (metadataInputMode === "key" && key.return && metadataKey.trim()) {
          setMetadataInputMode("value");
          return;
        } else if (metadataInputMode === "value" && key.return) {
          if (metadataKey.trim() && metadataValue.trim()) {
            setFormData((prev) => ({
              ...prev,
              metadata: {
                ...prev.metadata,
                [metadataKey.trim()]: metadataValue.trim(),
              },
            }));
          }
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode(null);
          setSelectedMetadataIndex(0);
          return;
        } else if (key.escape) {
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode(null);
          return;
        } else if (key.tab) {
          setMetadataInputMode(metadataInputMode === "key" ? "value" : "key");
          return;
        }
        return;
      }

      if (key.upArrow && selectedMetadataIndex > 0) {
        setSelectedMetadataIndex(selectedMetadataIndex - 1);
      } else if (key.downArrow && selectedMetadataIndex < maxIndex) {
        setSelectedMetadataIndex(selectedMetadataIndex + 1);
      } else if (key.return) {
        if (selectedMetadataIndex === 0) {
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode("key");
        } else if (selectedMetadataIndex === maxIndex) {
          setInMetadataSection(false);
          setSelectedMetadataIndex(0);
        } else {
          const keyToEdit = metadataKeys[selectedMetadataIndex - 1];
          setMetadataKey(keyToEdit || "");
          setMetadataValue(formData.metadata[keyToEdit] || "");
          const newMetadata = { ...formData.metadata };
          delete newMetadata[keyToEdit];
          setFormData((prev) => ({ ...prev, metadata: newMetadata }));
          setMetadataInputMode("key");
        }
      } else if (
        (input === "d" || key.delete) &&
        selectedMetadataIndex >= 1 &&
        selectedMetadataIndex <= metadataKeys.length
      ) {
        const keyToDelete = metadataKeys[selectedMetadataIndex - 1];
        const newMetadata = { ...formData.metadata };
        delete newMetadata[keyToDelete];
        setFormData((prev) => ({ ...prev, metadata: newMetadata }));
        const newLength = Object.keys(newMetadata).length;
        if (selectedMetadataIndex > newLength) {
          setSelectedMetadataIndex(Math.max(0, newLength));
        }
      } else if (key.escape || input === "q") {
        setInMetadataSection(false);
        setSelectedMetadataIndex(0);
        setMetadataKey("");
        setMetadataValue("");
        setMetadataInputMode(null);
      }
    },
    { isActive: inMetadataSection },
  );

  const breadcrumbItems = [
    { label: "Blueprints" },
    {
      label: baseBlueprintId ? "Duplicate" : "Create",
      active: true,
    },
  ];

  if (screenState === "loading-base") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Loading base blueprint..." />
      </>
    );
  }

  if (screenState === "creating") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Creating blueprint..." />
      </>
    );
  }

  if (screenState === "error") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <ErrorMessage
          message="Failed to create blueprint"
          error={error ?? undefined}
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

  // Render metadata section
  const renderMetadata = (isActive: boolean) => {
    if (!inMetadataSection) {
      return (
        <Box flexDirection="column" marginBottom={0}>
          <Box>
            <Text color={isActive ? colors.primary : colors.textDim}>
              {isActive ? figures.pointer : " "} Metadata (optional):{" "}
            </Text>
            <Text color={colors.text}>
              {Object.keys(formData.metadata).length > 0
                ? `${Object.keys(formData.metadata).length} item(s)`
                : "None"}
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

    const metadataKeys = Object.keys(formData.metadata);
    const maxIndex = metadataKeys.length + 1;

    return (
      <Box
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

        {metadataInputMode && (
          <Box
            flexDirection="column"
            marginTop={1}
            borderStyle="single"
            borderColor={
              selectedMetadataIndex === 0 ? colors.success : colors.warning
            }
            paddingX={1}
          >
            <Text
              color={
                selectedMetadataIndex === 0 ? colors.success : colors.warning
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

        {!metadataInputMode && (
          <>
            <Box marginTop={1}>
              <Text
                color={
                  selectedMetadataIndex === 0 ? colors.primary : colors.textDim
                }
              >
                {selectedMetadataIndex === 0 ? figures.pointer : " "}{" "}
              </Text>
              <Text
                color={
                  selectedMetadataIndex === 0 ? colors.success : colors.textDim
                }
                bold={selectedMetadataIndex === 0}
              >
                + Add new metadata
              </Text>
            </Box>

            {metadataKeys.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                {metadataKeys.map((key, index) => {
                  const itemIndex = index + 1;
                  const isSelected = selectedMetadataIndex === itemIndex;
                  return (
                    <Box key={key}>
                      <Text
                        color={isSelected ? colors.primary : colors.textDim}
                      >
                        {isSelected ? figures.pointer : " "}{" "}
                      </Text>
                      <Text
                        color={isSelected ? colors.primary : colors.textDim}
                        bold={isSelected}
                      >
                        {key}: {formData.metadata[key]}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}

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
  };

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />

      <Box
        borderStyle="round"
        borderColor={colors.info}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <Text color={colors.info}>
          {figures.info} <Text bold>Note:</Text>{" "}
          {baseBlueprintId
            ? "Duplicating blueprint. Modify fields as needed."
            : "Create a new blueprint. Provide a Dockerfile or base blueprint."}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {visibleFields.map((field, idx) => {
          const isActive = activeFieldIndex === idx;

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
            let value = "";
            let placeholder = "";
            if (field.key === "name") {
              value = formData.name;
              placeholder = "my-blueprint";
            } else if (field.key === "dockerfile") {
              value = formData.dockerfile;
              placeholder = "FROM ubuntu:22.04";
            } else if (field.key === "baseBlueprintId") {
              value = formData.baseBlueprintId;
              placeholder = "bpt_... or blueprint-name";
            }

            const hasError =
              field.key === "name" && validationError === "Name is required";

            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={value}
                onChange={(newValue) => {
                  if (field.key === "name") {
                    setFormData((prev) => ({ ...prev, name: newValue }));
                  } else if (field.key === "dockerfile") {
                    setFormData((prev) => ({ ...prev, dockerfile: newValue }));
                  } else if (field.key === "baseBlueprintId") {
                    setFormData((prev) => ({
                      ...prev,
                      baseBlueprintId: newValue,
                    }));
                  }
                  if (validationError) setValidationError(null);
                }}
                onSubmit={handleSubmit}
                isActive={isActive}
                placeholder={placeholder}
                error={hasError ? validationError : undefined}
              />
            );
          }

          if (field.type === "select") {
            if (field.key === "sourceType") {
              return (
                <FormSelect
                  key={field.key}
                  label={field.label}
                  value={formData.sourceType}
                  options={SOURCE_TYPE_OPTIONS}
                  onChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      sourceType: v as SourceType,
                    }))
                  }
                  isActive={isActive}
                />
              );
            }
            if (field.key === "architecture") {
              return (
                <FormSelect
                  key={field.key}
                  label={field.label}
                  value={formData.architecture || "x86_64"}
                  options={ARCHITECTURE_OPTIONS}
                  onChange={(v) =>
                    setFormData((prev) => ({ ...prev, architecture: v }))
                  }
                  isActive={isActive}
                />
              );
            }
            if (field.key === "resources") {
              return (
                <FormSelect
                  key={field.key}
                  label={field.label}
                  value={formData.resources || "SMALL"}
                  options={RESOURCE_OPTIONS}
                  onChange={(v) =>
                    setFormData((prev) => ({ ...prev, resources: v }))
                  }
                  isActive={isActive}
                />
              );
            }
          }

          if (field.type === "list") {
            return (
              <FormListManager
                key={field.key}
                title={field.label}
                items={formData.systemSetupCommands}
                onItemsChange={(items) =>
                  setFormData((prev) => ({
                    ...prev,
                    systemSetupCommands: items,
                  }))
                }
                isActive={isActive}
                isExpanded={setupExpanded}
                onExpandedChange={setSetupExpanded}
                itemPlaceholder="apt-get install -y ..."
                addLabel="+ Add command"
                collapsedLabel="command(s)"
              />
            );
          }

          if (field.type === "metadata") {
            return (
              <React.Fragment key={field.key}>
                {renderMetadata(isActive)}
              </React.Fragment>
            );
          }

          return null;
        })}
      </Box>

      {!setupExpanded && !inMetadataSection && (
        <NavigationTips
          showArrows
          tips={[
            { key: "Enter", label: "Create" },
            { key: "Ctrl+S", label: "Submit" },
            { key: "q", label: "Cancel" },
          ]}
        />
      )}
    </>
  );
};
