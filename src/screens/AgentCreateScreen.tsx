/**
 * AgentCreateScreen - Form for creating a new agent
 *
 * Uses the standard form pattern: all visible fields with arrow key navigation,
 * left/right to change source type, Enter on Create button to submit.
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  createAgent,
  type CreateAgentOptions,
} from "../services/agentService.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import {
  FormTextInput,
  FormSelect,
  FormActionButton,
  useFormSelectNavigation,
} from "../components/form/index.js";
import { ObjectPicker } from "../components/ObjectPicker.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

const SOURCE_TYPES = ["npm", "pip", "git", "object"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

type AgentFormField =
  | "name"
  | "version"
  | "sourceType"
  | "packageName"
  | "registryUrl"
  | "repository"
  | "ref"
  | "objectId"
  | "create";

interface FieldDef {
  key: AgentFormField;
  label: string;
}

/** Fields that are always shown */
const baseFields: FieldDef[] = [
  { key: "name", label: "Name (required)" },
  { key: "sourceType", label: "Source Type" },
];

/** Source-type-specific fields */
const sourceFields: Record<SourceType, FieldDef[]> = {
  npm: [
    { key: "version", label: "Version (optional)" },
    { key: "packageName", label: "Package Name (required)" },
    { key: "registryUrl", label: "Registry URL (optional)" },
  ],
  pip: [
    { key: "version", label: "Version (optional)" },
    { key: "packageName", label: "Package Name (required)" },
    { key: "registryUrl", label: "Registry URL (optional)" },
  ],
  git: [
    { key: "version", label: "Version (optional)" },
    { key: "repository", label: "Repository URL (required)" },
    { key: "ref", label: "Ref (optional)" },
  ],
  object: [{ key: "objectId", label: "Object ID (required)" }],
};

const createButton: FieldDef = { key: "create", label: "Create Agent" };

function getVisibleFields(sourceType: SourceType): FieldDef[] {
  return [...baseFields, ...sourceFields[sourceType], createButton];
}

