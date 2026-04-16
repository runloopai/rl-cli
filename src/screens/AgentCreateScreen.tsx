/**
 * AgentCreateScreen - Screen wrapper for agent creation
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  createAgent,
  type CreateAgentOptions,
} from "../services/agentService.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

type SourceType = "npm" | "pip" | "git" | "object";
type FormField =
  | "name"
  | "version"
  | "sourceType"
  | "packageName"
  | "registryUrl"
  | "repository"
  | "ref"
  | "objectId"
  | "confirm";

interface FormData {
  name: string;
  version: string;
  sourceType: SourceType;
  packageName: string;
  registryUrl: string;
  repository: string;
  ref: string;
  objectId: string;
}

const SOURCE_TYPES: SourceType[] = ["npm", "pip", "git", "object"];

const fieldOrder: FormField[] = [
  "name",
  "version",
  "sourceType",
  "packageName",
  "registryUrl",
  "repository",
  "ref",
  "objectId",
  "confirm",
];
const getFieldOrder = (f: FormField) => fieldOrder.indexOf(f);

export function AgentCreateScreen() {
  const { goBack, navigate } = useNavigation();
  useExitOnCtrlC();

  const [currentField, setCurrentField] = React.useState<FormField>("name");
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    version: "",
    sourceType: "npm",
    packageName: "",
    registryUrl: "",
    repository: "",
    ref: "",
    objectId: "",
  });
  const [sourceTypeIndex, setSourceTypeIndex] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [createdAgentId, setCreatedAgentId] = React.useState<string>("");

  const getNextField = (): FormField | null => {
    switch (currentField) {
      case "name":
        return "version";
      case "version":
        return "sourceType";
      case "sourceType": {
        const st = SOURCE_TYPES[sourceTypeIndex];
        if (st === "npm" || st === "pip") return "packageName";
        if (st === "git") return "repository";
        if (st === "object") return "objectId";
        return "confirm";
      }
      case "packageName":
        return "registryUrl";
      case "registryUrl":
        return "confirm";
      case "repository":
        return "ref";
      case "ref":
        return "confirm";
      case "objectId":
        return "confirm";
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    setCreating(true);
    setError(null);
    try {
      const st = SOURCE_TYPES[sourceTypeIndex];
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
        version: formData.version,
        source,
      });

      setCreatedAgentId(agent.id);
      setSuccess(true);
    } catch (err) {
      setError(err as Error);
      setCreating(false);
    }
  };

  useInput(
    (input, key) => {
      if (success) {
        if (key.return) {
          navigate("agent-detail", { agentId: createdAgentId });
        } else if (key.escape) {
          goBack();
        }
        return;
      }

      if (error) {
        if (key.return || key.escape) {
          setError(null);
        }
        return;
      }

      if (creating) return;

      if (key.escape) {
        goBack();
        return;
      }

      if (currentField === "sourceType") {
        if (key.upArrow && sourceTypeIndex > 0) {
          setSourceTypeIndex(sourceTypeIndex - 1);
        } else if (key.downArrow && sourceTypeIndex < SOURCE_TYPES.length - 1) {
          setSourceTypeIndex(sourceTypeIndex + 1);
        } else if (key.return) {
          setFormData({
            ...formData,
            sourceType: SOURCE_TYPES[sourceTypeIndex],
          });
          const next = getNextField();
          if (next) setCurrentField(next);
        }
        return;
      }

      if (currentField === "confirm") {
        if (key.return) {
          handleSubmit();
        }
        return;
      }

      if (key.return) {
        const next = getNextField();
        if (next) setCurrentField(next);
      }
    },
    { isActive: !creating },
  );

  if (creating && !success && !error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Create", active: true }]}
        />
        <SpinnerComponent message="Creating agent..." />
      </>
    );
  }

  if (success) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Created", active: true }]}
        />
        <SuccessMessage
          message={`Agent "${formData.name}" created successfully (${createdAgentId})`}
        />
        <Box marginTop={1} paddingX={2}>
          <Text color={colors.textDim}>
            Press [Enter] to view details or [Esc] to go back
          </Text>
        </Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Agents" }, { label: "Create", active: true }]}
        />
        <ErrorMessage message="Failed to create agent" error={error} />
        <Box marginTop={1} paddingX={2}>
          <Text color={colors.textDim}>
            Press [Enter] or [Esc] to try again
          </Text>
        </Box>
      </>
    );
  }

  const renderField = (
    field: FormField,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => {
    const isActive = currentField === field;
    const isCompleted = getFieldOrder(currentField) > getFieldOrder(field);
    return (
      <Box key={field}>
        <Text
          color={
            isActive
              ? colors.primary
              : isCompleted
                ? colors.success
                : colors.textDim
          }
        >
          {isActive ? figures.pointer : isCompleted ? figures.tick : " "}
        </Text>
        <Text> </Text>
        <Text color={isActive ? colors.text : colors.textDim} bold={isActive}>
          {label}:{" "}
        </Text>
        {isActive ? (
          <TextInput
            value={value}
            onChange={onChange}
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
        ) : (
          <Text color={isCompleted ? colors.text : colors.textDim}>
            {value || "-"}
          </Text>
        )}
      </Box>
    );
  };

  const st = SOURCE_TYPES[sourceTypeIndex];

  return (
    <Box flexDirection="column">
      <Breadcrumb
        items={[{ label: "Agents" }, { label: "Create", active: true }]}
      />

      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <Text color={colors.primary} bold>
          Create Agent
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {renderField("name", "Name", formData.name, (v) =>
            setFormData({ ...formData, name: v }),
          )}
          {renderField("version", "Version", formData.version, (v) =>
            setFormData({ ...formData, version: v }),
          )}

          {/* Source type selector */}
          {getFieldOrder(currentField) >= getFieldOrder("sourceType") && (
            <Box flexDirection="column">
              <Box>
                <Text
                  color={
                    currentField === "sourceType"
                      ? colors.primary
                      : getFieldOrder(currentField) >
                          getFieldOrder("sourceType")
                        ? colors.success
                        : colors.textDim
                  }
                >
                  {currentField === "sourceType"
                    ? figures.pointer
                    : getFieldOrder(currentField) > getFieldOrder("sourceType")
                      ? figures.tick
                      : " "}
                </Text>
                <Text> </Text>
                <Text
                  color={
                    currentField === "sourceType" ? colors.text : colors.textDim
                  }
                  bold={currentField === "sourceType"}
                >
                  Source Type:{" "}
                </Text>
                {currentField !== "sourceType" && (
                  <Text>{SOURCE_TYPES[sourceTypeIndex]}</Text>
                )}
              </Box>
              {currentField === "sourceType" && (
                <Box flexDirection="column" marginLeft={4}>
                  {SOURCE_TYPES.map((s, i) => (
                    <Box key={s}>
                      <Text
                        color={
                          i === sourceTypeIndex
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {i === sourceTypeIndex
                          ? figures.radioOn
                          : figures.radioOff}
                      </Text>
                      <Text
                        color={
                          i === sourceTypeIndex ? colors.text : colors.textDim
                        }
                      >
                        {" "}
                        {s}
                      </Text>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Source-specific fields */}
          {getFieldOrder(currentField) > getFieldOrder("sourceType") && (
            <>
              {(st === "npm" || st === "pip") &&
                renderField(
                  "packageName",
                  "Package Name",
                  formData.packageName,
                  (v) => setFormData({ ...formData, packageName: v }),
                )}
              {(st === "npm" || st === "pip") &&
                getFieldOrder(currentField) >= getFieldOrder("registryUrl") &&
                renderField(
                  "registryUrl",
                  "Registry URL (optional)",
                  formData.registryUrl,
                  (v) => setFormData({ ...formData, registryUrl: v }),
                )}
              {st === "git" &&
                renderField(
                  "repository",
                  "Repository URL",
                  formData.repository,
                  (v) => setFormData({ ...formData, repository: v }),
                )}
              {st === "git" &&
                getFieldOrder(currentField) >= getFieldOrder("ref") &&
                renderField("ref", "Ref (optional)", formData.ref, (v) =>
                  setFormData({ ...formData, ref: v }),
                )}
              {st === "object" &&
                renderField("objectId", "Object ID", formData.objectId, (v) =>
                  setFormData({ ...formData, objectId: v }),
                )}
            </>
          )}

          {/* Confirm */}
          {currentField === "confirm" && (
            <Box marginTop={1}>
              <Text color={colors.success} bold>
                {figures.pointer} Press [Enter] to create agent
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      <NavigationTips
        paddingX={2}
        tips={[
          {
            key: "Enter",
            label: currentField === "confirm" ? "Create" : "Next",
          },
          { key: "Esc", label: "Cancel" },
        ]}
      />
    </Box>
  );
}
