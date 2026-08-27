import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { MetadataDisplay } from "../components/MetadataDisplay.js";
import {
  FormTextInput,
  FormSelect,
  FormActionButton,
  FormListManager,
  useFormSelectNavigation,
} from "../components/form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useNavigation } from "../store/navigationStore.js";
import { createScenario } from "../services/scenarioService.js";
import type { ScenarioCreateParams } from "@runloop/api-client/resources/scenarios/scenarios";

type ScreenState = "form" | "editing-scorer" | "creating" | "error";
type ScorerType =
  | "command_scorer"
  | "bash_script_scorer"
  | "python_script_scorer"
  | "test_based_scorer"
  | "ast_grep_scorer"
  | "custom_scorer";
type EnvironmentSource = "none" | "blueprint" | "snapshot";
type ValidationType = "UNSPECIFIED" | "FORWARD" | "REVERSE" | "EVALUATION";

const SCORER_TYPE_OPTIONS = [
  "command_scorer",
  "bash_script_scorer",
  "python_script_scorer",
  "test_based_scorer",
  "ast_grep_scorer",
  "custom_scorer",
] as const;

const ENVIRONMENT_OPTIONS = ["none", "blueprint", "snapshot"] as const;
const VALIDATION_OPTIONS = [
  "UNSPECIFIED",
  "FORWARD",
  "REVERSE",
  "EVALUATION",
] as const;

interface ScorerFormData {
  name: string;
  weight: string;
  type: ScorerType;
  command: string;
  bashScript: string;
  pythonScript: string;
  requirementsContents: string;
  testCommand: string;
  testFilePath: string;
  testFileContents: string;
  pattern: string;
  searchDirectory: string;
  lang: string;
  customScorerType: string;
  scorerParams: string;
}

const emptyScorerForm = (): ScorerFormData => ({
  name: "",
  weight: "1.0",
  type: "command_scorer",
  command: "",
  bashScript: "",
  pythonScript: "",
  requirementsContents: "",
  testCommand: "",
  testFilePath: "",
  testFileContents: "",
  pattern: "",
  searchDirectory: "",
  lang: "",
  customScorerType: "",
  scorerParams: "",
});

interface FormData {
  name: string;
  problemStatement: string;
  referenceOutput: string;
  environmentSource: EnvironmentSource;
  environmentId: string;
  workingDirectory: string;
  scorers: ScorerFormData[];
  metadata: Record<string, string>;
  requiredEnvVars: string[];
  requiredSecrets: string[];
  validationType: ValidationType;
  scorerTimeout: string;
}

type FieldKey =
  | "submit"
  | "name"
  | "problemStatement"
  | "referenceOutput"
  | "environmentSource"
  | "environmentId"
  | "workingDirectory"
  | "scorers"
  | "metadata"
  | "requiredEnvVars"
  | "requiredSecrets"
  | "validationType"
  | "scorerTimeout";

