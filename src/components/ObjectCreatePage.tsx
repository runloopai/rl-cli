/**
 * ObjectCreatePage - Form for creating a new storage object
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { readFile, lstat } from "fs/promises";
import { resolve } from "path";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SuccessMessage } from "./SuccessMessage.js";
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
import { copyToClipboard } from "../utils/clipboard.js";
import { createTarBuffer } from "../commands/object/upload.js";
import {
  createObject,
  completeObject,
  uploadToPresignedUrl,
} from "../services/objectService.js";

interface ObjectCreatePageProps {
  onBack: () => void;
  onCreate?: (objectId: string) => void;
}

type FormField = "submit" | "name" | "content_type" | "file_path" | "metadata";
type ScreenState =
  | "form"
  | "creating"
  | "uploading"
  | "show-url"
  | "success"
  | "error";

interface FormData {
  name: string;
  content_type: "unspecified" | "text" | "binary" | "gzip" | "tar" | "tgz";
  file_path: string;
  file_paths: string[];
  metadata: Record<string, string>;
}

const CONTENT_TYPE_OPTIONS = [
  "unspecified",
  "text",
  "binary",
  "gzip",
  "tar",
  "tgz",
] as const;

export const ObjectCreatePage = ({
  onBack,
  onCreate,
}: ObjectCreatePageProps) => {
  const [currentField, setCurrentField] = React.useState<FormField>("submit");
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    content_type: "unspecified",
    file_path: "",
    file_paths: [],
    metadata: {},
  });
  const [filePathsExpanded, setFilePathsExpanded] = React.useState(false);
  const [screenState, setScreenState] = React.useState<ScreenState>("form");
  const [uploadUrl, setUploadUrl] = React.useState<string>("");
  const [objectId, setObjectId] = React.useState<string>("");
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = React.useState<string>("");
  const [metadataKey, setMetadataKey] = React.useState("");
  const [metadataValue, setMetadataValue] = React.useState("");
  const [inMetadataSection, setInMetadataSection] = React.useState(false);
  const [metadataInputMode, setMetadataInputMode] = React.useState<
    "key" | "value" | null
  >(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = React.useState(0);

  const isTarType =
    formData.content_type === "tar" || formData.content_type === "tgz";

  const fields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "action" | "list" | "metadata";
  }> = [
    { key: "submit", label: "Create Object", type: "action" },
    { key: "name", label: "Name (required)", type: "text" },
    { key: "content_type", label: "Content Type", type: "select" },
    {
      key: "file_path",
      label: isTarType ? "File Path(s)" : "File Path",
      type: isTarType ? "list" : "text",
    },
    { key: "metadata", label: "Metadata (optional)", type: "metadata" },
  ];

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Hook for content_type select navigation
  const handleSelectInput = useFormSelectNavigation(
    formData.content_type,
    CONTENT_TYPE_OPTIONS,
    (newValue) => {
      const wasTar =
        formData.content_type === "tar" || formData.content_type === "tgz";
      const willBeTar = newValue === "tar" || newValue === "tgz";

      if (!wasTar && willBeTar) {
        setFormData((prev) => {
          const paths = [...prev.file_paths];
          if (prev.file_path.trim()) {
            paths[0] = prev.file_path.trim();
          }
          return { ...prev, content_type: newValue, file_paths: paths };
        });
      } else if (wasTar && !willBeTar) {
        setFilePathsExpanded(false);
        setFormData((prev) => ({
          ...prev,
          content_type: newValue,
          file_path: prev.file_paths[0] || prev.file_path,
        }));
      } else {
        setFormData((prev) => ({ ...prev, content_type: newValue }));
      }
    },
    currentField === "content_type",
  );

  // Main form input handler - active when not in file paths expanded mode
  useInput(
    (input, key) => {
      // Handle show-url screen
      if (screenState === "show-url") {
        if (input === "c") {
          // Copy URL to clipboard
          copyToClipboard(uploadUrl).then((message) => {
            setStatusMessage(message);
          });
          return;
        } else if (key.return) {
          // Navigate to detail
          if (onCreate && objectId) {
            onCreate(objectId);
          } else {
            onBack();
          }
          return;
        } else if (input === "q" || key.escape) {
          onBack();
          return;
        }
      }

      // Handle success screen
      if (screenState === "success") {
        if (input === "q" || key.escape || key.return) {
          if (onCreate && objectId) {
            onCreate(objectId);
          } else {
            onBack();
          }
        }
        return;
      }

      // Handle error screen
      if (screenState === "error") {
        if (input === "r" || key.return) {
          // Retry - clear error and return to form
          setError(null);
          setScreenState("form");
        } else if (input === "q" || key.escape) {
          // Quit - go back to list
          onBack();
        }
        return;
      }

      // Handle submitting/uploading states
      if (screenState === "creating" || screenState === "uploading") {
        return;
      }

      // Only handle form input when in form state
      if (screenState !== "form") {
        return;
      }

      // Select field navigation with left/right arrows
      if (handleSelectInput(input, key)) {
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

      // Handle Enter on file_path field to expand list manager (tar/tgz only)
      if (currentField === "file_path" && isTarType && key.return) {
        setFilePathsExpanded(true);
        return;
      }

      // Handle Enter on metadata field to expand metadata section
      if (currentField === "metadata" && key.return) {
        setInMetadataSection(true);
        setSelectedMetadataIndex(0);
        return;
      }

      // Handle Enter on any field to submit
      if (key.return) {
        handleSubmit();
        return;
      }

      // Navigation between fields (up/down arrows and tab/shift+tab)
      if (key.upArrow || (key.tab && key.shift)) {
        const nextIdx = currentFieldIndex - 1;
        if (nextIdx >= 0) {
          setCurrentField(fields[nextIdx].key);
        }
        return;
      }

      if (key.downArrow || (key.tab && !key.shift)) {
        const nextIdx = currentFieldIndex + 1;
        if (nextIdx < fields.length) {
          setCurrentField(fields[nextIdx].key);
        }
        return;
      }
    },
    { isActive: !filePathsExpanded && !inMetadataSection },
  );

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
          setMetadataKey("");
          setMetadataValue("");
          setMetadataInputMode(null);
        } else if (
          selectedMetadataIndex >= 1 &&
          selectedMetadataIndex <= metadataKeys.length
        ) {
          const keyToEdit = metadataKeys[selectedMetadataIndex - 1];
          setMetadataKey(keyToEdit || "");
          setMetadataValue(formData.metadata[keyToEdit] || "");
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
        const keyToDelete = metadataKeys[selectedMetadataIndex - 1];
        const newMetadata = { ...formData.metadata };
        delete newMetadata[keyToDelete];
        setFormData({ ...formData, metadata: newMetadata });
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

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      setValidationError("Name is required");
      setCurrentField("name");
      return;
    }

    const isTar =
      formData.content_type === "tar" || formData.content_type === "tgz";
    const paths = isTar
      ? formData.file_paths.filter((p) => p.trim().length > 0)
      : formData.file_path.trim()
        ? [formData.file_path.trim()]
        : [];

    setError(null);
    setValidationError(null);

    try {
      let currentObjectId = objectId;
      let currentUploadUrl = uploadUrl;

      if (!currentObjectId) {
        setScreenState("creating");
        const result = await createObject({
          name: formData.name.trim(),
          content_type: formData.content_type,
          metadata:
            Object.keys(formData.metadata).length > 0
              ? formData.metadata
              : undefined,
        });
        currentObjectId = result.id;
        currentUploadUrl = result.upload_url;
        setObjectId(result.id);
        setUploadUrl(result.upload_url);
      }

      if (paths.length > 0) {
        setScreenState("uploading");

        const resolvedPaths = paths.map((p) => resolve(p));

        let buffer: Buffer;

        if (paths.length > 1 || isTar) {
          const isGzip = formData.content_type === "tgz";
          buffer = await createTarBuffer(resolvedPaths, isGzip);
        } else {
          const filePath = resolvedPaths[0];
          const stats = await lstat(filePath);

          if (stats.isDirectory()) {
            throw new Error(
              "Cannot upload directory directly. Use tar or tgz content type for directories.",
            );
          }

          if (stats.isSymbolicLink()) {
            throw new Error(
              "Cannot upload symbolic links directly. Resolve the symlink first.",
            );
          }

          buffer = await readFile(filePath);
        }

        await uploadToPresignedUrl(currentUploadUrl, buffer);
        await completeObject(currentObjectId);

        setScreenState("success");
      } else {
        setScreenState("show-url");
      }
    } catch (err) {
      setError(err as Error);
      setScreenState("error");
    }
  };

  const breadcrumbItems = [
    { label: "Agents & Objects" },
    { label: "Objects" },
    { label: "Create", active: true },
  ];

  // Show-url screen
  if (screenState === "show-url") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SuccessMessage message="Object created successfully!" />
        <Box marginLeft={2} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={colors.textDim} dimColor>
              ID:{" "}
            </Text>
            <Text color={colors.idColor}>{objectId}</Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              Name: {formData.name}
            </Text>
          </Box>
        </Box>
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text color={colors.info}>
            {figures.info} Upload your file using this pre-signed URL:
          </Text>
          <Box
            marginTop={1}
            flexDirection="column"
            paddingX={1}
            borderStyle="round"
            borderColor={colors.info}
          >
            <Text color={colors.text} wrap="truncate-end">
              {uploadUrl}
            </Text>
          </Box>
          {statusMessage && (
            <Box marginTop={1}>
              <Text color={colors.success}>{statusMessage}</Text>
            </Box>
          )}
        </Box>
        <NavigationTips
          tips={[
            { key: "c", label: "Copy URL" },
            { key: "Enter", label: "View details" },
            { key: "q/esc", label: "Back" },
          ]}
        />
      </>
    );
  }

  // Success screen
  if (screenState === "success") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SuccessMessage message="Object created and uploaded successfully!" />
        <Box marginLeft={2} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={colors.textDim} dimColor>
              ID:{" "}
            </Text>
            <Text color={colors.idColor}>{objectId}</Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              Name: {formData.name}
            </Text>
          </Box>
        </Box>
        <NavigationTips
          tips={[{ key: "Enter/q/esc", label: "View object details" }]}
        />
      </>
    );
  }

  // Error screen
  if (screenState === "error") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <ErrorMessage
          message="Failed to create object"
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

  // Creating/Uploading screens
  if (screenState === "creating") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Creating object..." />
      </>
    );
  }

  if (screenState === "uploading") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Uploading file..." />
      </>
    );
  }

  // Form screen
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
          {figures.info} <Text bold>Note:</Text> Create a storage object.
          Optionally add file path(s) to upload immediately, or upload later
          using the pre-signed URL.
        </Text>
      </Box>

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
            const hasError =
              field.key === "name" && validationError === "Name is required";

            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={value}
                onChange={(newValue) => {
                  setFormData({ ...formData, [field.key]: newValue });
                  if (validationError) {
                    setValidationError(null);
                  }
                }}
                onSubmit={handleSubmit}
                isActive={isActive}
                placeholder={
                  field.key === "file_path"
                    ? "/path/to/file (optional)"
                    : "my-object"
                }
                error={hasError ? validationError : undefined}
              />
            );
          }

          if (field.type === "select") {
            return (
              <FormSelect
                key={field.key}
                label={field.label}
                value={formData.content_type}
                options={CONTENT_TYPE_OPTIONS}
                onChange={(newValue) => {
                  setFormData((prev) => ({ ...prev, content_type: newValue }));
                }}
                isActive={isActive}
              />
            );
          }

          if (field.type === "list") {
            return (
              <FormListManager
                key={field.key}
                title={field.label}
                items={formData.file_paths}
                onItemsChange={(items) =>
                  setFormData({ ...formData, file_paths: items })
                }
                isActive={isActive}
                isExpanded={filePathsExpanded}
                onExpandedChange={setFilePathsExpanded}
                itemPlaceholder="/path/to/file"
                addLabel="+ Add file path"
                collapsedLabel="file path(s)"
              />
            );
          }

          if (field.type === "metadata") {
            if (!inMetadataSection) {
              return (
                <Box key={field.key} flexDirection="column" marginBottom={0}>
                  <Box>
                    <Text color={isActive ? colors.primary : colors.textDim}>
                      {isActive ? figures.pointer : " "} {field.label}:{" "}
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

                {!metadataInputMode && (
                  <>
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

                    {metadataKeys.length > 0 && (
                      <Box flexDirection="column" marginTop={1}>
                        {metadataKeys.map((key, index) => {
                          const itemIndex = index + 1;
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
          }

          return null;
        })}
      </Box>

      {!filePathsExpanded && !inMetadataSection && (
        <NavigationTips
          showArrows
          tips={[
            { key: "Enter", label: isTarType ? "Create/Expand" : "Create" },
            { key: "q", label: "Cancel" },
          ]}
        />
      )}
    </>
  );
};