export function AgentCreateScreen() {
  const { goBack, navigate } = useNavigation();
  useExitOnCtrlC();

  const [currentField, setCurrentField] =
    React.useState<AgentFormField>("name");
  const [formData, setFormData] = React.useState({
    name: "",
    version: "",
    sourceType: "npm" as SourceType,
    packageName: "",
    registryUrl: "",
    repository: "",
    ref: "",
    objectId: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [success, setSuccess] = React.useState(false);
  const [createdAgentId, setCreatedAgentId] = React.useState("");
  const [showObjectPicker, setShowObjectPicker] = React.useState(false);

  const fields = getVisibleFields(formData.sourceType);
  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // When source type changes, clear source-specific fields and ensure
  // currentField is still valid (it may have been a field from the old type)
  const handleSourceTypeChange = React.useCallback(
    (newType: SourceType) => {
      setFormData((prev) => ({
        ...prev,
        sourceType: newType,
        packageName: "",
        registryUrl: "",
        repository: "",
        ref: "",
        objectId: "",
      }));
      // If current field isn't in the new field set, stay on sourceType
      const newFields = getVisibleFields(newType);
      if (!newFields.some((f) => f.key === currentField)) {
        setCurrentField("sourceType");
      }
    },
    [currentField],
  );

  const handleSourceTypeNav = useFormSelectNavigation(
    formData.sourceType,
    SOURCE_TYPES,
    handleSourceTypeChange,
    currentField === "sourceType",
  );

  const handleSubmit = async () => {
    setValidationError(null);

    if (!formData.name.trim()) {
      setValidationError("Name is required");
      setCurrentField("name");
      return;
    }
    const st = formData.sourceType;

    if ((st === "npm" || st === "pip") && !formData.packageName.trim()) {
      setValidationError("Package name is required");
      setCurrentField("packageName");
      return;
    }
    if (st === "git" && !formData.repository.trim()) {
      setValidationError("Repository URL is required");
      setCurrentField("repository");
      return;
    }
    if (st === "object" && !formData.objectId.trim()) {
      setValidationError("Object ID is required");
      setCurrentField("objectId");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let source: CreateAgentOptions["source"];
      if (st === "npm") {
        source = {
          type: "npm",
          npm: {
            package_name: formData.packageName,
            registry_url: formData.registryUrl || undefined,
          },
        };
      } else if (st === "pip") {
        source = {
          type: "pip",
          pip: {
            package_name: formData.packageName,
            registry_url: formData.registryUrl || undefined,
          },
        };
      } else if (st === "git") {
        source = {
          type: "git",
          git: {
            repository: formData.repository,
            ref: formData.ref || undefined,
          },
        };
      } else {
        source = {
          type: "object",
          object: { object_id: formData.objectId },
        };
      }

      const agent = await createAgent({
        name: formData.name,
        ...(formData.version.trim()
          ? { version: formData.version.trim() }
          : {}),
        source,
      });

      setCreatedAgentId(agent.id);
      setSubmitting(false);
      setSuccess(true);
    } catch (err) {
      setError(err as Error);
      setSubmitting(false);
    }
  };

  useInput(
    (_input, key) => {
      if (success) {
        if (key.return) {
          navigate("agent-detail", { agentId: createdAgentId });
        } else if (key.escape) {
          navigate("agent-list");
        }
        return;
      }

      if (key.escape) {
        goBack();
        return;
      }

      // Source type left/right navigation
      if (handleSourceTypeNav(_input, key)) return;

      // Arrow up/down field navigation
      if (key.upArrow && currentFieldIndex > 0) {
        setCurrentField(fields[currentFieldIndex - 1].key);
        setValidationError(null);
        return;
      }
      if (key.downArrow && currentFieldIndex < fields.length - 1) {
        setCurrentField(fields[currentFieldIndex + 1].key);
        setValidationError(null);
        return;
      }

      // Enter on create button submits
      if (key.return && currentField === "create") {
        handleSubmit();
        return;
      }

      // Enter on objectId field opens object picker when empty
      if (
        key.return &&
        currentField === "objectId" &&
        formData.sourceType === "object" &&
        !formData.objectId
      ) {
        setShowObjectPicker(true);
        return;
      }
    },
    { isActive: !submitting && !showObjectPicker },
  );

  // Object picker for selecting object source
  if (showObjectPicker) {
    return (
      <ObjectPicker
        mode="single"
        title="Select Object"
        breadcrumbItems={[
          { label: "Agents" },
          { label: "Create" },
          { label: "Select Object", active: true },
        ]}
        onSelect={(objects) => {
          if (objects.length > 0) {
            setFormData((prev) => ({ ...prev, objectId: objects[0].id }));
          }
          setShowObjectPicker(false);
        }}
        onCancel={() => setShowObjectPicker(false)}
        initialSelected={formData.objectId ? [formData.objectId] : []}
      />
    );
  }

  // Submitting spinner
  if (submitting) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Create", active: true }]}
        />
        <SpinnerComponent message="Creating agent..." />
      </>
    );
  }

  // Success screen
  if (success) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Created", active: true }]}
        />
        <SuccessMessage
          message={`Agent "${formData.name}" created successfully (${createdAgentId})`}
        />
        <NavigationTips
          tips={[
            { key: "Enter", label: "View details" },
            { key: "Esc", label: "Back to list" },
          ]}
        />
      </>
    );
  }

  // Determine which field has a validation error
  const fieldError = (key: AgentFormField): string | undefined => {
    if (!validationError) return undefined;
    if (currentField === key) return validationError;
    return undefined;
  };

  return (
    <Box flexDirection="column">
      <Breadcrumb
        items={[{ label: "Agents" }, { label: "Create", active: true }]}
      />

      {/* Server error banner */}
      {error && (
        <Box paddingX={2} marginTop={1}>
          <Text color={colors.error}>
            {figures.cross} {error.message}
          </Text>
        </Box>
      )}

      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <Text color={colors.primary} bold>
          Create Agent
        </Text>
        <Box flexDirection="column" marginTop={1}>
          <FormTextInput
            label="Name"
            value={formData.name}
            onChange={(v) => setFormData({ ...formData, name: v })}
            isActive={currentField === "name"}
            placeholder="Enter agent name..."
            error={fieldError("name")}
          />
          <FormSelect
            label="Source Type"
            value={formData.sourceType}
            options={SOURCE_TYPES}
            onChange={handleSourceTypeChange}
            isActive={currentField === "sourceType"}
          />

          {/* Source-specific fields */}
          {(formData.sourceType === "npm" || formData.sourceType === "pip") && (
            <>
              <FormTextInput
                label="Version"
                value={formData.version}
                onChange={(v) => setFormData({ ...formData, version: v })}
                isActive={currentField === "version"}
                placeholder="(optional) e.g. 1.0.0"
                error={fieldError("version")}
              />
              <FormTextInput
                label="Package Name"
                value={formData.packageName}
                onChange={(v) => setFormData({ ...formData, packageName: v })}
                isActive={currentField === "packageName"}
                placeholder="e.g. @scope/my-agent"
                error={fieldError("packageName")}
              />
              <FormTextInput
                label="Registry URL"
                value={formData.registryUrl}
                onChange={(v) => setFormData({ ...formData, registryUrl: v })}
                isActive={currentField === "registryUrl"}
                placeholder="(optional)"
              />
            </>
          )}
          {formData.sourceType === "git" && (
            <>
              <FormTextInput
                label="Version"
                value={formData.version}
                onChange={(v) => setFormData({ ...formData, version: v })}
                isActive={currentField === "version"}
                placeholder="(optional) e.g. branch or tag"
                error={fieldError("version")}
              />
              <FormTextInput
                label="Repository URL"
                value={formData.repository}
                onChange={(v) => setFormData({ ...formData, repository: v })}
                isActive={currentField === "repository"}
                placeholder="e.g. https://github.com/org/repo"
                error={fieldError("repository")}
              />
              <FormTextInput
                label="Ref"
                value={formData.ref}
                onChange={(v) => setFormData({ ...formData, ref: v })}
                isActive={currentField === "ref"}
                placeholder="(optional) branch, tag, or commit"
              />
            </>
          )}
          {formData.sourceType === "object" && (
            <FormTextInput
              label="Object ID"
              value={formData.objectId}
              onChange={(v) => setFormData({ ...formData, objectId: v })}
              isActive={currentField === "objectId"}
              placeholder="Enter object ID or press Enter to pick..."
              error={fieldError("objectId")}
            />
          )}

          <Box marginTop={1}>
            <FormActionButton
              label="Create Agent"
              isActive={currentField === "create"}
            />
          </Box>
        </Box>
      </Box>

      <NavigationTips
        paddingX={2}
        showArrows
        tips={[
          {
            key: "Enter",
            label: "Create",
            condition: currentField === "create",
          },
          { key: "Esc", label: "Cancel" },
        ]}
      />
    </Box>
  );
}