export function ScenarioCreateScreen() {
  const { goBack } = useNavigation();
  const [screenState, setScreenState] = React.useState<ScreenState>("form");
  const [activeFieldIndex, setActiveFieldIndex] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [editingScorerIndex, setEditingScorerIndex] = React.useState(-1);
  const [scorerForm, setScorerForm] =
    React.useState<ScorerFormData>(emptyScorerForm());
  const [scorerFieldIndex, setScorerFieldIndex] = React.useState(0);

  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    problemStatement: "",
    referenceOutput: "",
    environmentSource: "none",
    environmentId: "",
    workingDirectory: "",
    scorers: [{ ...emptyScorerForm(), name: "default" }],
    metadata: {},
    requiredEnvVars: [],
    requiredSecrets: [],
    validationType: "UNSPECIFIED",
    scorerTimeout: "",
  });

  // Metadata state
  const [inMetadataSection, setInMetadataSection] = React.useState(false);
  const [metadataKey, setMetadataKey] = React.useState("");
  const [metadataValue, setMetadataValue] = React.useState("");
  const [metadataInputMode, setMetadataInputMode] = React.useState<
    "key" | "value" | null
  >(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = React.useState(0);

  // List manager expansion state
  const [envVarsExpanded, setEnvVarsExpanded] = React.useState(false);
  const [secretsExpanded, setSecretsExpanded] = React.useState(false);

  useExitOnCtrlC();

  const visibleFields = React.useMemo((): Array<{
    key: FieldKey;
    label: string;
    type: "text" | "select" | "action" | "list" | "metadata" | "scorers";
  }> => {
    const f: Array<{
      key: FieldKey;
      label: string;
      type: "text" | "select" | "action" | "list" | "metadata" | "scorers";
    }> = [
      { key: "submit", label: "Create Scenario", type: "action" },
      { key: "name", label: "Name (required)", type: "text" },
      {
        key: "problemStatement",
        label: "Problem Statement (required)",
        type: "text",
      },
      { key: "referenceOutput", label: "Reference Output", type: "text" },
      { key: "environmentSource", label: "Environment", type: "select" },
    ];
    if (
      formData.environmentSource === "blueprint" ||
      formData.environmentSource === "snapshot"
    ) {
      f.push({
        key: "environmentId",
        label:
          formData.environmentSource === "blueprint"
            ? "Blueprint ID"
            : "Snapshot ID",
        type: "text",
      });
      f.push({
        key: "workingDirectory",
        label: "Working Directory",
        type: "text",
      });
    }
    f.push({ key: "scorers", label: "Scoring Functions", type: "scorers" });
    f.push({ key: "metadata", label: "Metadata (optional)", type: "metadata" });
    f.push({
      key: "requiredEnvVars",
      label: "Required Env Vars",
      type: "list",
    });
    f.push({
      key: "requiredSecrets",
      label: "Required Secrets",
      type: "list",
    });
    f.push({ key: "validationType", label: "Validation Type", type: "select" });
    f.push({
      key: "scorerTimeout",
      label: "Scorer Timeout (sec)",
      type: "text",
    });
    return f;
  }, [formData.environmentSource]);

  const activeField = visibleFields[activeFieldIndex]?.key;

  const handleEnvSourceSelect = useFormSelectNavigation(
    formData.environmentSource,
    ENVIRONMENT_OPTIONS,
    (v) =>
      setFormData((prev) => ({
        ...prev,
        environmentSource: v as EnvironmentSource,
      })),
    activeField === "environmentSource",
  );

  const handleValidationSelect = useFormSelectNavigation(
    formData.validationType,
    VALIDATION_OPTIONS,
    (v) =>
      setFormData((prev) => ({
        ...prev,
        validationType: v as ValidationType,
      })),
    activeField === "validationType",
  );

  const handleScorerTypeSelect = useFormSelectNavigation(
    scorerForm.type,
    SCORER_TYPE_OPTIONS,
    (v) => setScorerForm((prev) => ({ ...prev, type: v as ScorerType })),
    screenState === "editing-scorer" && scorerFieldIndex === 2,
  );

  const buildScorerObject = (
    s: ScorerFormData,
  ): ScenarioCreateParams["scoring_contract"]["scoring_function_parameters"][0] => {
    const weight = parseFloat(s.weight) || 1.0;
    let scorer: any;

    switch (s.type) {
      case "command_scorer":
        scorer = { type: "command_scorer" as const, command: s.command };
        break;
      case "bash_script_scorer":
        scorer = {
          type: "bash_script_scorer" as const,
          bash_script: s.bashScript,
        };
        break;
      case "python_script_scorer":
        scorer = {
          type: "python_script_scorer" as const,
          python_script: s.pythonScript,
          ...(s.requirementsContents
            ? { requirements_contents: s.requirementsContents }
            : {}),
        };
        break;
      case "test_based_scorer":
        scorer = {
          type: "test_based_scorer" as const,
          test_command: s.testCommand,
          ...(s.testFilePath
            ? {
                test_files: [
                  {
                    file_path: s.testFilePath,
                    file_contents: s.testFileContents,
                  },
                ],
              }
            : {}),
        };
        break;
      case "ast_grep_scorer":
        scorer = {
          type: "ast_grep_scorer" as const,
          pattern: s.pattern,
          search_directory: s.searchDirectory,
          ...(s.lang ? { lang: s.lang } : {}),
        };
        break;
      case "custom_scorer": {
        let parsedParams: Record<string, unknown> | undefined;
        if (s.scorerParams) {
          try {
            parsedParams = JSON.parse(s.scorerParams);
          } catch {
            throw new Error(`Invalid JSON in scorer params for "${s.name}"`);
          }
        }
        scorer = {
          type: "custom_scorer" as const,
          custom_scorer_type: s.customScorerType,
          ...(parsedParams ? { scorer_params: parsedParams } : {}),
        };
        break;
      }
    }

    return { name: s.name, weight, scorer };
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setValidationError("Name is required");
      const idx = visibleFields.findIndex((f) => f.key === "name");
      if (idx >= 0) setActiveFieldIndex(idx);
      return;
    }
    if (!formData.problemStatement.trim()) {
      setValidationError("Problem statement is required");
      const idx = visibleFields.findIndex((f) => f.key === "problemStatement");
      if (idx >= 0) setActiveFieldIndex(idx);
      return;
    }
    if (formData.scorers.length === 0) {
      setValidationError("At least one scoring function is required");
      return;
    }

    const totalWeight = formData.scorers.reduce(
      (sum, s) => sum + (parseFloat(s.weight) || 0),
      0,
    );
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      setValidationError(
        `Scoring function weights must sum to 1.0 (currently ${totalWeight.toFixed(2)})`,
      );
      return;
    }

    setError(null);
    setValidationError(null);
    setScreenState("creating");

    try {
      const params: ScenarioCreateParams = {
        name: formData.name.trim(),
        input_context: {
          problem_statement: formData.problemStatement.trim(),
        },
        scoring_contract: {
          scoring_function_parameters: formData.scorers.map(buildScorerObject),
        },
      };

      if (formData.referenceOutput.trim()) {
        params.reference_output = formData.referenceOutput.trim();
      }

      if (
        formData.environmentSource !== "none" &&
        formData.environmentId.trim()
      ) {
        params.environment_parameters = {
          ...(formData.environmentSource === "blueprint"
            ? { blueprint_id: formData.environmentId.trim() }
            : { snapshot_id: formData.environmentId.trim() }),
          ...(formData.workingDirectory.trim()
            ? { working_directory: formData.workingDirectory.trim() }
            : {}),
        };
      }

      if (Object.keys(formData.metadata).length > 0) {
        params.metadata = formData.metadata;
      }

      const envVars = formData.requiredEnvVars.filter((v) => v.trim());
      if (envVars.length > 0) {
        params.required_environment_variables = envVars;
      }

      const secrets = formData.requiredSecrets.filter((v) => v.trim());
      if (secrets.length > 0) {
        params.required_secret_names = secrets;
      }

      if (formData.scorerTimeout.trim()) {
        const timeout = parseInt(formData.scorerTimeout, 10);
        if (isNaN(timeout)) {
          setValidationError("Scorer timeout must be a number");
          setScreenState("form");
          return;
        }
        params.scorer_timeout_sec = timeout;
      }

      if (formData.validationType !== "UNSPECIFIED") {
        params.validation_type = formData.validationType;
      }

      await createScenario(params);
      goBack();
    } catch (err) {
      setError(err as Error);
      setScreenState("error");
    }
  };

  // Scorer type-specific fields
  const getScorerFields = (
    type: ScorerType,
  ): Array<{ key: string; label: string; placeholder: string }> => {
    switch (type) {
      case "command_scorer":
        return [{ key: "command", label: "Command", placeholder: "pytest -v" }];
      case "bash_script_scorer":
        return [
          {
            key: "bashScript",
            label: "Bash Script",
            placeholder: 'echo "score=1.0"',
          },
        ];
      case "python_script_scorer":
        return [
          {
            key: "pythonScript",
            label: "Python Script",
            placeholder: 'print("score=1.0")',
          },
          {
            key: "requirementsContents",
            label: "Requirements (optional)",
            placeholder: "pytest>=7.0",
          },
        ];
      case "test_based_scorer":
        return [
          {
            key: "testCommand",
            label: "Test Command",
            placeholder: "pytest tests/",
          },
          {
            key: "testFilePath",
            label: "Test File Path (optional)",
            placeholder: "tests/test_solution.py",
          },
          {
            key: "testFileContents",
            label: "Test File Contents (optional)",
            placeholder: "def test_solution(): ...",
          },
        ];
      case "ast_grep_scorer":
        return [
          { key: "pattern", label: "Pattern", placeholder: "$$$" },
          {
            key: "searchDirectory",
            label: "Search Directory",
            placeholder: "src/",
          },
          { key: "lang", label: "Language (optional)", placeholder: "python" },
        ];
      case "custom_scorer":
        return [
          {
            key: "customScorerType",
            label: "Custom Scorer Type",
            placeholder: "my_scorer",
          },
          {
            key: "scorerParams",
            label: "Scorer Params (JSON, optional)",
            placeholder: '{"key": "value"}',
          },
        ];
    }
  };

  const scorerEditorFields = React.useMemo(() => {
    const base = [
      { key: "name", label: "Scorer Name", placeholder: "default" },
      { key: "weight", label: "Weight (0-1)", placeholder: "1.0" },
      { key: "type", label: "Scorer Type", placeholder: "" },
    ];
    return [...base, ...getScorerFields(scorerForm.type)];
  }, [scorerForm.type]);

  // Scorer editor input
  useInput(
    (input, key) => {
      if (handleScorerTypeSelect(input, key)) return;

      if (key.escape || input === "q") {
        setScreenState("form");
        setEditingScorerIndex(-1);
        return;
      }

      const saveScorer = () => {
        if (!scorerForm.name.trim()) return;
        const newScorers = [...formData.scorers];
        if (editingScorerIndex >= 0 && editingScorerIndex < newScorers.length) {
          newScorers[editingScorerIndex] = { ...scorerForm };
        } else {
          newScorers.push({ ...scorerForm });
        }
        setFormData((prev) => ({ ...prev, scorers: newScorers }));
        setScreenState("form");
        setEditingScorerIndex(-1);
      };

      if (input === "s" && key.ctrl) {
        saveScorer();
        return;
      }

      if (key.return && scorerFieldIndex === scorerEditorFields.length) {
        saveScorer();
        return;
      }

      if (key.upArrow) {
        setScorerFieldIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setScorerFieldIndex((prev) =>
          Math.min(scorerEditorFields.length, prev + 1),
        );
        return;
      }
    },
    { isActive: screenState === "editing-scorer" },
  );

  // Main form input
  useInput(
    (input, key) => {
      if (screenState === "error") {
        if (input === "r" || key.return) {
          setError(null);
          setScreenState("form");
        } else if (input === "q" || key.escape) {
          goBack();
        }
        return;
      }

      if (screenState !== "form") return;

      if (handleEnvSourceSelect(input, key)) return;
      if (handleValidationSelect(input, key)) return;

      if (input === "q" || key.escape) {
        goBack();
        return;
      }

      if (input === "s" && key.ctrl) {
        handleSubmit();
        return;
      }

      if (activeField === "scorers") {
        if (key.return) {
          setScorerForm(emptyScorerForm());
          setEditingScorerIndex(formData.scorers.length);
          setScorerFieldIndex(0);
          setScreenState("editing-scorer");
          return;
        }
        const editMatch = input.match(/^e(\d+)$/);
        if (editMatch) {
          const idx = parseInt(editMatch[1], 10);
          if (idx >= 0 && idx < formData.scorers.length) {
            setScorerForm({ ...formData.scorers[idx] });
            setEditingScorerIndex(idx);
            setScorerFieldIndex(0);
            setScreenState("editing-scorer");
          }
          return;
        }
        const deleteMatch = input.match(/^d(\d+)$/);
        if (deleteMatch) {
          const idx = parseInt(deleteMatch[1], 10);
          if (idx >= 0 && idx < formData.scorers.length) {
            setFormData((prev) => ({
              ...prev,
              scorers: prev.scorers.filter((_, i) => i !== idx),
            }));
          }
          return;
        }
      }

      if (activeField === "metadata" && key.return) {
        setInMetadataSection(true);
        setSelectedMetadataIndex(0);
        return;
      }

      if (activeField === "requiredEnvVars" && key.return) {
        setEnvVarsExpanded(true);
        return;
      }

      if (activeField === "requiredSecrets" && key.return) {
        setSecretsExpanded(true);
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
    {
      isActive: !inMetadataSection && !envVarsExpanded && !secretsExpanded,
    },
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
        if (selectedMetadataIndex > Object.keys(newMetadata).length) {
          setSelectedMetadataIndex(
            Math.max(0, Object.keys(newMetadata).length),
          );
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
    { label: "Home" },
    { label: "Benchmarks" },
    { label: "Create Scenario", active: true },
  ];

  if (screenState === "creating") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Creating scenario..." />
      </>
    );
  }

  if (screenState === "error") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <ErrorMessage
          message="Failed to create scenario"
          error={error ?? undefined}
        />
        <NavigationTips
          tips={[
            {
              key: "Enter/r",
              label: "Retry",
            },
            { key: "q/esc", label: "Cancel" },
          ]}
        />
      </>
    );
  }

  // Scorer editor screen
  if (screenState === "editing-scorer") {
    return (
      <>
        <Breadcrumb
          items={[
            ...breadcrumbItems.slice(0, -1),
            {
              label:
                editingScorerIndex < formData.scorers.length
                  ? "Edit Scorer"
                  : "Add Scorer",
              active: true,
            },
          ]}
        />

        <Box flexDirection="column" marginBottom={1}>
          {scorerEditorFields.map((field, idx) => {
            const isActive = scorerFieldIndex === idx;

            if (field.key === "type") {
              return (
                <FormSelect
                  key={field.key}
                  label={field.label}
                  value={scorerForm.type}
                  options={SCORER_TYPE_OPTIONS}
                  onChange={(v) =>
                    setScorerForm((prev) => ({
                      ...prev,
                      type: v as ScorerType,
                    }))
                  }
                  isActive={isActive}
                />
              );
            }

            const value =
              (scorerForm as unknown as Record<string, string>)[field.key] ||
              "";
            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={value}
                onChange={(v) =>
                  setScorerForm((prev) => ({ ...prev, [field.key]: v }))
                }
                isActive={isActive}
                placeholder={field.placeholder}
              />
            );
          })}

          <FormActionButton
            label="Save Scorer"
            isActive={scorerFieldIndex === scorerEditorFields.length}
            hint="[Enter to save]"
          />
        </Box>

        <NavigationTips
          showArrows
          tips={[
            { key: "Enter", label: "Save" },
            { key: "Ctrl+S", label: "Save" },
            { key: "Esc", label: "Cancel" },
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
            borderColor={colors.success}
            paddingX={1}
          >
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
                <Text dimColor>Key: {metadataKey}</Text>
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
                <Text dimColor>Value: {metadataValue}</Text>
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
            {metadataKeys.map((key, index) => {
              const itemIndex = index + 1;
              const isSelected = selectedMetadataIndex === itemIndex;
              return (
                <Box key={key}>
                  <Text color={isSelected ? colors.primary : colors.textDim}>
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
              ? `[Tab] Switch • [Enter] ${metadataInputMode === "key" ? "Next" : "Save"} • [esc] Cancel`
              : `${figures.arrowUp}${figures.arrowDown} Navigate • [Enter] Select • [d] Delete • [esc] Back`}
          </Text>
        </Box>
      </Box>
    );
  };

  // Render scorers section
  const renderScorers = (isActive: boolean) => {
    return (
      <Box flexDirection="column" marginBottom={0}>
        <Box>
          <Text color={isActive ? colors.primary : colors.textDim}>
            {isActive ? figures.pointer : " "} Scoring Functions:{" "}
          </Text>
          <Text color={colors.text}>{formData.scorers.length} scorer(s)</Text>
          {isActive && (
            <Text color={colors.textDim} dimColor>
              {" "}
              [Enter to add]
            </Text>
          )}
        </Box>
        {formData.scorers.map((s, idx) => (
          <Box key={idx} marginLeft={2}>
            <Text color={colors.textDim}>
              {figures.pointer} {s.name || "(unnamed)"} ({s.type}, weight:{" "}
              {s.weight})
            </Text>
            {isActive && (
              <Text color={colors.info} dimColor>
                {" "}
                [e={idx} to edit, d={idx} to delete]
              </Text>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  // Main form
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
          {figures.info} <Text bold>Create Scenario</Text> — define a repeatable
          AI coding evaluation with environment and scoring criteria.
        </Text>
      </Box>

      {validationError && (
        <Box marginBottom={1} paddingX={1}>
          <Text color={colors.error}>
            {figures.cross} {validationError}
          </Text>
        </Box>
      )}

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
              placeholder = "my-scenario";
            } else if (field.key === "problemStatement") {
              value = formData.problemStatement;
              placeholder = "Fix the failing tests in ...";
            } else if (field.key === "referenceOutput") {
              value = formData.referenceOutput;
              placeholder = "(optional) expected output or diff";
            } else if (field.key === "environmentId") {
              value = formData.environmentId;
              placeholder =
                formData.environmentSource === "blueprint"
                  ? "bpt_..."
                  : "snp_...";
            } else if (field.key === "workingDirectory") {
              value = formData.workingDirectory;
              placeholder = "/app";
            } else if (field.key === "scorerTimeout") {
              value = formData.scorerTimeout;
              placeholder = "1800";
            }

            return (
              <FormTextInput
                key={field.key}
                label={field.label}
                value={value}
                onChange={(newValue) => {
                  setFormData((prev) => ({
                    ...prev,
                    [field.key]: newValue,
                  }));
                  if (validationError) setValidationError(null);
                }}
                onSubmit={handleSubmit}
                isActive={isActive}
                placeholder={placeholder}
              />
            );
          }

          if (field.type === "select") {
            if (field.key === "environmentSource") {
              return (
                <FormSelect
                  key={field.key}
                  label={field.label}
                  value={formData.environmentSource}
                  options={ENVIRONMENT_OPTIONS}
                  onChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      environmentSource: v as EnvironmentSource,
                    }))
                  }
                  isActive={isActive}
                />
              );
            }
            if (field.key === "validationType") {
              return (
                <FormSelect
                  key={field.key}
                  label={field.label}
                  value={formData.validationType}
                  options={VALIDATION_OPTIONS}
                  onChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      validationType: v as ValidationType,
                    }))
                  }
                  isActive={isActive}
                />
              );
            }
          }

          if (field.type === "scorers") {
            return (
              <React.Fragment key={field.key}>
                {renderScorers(isActive)}
              </React.Fragment>
            );
          }

          if (field.type === "metadata") {
            return (
              <React.Fragment key={field.key}>
                {renderMetadata(isActive)}
              </React.Fragment>
            );
          }

          if (field.type === "list") {
            if (field.key === "requiredEnvVars") {
              return (
                <FormListManager
                  key={field.key}
                  title={field.label}
                  items={formData.requiredEnvVars}
                  onItemsChange={(items) =>
                    setFormData((prev) => ({ ...prev, requiredEnvVars: items }))
                  }
                  isActive={isActive}
                  isExpanded={envVarsExpanded}
                  onExpandedChange={setEnvVarsExpanded}
                  itemPlaceholder="ENV_VAR_NAME"
                  addLabel="+ Add env var"
                  collapsedLabel="env var(s)"
                />
              );
            }
            if (field.key === "requiredSecrets") {
              return (
                <FormListManager
                  key={field.key}
                  title={field.label}
                  items={formData.requiredSecrets}
                  onItemsChange={(items) =>
                    setFormData((prev) => ({ ...prev, requiredSecrets: items }))
                  }
                  isActive={isActive}
                  isExpanded={secretsExpanded}
                  onExpandedChange={setSecretsExpanded}
                  itemPlaceholder="SECRET_NAME"
                  addLabel="+ Add secret"
                  collapsedLabel="secret(s)"
                />
              );
            }
          }

          return null;
        })}
      </Box>

      {!inMetadataSection && !envVarsExpanded && !secretsExpanded && (
        <NavigationTips
          showArrows
          tips={[
            { key: "Enter", label: "Create/Expand" },
            { key: "Ctrl+S", label: "Submit" },
            { key: "q", label: "Cancel" },
          ]}
        />
      )}
    </>
  );
}
