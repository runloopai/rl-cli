/**
 * BenchmarkJobCreateScreen - Create a new benchmark job
 * Uses benchmark definition spec type with multi-select benchmarks and agent picker
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { useNavigation, type RouteParams } from "../store/navigationStore.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { ResourcePicker } from "../components/ResourcePicker.js";
import { MetadataDisplay } from "../components/MetadataDisplay.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { listBenchmarks, getBenchmark } from "../services/benchmarkService.js";
import {
  listScenarios,
  getScenario,
  type Scenario,
} from "../services/scenarioService.js";
import { listAgents, type Agent } from "../services/agentService.js";
import { buildAgentTableColumns } from "../components/agentColumns.js";
import {
  createBenchmarkJob,
  type BenchmarkJob,
  type AgentConfig,
  type OrchestratorConfig,
} from "../services/benchmarkJobService.js";
import type { Benchmark } from "../store/benchmarkStore.js";
import { getClient } from "../utils/client.js";

/** Secret list item for account secrets picker */
interface SecretListItem {
  id: string;
  name: string;
}

type FormField =
  | "source_type"
  | "benchmark"
  | "scenarios"
  | "agents"
  | "secrets"
  | "model_names"
  | "name"
  | "agent_timeout"
  | "concurrent_trials"
  | "metadata"
  | "create";

interface FormData {
  sourceType: "benchmark" | "scenarios";
  benchmarkId: string;
  benchmarkName: string;
  scenarioIds: string[];
  scenarioNames: string[];
  agentIds: string[];
  agentNames: string[];
  /** Env var name -> secret name (account secret) */
  secretsMapping: Record<string, string>;
  /** Comma-separated model names (one per agent, or one value applied to all) */
  modelNamesInput: string;
  name: string;
  agentTimeout: string;
  concurrentTrials: string;
  metadata: Record<string, string>;
}

type ScreenState =
  | "form"
  | "picking_benchmark"
  | "picking_scenarios"
  | "picking_agents"
  | "secrets_config"
  | "picking_secret"
  | "entering_env_var"
  | "creating"
  | "success"
  | "error";

interface BenchmarkJobCreateScreenProps {
  initialBenchmarkIds?: string;
  initialScenarioIds?: string;
  cloneFromJobId?: string;
  cloneJobName?: string;
  cloneSourceType?: "benchmark" | "scenarios";
  cloneAgentConfigs?: string; // JSON serialized AgentConfig[]
  cloneOrchestratorConfig?: string; // JSON serialized OrchestratorConfig
  // Legacy props for backward compatibility
  cloneAgentIds?: string;
  cloneAgentNames?: string;
  cloneAgentTimeout?: string;
  cloneConcurrentTrials?: string;
}

/**
 * Secrets config sub-screen: list mappings, Add, Done. Handles its own input so hooks are stable.
 */
function SecretsConfigView({
  mappingEntries,
  selectedIndex,
  onSelectIndex,
  onAdd,
  onDone,
  onRemove,
  onBack,
}: {
  mappingEntries: [string, string][];
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  onAdd: () => void;
  onDone: () => void;
  onRemove: (envVar: string) => void;
  onBack: () => void;
}) {
  const totalOptions = mappingEntries.length + 2;
  const idx = Math.min(selectedIndex, Math.max(0, totalOptions - 1));

  useInput((_input, key) => {
    if (key.upArrow && idx > 0) {
      onSelectIndex(idx - 1);
    } else if (key.downArrow && idx < totalOptions - 1) {
      onSelectIndex(idx + 1);
    } else if (key.return) {
      if (idx === mappingEntries.length) {
        onAdd();
      } else if (idx === mappingEntries.length + 1) {
        onDone();
      } else {
        const keyToRemove = mappingEntries[idx][0];
        onRemove(keyToRemove);
        onSelectIndex(Math.max(0, idx - 1));
      }
    } else if (key.escape) {
      onBack();
    }
  });

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Home" },
          { label: "Benchmarks" },
          { label: "Jobs" },
          { label: "Create" },
          { label: "Secrets", active: true },
        ]}
      />
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color={colors.primary} bold>
            {figures.pointer} Secrets (env → secret)
          </Text>
        </Box>
        {mappingEntries.map(([envVar, secretName], i) => (
          <Box key={envVar} marginBottom={0}>
            <Box width={4}>
              <Text
                color={idx === i ? colors.primary : colors.textDim}
                bold={idx === i}
              >
                {idx === i ? figures.pointer : " "}
              </Text>
            </Box>
            <Text color={colors.textDim}>
              {envVar} → {secretName}
            </Text>
            {idx === i && (
              <Text color={colors.textDim} dimColor>
                {" "}
                Enter to remove
              </Text>
            )}
          </Box>
        ))}
        <Box marginBottom={0}>
          <Box width={4}>
            <Text
              color={
                idx === mappingEntries.length ? colors.primary : colors.textDim
              }
              bold={idx === mappingEntries.length}
            >
              {idx === mappingEntries.length ? figures.pointer : " "}
            </Text>
          </Box>
          <Text
            color={idx === mappingEntries.length ? colors.primary : colors.text}
          >
            + Add secret
          </Text>
        </Box>
        <Box marginBottom={0}>
          <Box width={4}>
            <Text
              color={
                idx === mappingEntries.length + 1
                  ? colors.primary
                  : colors.textDim
              }
              bold={idx === mappingEntries.length + 1}
            >
              {idx === mappingEntries.length + 1 ? figures.pointer : " "}
            </Text>
          </Box>
          <Text
            color={
              idx === mappingEntries.length + 1 ? colors.primary : colors.text
            }
          >
            Done
          </Text>
        </Box>
      </Box>
      <NavigationTips
        tips={[
          { key: "Enter", label: "Select" },
          { key: "Esc", label: "Back to form" },
        ]}
      />
    </>
  );
}

/**
 * Inline view to enter env var name for a selected secret
 * Pre-fills with secret name so Enter uses it as-is; user can edit if needed.
 */
function EnvVarInputView({
  secretName,
  onSubmit,
  onCancel,
}: {
  secretName: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(secretName);
  useInput((_input, key) => {
    if (key.return) {
      onSubmit(value.trim() || secretName);
    } else if (key.escape) {
      onCancel();
    }
  });
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Home" },
          { label: "Benchmarks" },
          { label: "Jobs" },
          { label: "Create" },
          { label: "Secret env var", active: true },
        ]}
      />
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color={colors.textDim} dimColor>
            Env var name for secret &quot;{secretName}&quot;:
          </Text>
        </Box>
        <Box marginLeft={2}>
          <TextInput
            value={value}
            onChange={setValue}
            placeholder="e.g. ANTHROPIC_API_KEY (or use secret name as-is)"
            onSubmit={() => onSubmit(value.trim() || secretName)}
          />
        </Box>
      </Box>
      <NavigationTips
        tips={[
          { key: "Enter", label: "Add (uses secret name if empty)" },
          { key: "Esc", label: "Cancel" },
        ]}
      />
    </>
  );
}

/**
 * Success screen component with input handling
 */
function SuccessScreen({
  job,
  onViewDetails,
  onGoToList,
  onBack,
}: {
  job: BenchmarkJob;
  onViewDetails: () => void;
  onGoToList: () => void;
  onBack: () => void;
}) {
  useInput((input, key) => {
    if (input === "v") {
      onViewDetails();
    } else if (input === "l") {
      onGoToList();
    } else if (key.escape) {
      onBack();
    }
  });

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Home" },
          { label: "Benchmarks" },
          { label: "Jobs" },
          { label: "Created", active: true },
        ]}
      />
      <SuccessMessage message="Benchmark job created successfully!" />
      <Box marginLeft={2} flexDirection="column" marginTop={1}>
        <Box>
          <Text color={colors.textDim} dimColor>
            ID:{" "}
          </Text>
          <Text color={colors.idColor}>{job.id}</Text>
        </Box>
        <Box>
          <Text color={colors.textDim} dimColor>
            Name:{" "}
          </Text>
          <Text>{job.name}</Text>
        </Box>
        <Box>
          <Text color={colors.textDim} dimColor>
            State:{" "}
          </Text>
          <Text>{job.state}</Text>
        </Box>
      </Box>
      <NavigationTips
        tips={[
          { key: "v", label: "View Details" },
          { key: "l", label: "Jobs List" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}

export function BenchmarkJobCreateScreen({
  initialBenchmarkIds,
  initialScenarioIds,
  cloneFromJobId,
  cloneJobName,
  cloneSourceType,
  cloneAgentConfigs,
  cloneOrchestratorConfig,
  cloneAgentIds,
  cloneAgentNames,
  cloneAgentTimeout,
  cloneConcurrentTrials,
}: BenchmarkJobCreateScreenProps) {
  const { navigate, goBack } = useNavigation();

  // Determine initial source type and field
  const initialSourceType: "benchmark" | "scenarios" =
    cloneSourceType || (initialScenarioIds ? "scenarios" : "benchmark");

  const initialField: FormField =
    initialBenchmarkIds || initialScenarioIds ? "agents" : "source_type";

  const [screenState, setScreenState] = React.useState<ScreenState>("form");
  const [currentField, setCurrentField] =
    React.useState<FormField>(initialField);

  const [formData, setFormData] = React.useState<FormData>(() => {
    let modelNamesInput = "";
    let secretsMapping: Record<string, string> = {};
    try {
      if (cloneAgentConfigs) {
        const arr = JSON.parse(cloneAgentConfigs) as Array<{
          modelName?: string | null;
          model_name?: string | null;
          secrets?: Record<string, string>;
          secret_names?: Record<string, string>;
        }>;
        modelNamesInput = arr
          .map((a) => a.modelName ?? a.model_name ?? "")
          .filter(Boolean)
          .join(", ");
        // Merge secrets from all agent configs into one mapping (clone prefill)
        const allSecrets = arr
          .map((a) => a.secrets ?? a.secret_names)
          .filter(
            (s): s is Record<string, string> => !!s && typeof s === "object",
          );
        if (allSecrets.length > 0) {
          secretsMapping = Object.assign({}, ...allSecrets);
        }
      }
    } catch {
      // ignore invalid JSON
    }
    return {
      sourceType: initialSourceType,
      benchmarkId: initialBenchmarkIds || "",
      benchmarkName: "",
      scenarioIds: initialScenarioIds ? initialScenarioIds.split(",") : [],
      scenarioNames: [],
      agentIds: cloneAgentIds ? cloneAgentIds.split(",") : [],
      agentNames: cloneAgentNames ? cloneAgentNames.split(",") : [],
      secretsMapping,
      modelNamesInput,
      name: cloneJobName ? `${cloneJobName} (clone)` : "",
      agentTimeout: cloneAgentTimeout || "",
      concurrentTrials: cloneConcurrentTrials || "1",
      metadata: {},
    };
  });

  const [createdJob, setCreatedJob] = React.useState<BenchmarkJob | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [metadataKey, setMetadataKey] = React.useState("");
  const [metadataValue, setMetadataValue] = React.useState("");
  const [inMetadataSection, setInMetadataSection] = React.useState(false);
  const [metadataInputMode, setMetadataInputMode] = React.useState<
    "key" | "value" | null
  >(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = React.useState(0);
  /** When adding a secret: selected secret awaiting env var name */
  const [pendingSecretForEnv, setPendingSecretForEnv] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  /** In secrets_config, index of mapping row selected for removal (or -1 for Add/Done) */
  const [secretsConfigSelectedIndex, setSecretsConfigSelectedIndex] =
    React.useState(0);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Fetch benchmark name if we have an ID (from clone or initial selection)
  React.useEffect(() => {
    if (initialBenchmarkIds && !formData.benchmarkName) {
      getBenchmark(initialBenchmarkIds)
        .then((benchmark) => {
          setFormData((prev) => ({
            ...prev,
            benchmarkName: benchmark.name || benchmark.id,
          }));
        })
        .catch((err) => {
          // Silently fail - user can re-select if needed
          console.error("Failed to fetch benchmark name:", err);
        });
    }
  }, [initialBenchmarkIds, formData.benchmarkName]);

  // Fetch scenario names if we have IDs (from clone or initial selection)
  React.useEffect(() => {
    if (
      initialScenarioIds &&
      formData.scenarioIds.length > 0 &&
      formData.scenarioNames.length === 0
    ) {
      // Fetch all scenarios to get their names
      Promise.all(
        formData.scenarioIds.map((id) =>
          getScenario(id).catch((err) => {
            console.error(`Failed to fetch scenario ${id}:`, err);
            return { id, name: id } as Scenario;
          }),
        ),
      ).then((scenarios) => {
        setFormData((prev) => ({
          ...prev,
          scenarioNames: scenarios.map((s) => s.name || s.id),
        }));
      });
    }
  }, [initialScenarioIds, formData.scenarioIds, formData.scenarioNames]);

  // Field definitions - conditionally include benchmark or scenarios based on source type
  const fields: Array<{
    key: FormField;
    label: string;
    type: "text" | "picker" | "action" | "toggle" | "metadata";
    placeholder?: string;
    required?: boolean;
    description?: string;
  }> = [
    {
      key: "source_type",
      label: "Source Type",
      type: "toggle",
      required: true,
      description: "Choose between benchmark or scenarios",
    },
    formData.sourceType === "benchmark"
      ? {
          key: "benchmark",
          label: "Benchmark",
          type: "picker" as const,
          required: true,
          description: "Select a benchmark definition to run",
        }
      : {
          key: "scenarios",
          label: "Scenarios",
          type: "picker" as const,
          required: true,
          description: "Select one or more scenario definitions to run",
        },
    {
      key: "agents",
      label: "Agents",
      type: "picker",
      required: true,
      description: "Select one or more agents to run",
    },
    {
      key: "secrets",
      label: "Secrets (env → secret)",
      type: "picker",
      required: false,
      description:
        cloneFromJobId && Object.keys(formData.secretsMapping).length === 0
          ? "Optional. The API does not return secrets on job fetch; add any needed env→secret mappings here."
          : "Optional. Map environment variable names to account secrets.",
    },
    {
      key: "model_names",
      label: "Model names (comma-separated, optional)",
      type: "text",
      placeholder: "e.g. claude-3-5-sonnet, gpt-4o",
      description: "One per agent, or one value applied to all",
    },
    {
      key: "name",
      label: "Job Name",
      type: "text",
      placeholder: "my-benchmark-job",
      description: "Optional name for this job",
    },
    {
      key: "agent_timeout",
      label: "Agent Timeout (s)",
      type: "text",
      placeholder: "300",
      description: "Optional timeout in seconds",
    },
    {
      key: "concurrent_trials",
      label: "Concurrent Trials",
      type: "text",
      placeholder: "1",
      description: "Number of concurrent trials (default: 1)",
    },
    {
      key: "metadata",
      label: "Metadata (optional)",
      type: "metadata",
      description: "Optional key-value metadata for the job",
    },
    {
      key: "create",
      label: "Create Benchmark Job",
      type: "action",
    },
  ];

  const fieldKeys = fields.map((f) => f.key);
  const currentFieldIndex = fieldKeys.indexOf(currentField);
  const currentFieldDef = fields.find((f) => f.key === currentField);

  // Check if form is valid
  const isFormValid =
    ((formData.sourceType === "benchmark" && formData.benchmarkId !== "") ||
      (formData.sourceType === "scenarios" &&
        formData.scenarioIds.length > 0)) &&
    formData.agentIds.length > 0;

  // Memoize the fetchBenchmarksPage function
  const fetchBenchmarksPage = React.useCallback(
    async (params: { limit: number; startingAt?: string; search?: string }) => {
      const result = await listBenchmarks({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: params.search,
      });
      return {
        items: result.benchmarks,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [],
  );

  // Memoize the fetchAgentsPage function - fetches all agents
  const fetchAgentsPage = React.useCallback(
    async (params: { limit: number; startingAt?: string; search?: string }) => {
      const result = await listAgents({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: params.search || undefined,
      });
      return {
        items: result.agents,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [],
  );

  // Memoize the fetchScenariosPage function
  const fetchScenariosPage = React.useCallback(
    async (params: { limit: number; startingAt?: string; search?: string }) => {
      const result = await listScenarios({
        limit: params.limit,
        startingAfter: params.startingAt,
        search: params.search,
      });
      return {
        items: result.scenarios,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      };
    },
    [],
  );

  // Memoize benchmark picker config (single-select)
  const benchmarkPickerConfig = React.useMemo(
    () => ({
      title: "Select Benchmark",
      fetchPage: fetchBenchmarksPage,
      getItemId: (benchmark: Benchmark) => benchmark.id,
      getItemLabel: (benchmark: Benchmark) => benchmark.name || benchmark.id,
      getItemStatus: (benchmark: Benchmark) => (benchmark as any).status,
      mode: "single" as const,
      minSelection: 1,
      emptyMessage: "No benchmarks found",
      searchPlaceholder: "Search benchmarks...",
      breadcrumbItems: [
        { label: "Home" },
        { label: "Benchmarks" },
        { label: "Jobs" },
        { label: "Create" },
        { label: "Select Benchmark", active: true },
      ],
    }),
    [fetchBenchmarksPage],
  );

  // Memoize scenario picker config (multi-select)
  const scenarioPickerConfig = React.useMemo(
    () => ({
      title: "Select Scenarios",
      fetchPage: fetchScenariosPage,
      getItemId: (scenario: Scenario) => scenario.id,
      getItemLabel: (scenario: Scenario) => scenario.name || scenario.id,
      getItemStatus: (scenario: Scenario) =>
        scenario.is_public ? "public" : "private",
      mode: "multi" as const,
      minSelection: 1,
      emptyMessage: "No scenarios found",
      searchPlaceholder: "Search scenarios...",
      breadcrumbItems: [
        { label: "Home" },
        { label: "Benchmarks" },
        { label: "Jobs" },
        { label: "Create" },
        { label: "Select Scenarios", active: true },
      ],
    }),
    [fetchScenariosPage],
  );

  // Memoize agent picker config (single-select)
  const agentPickerConfig = React.useMemo(
    () => ({
      title: "Select Agent",
      fetchPage: fetchAgentsPage,
      getItemId: (agent: Agent) => agent.id,
      getItemLabel: (agent: Agent) => agent.name,
      getItemStatus: (agent: Agent) => (agent.is_public ? "public" : "private"),
      columns: buildAgentTableColumns,
      mode: "single" as const,
      emptyMessage: "No agents found",
      searchPlaceholder: "Search agents...",
      breadcrumbItems: [
        { label: "Home" },
        { label: "Benchmarks" },
        { label: "Jobs" },
        { label: "Create" },
        { label: "Select Agent", active: true },
      ],
    }),
    [fetchAgentsPage],
  );

  // Fetch account secrets for picker (client-side pagination)
  const fetchSecretsPage = React.useCallback(
    async (params: { limit: number; startingAt?: string; search?: string }) => {
      const client = getClient();
      const result = await client.secrets.list({ limit: 5000 });
      const raw = (result.secrets || []) as Array<{ id: string; name: string }>;
      let items = raw.map((s) => ({ id: s.id, name: s.name || s.id }));
      if (params.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (s) =>
            s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
        );
      }
      const startIdx = params.startingAt
        ? items.findIndex((s) => s.id === params.startingAt) + 1
        : 0;
      const page = items.slice(startIdx, startIdx + params.limit);
      return {
        items: page,
        hasMore: startIdx + params.limit < items.length,
        totalCount: items.length,
      };
    },
    [],
  );

  const secretPickerConfig = React.useMemo(
    () => ({
      title: "Select Secret",
      fetchPage: fetchSecretsPage,
      getItemId: (s: SecretListItem) => s.id,
      getItemLabel: (s: SecretListItem) => s.name,
      getItemStatus: () => undefined,
      mode: "single" as const,
      minSelection: 1,
      emptyMessage: "No secrets found",
      searchPlaceholder: "Search secrets...",
      breadcrumbItems: [
        { label: "Home" },
        { label: "Benchmarks" },
        { label: "Jobs" },
        { label: "Create" },
        { label: "Select Secret", active: true },
      ],
    }),
    [fetchSecretsPage],
  );

  // Handle benchmark selection (single)
  const handleBenchmarkSelect = React.useCallback((items: Benchmark[]) => {
    if (items.length > 0) {
      const benchmark = items[0];
      setFormData((prev) => ({
        ...prev,
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name || benchmark.id,
      }));
    }
    setScreenState("form");
  }, []);

  // Handle scenario selection (multi)
  const handleScenarioSelect = React.useCallback((items: Scenario[]) => {
    setFormData((prev) => ({
      ...prev,
      scenarioIds: items.map((s) => s.id),
      scenarioNames: items.map((s) => s.name || s.id),
    }));
    setScreenState("form");
  }, []);

  // Handle agent selection (multi)
  const handleAgentSelect = React.useCallback((items: Agent[]) => {
    setFormData((prev) => ({
      ...prev,
      agentIds: items.map((a) => a.id),
      agentNames: items.map((a) => a.name),
    }));
    setScreenState("form");
  }, []);

  // After picking a secret: set pending and go to env var input
  const handleSecretSelect = React.useCallback((items: SecretListItem[]) => {
    if (items.length > 0) {
      const s = items[0];
      setPendingSecretForEnv({ id: s.id, name: s.name });
      setScreenState("entering_env_var");
    } else {
      setScreenState("secrets_config");
    }
  }, []);

  // After entering env var for pending secret: add mapping and return to secrets_config
  // If envVarName is empty, use secret name as-is for the mapping (env var name = secret name).
  const handleEnvVarForSecretSubmit = React.useCallback(
    (envVarName: string) => {
      const envVarToUse = envVarName.trim() || pendingSecretForEnv?.name || "";
      if (envVarToUse && pendingSecretForEnv) {
        setFormData((prev) => ({
          ...prev,
          secretsMapping: {
            ...prev.secretsMapping,
            [envVarToUse]: pendingSecretForEnv.name,
          },
        }));
      }
      setPendingSecretForEnv(null);
      setScreenState("secrets_config");
    },
    [pendingSecretForEnv],
  );

  // Handle create
  const handleCreate = React.useCallback(async () => {
    if (!isFormValid) return;

    setScreenState("creating");
    setError(null);

    try {
      // Use cloned agent configs if available, otherwise build from form
      let agentConfigs: AgentConfig[];
      if (cloneAgentConfigs) {
        // Use the full cloned configs
        agentConfigs = JSON.parse(cloneAgentConfigs);
      } else {
        // Parse comma-separated model names: one per agent, or single value applied to all
        const modelNamesParsed = formData.modelNamesInput
          ? formData.modelNamesInput
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const applyModelName = (index: number): string | undefined => {
          if (modelNamesParsed.length === 0) return undefined;
          if (modelNamesParsed.length === 1) return modelNamesParsed[0];
          return modelNamesParsed[index] ?? undefined;
        };

        // Build agent configs from form data (backward compatibility)
        agentConfigs = formData.agentIds.map((agentId, index) => {
          const config: AgentConfig = {
            name: formData.agentNames[index],
            agentId: agentId,
          };

          const modelName = applyModelName(index);
          if (modelName) config.modelName = modelName;

          if (formData.agentTimeout) {
            const timeout = parseInt(formData.agentTimeout, 10);
            if (!isNaN(timeout) && timeout > 0) {
              config.timeoutSeconds = timeout;
            }
          } else {
            config.timeoutSeconds = 7200; // Default to 2 hours
          }

          return config;
        });
      }

      // Form secrets are source of truth: apply to all agents
      if (Object.keys(formData.secretsMapping).length > 0) {
        for (const config of agentConfigs) {
          config.secrets = { ...formData.secretsMapping };
        }
      }

      // Use cloned orchestrator config if available, otherwise build from form
      let orchestratorConfig: OrchestratorConfig | undefined;
      if (cloneOrchestratorConfig) {
        orchestratorConfig = JSON.parse(cloneOrchestratorConfig);
      } else if (formData.concurrentTrials) {
        orchestratorConfig = {
          nConcurrentTrials: parseInt(formData.concurrentTrials, 10) || 1,
        };
      }

      const job = await createBenchmarkJob({
        name: formData.name || undefined,
        benchmarkId:
          formData.sourceType === "benchmark"
            ? formData.benchmarkId
            : undefined,
        scenarioIds:
          formData.sourceType === "scenarios"
            ? formData.scenarioIds
            : undefined,
        agentConfigs,
        orchestratorConfig,
        metadata:
          Object.keys(formData.metadata).length > 0
            ? formData.metadata
            : undefined,
      });

      setCreatedJob(job);
      setScreenState("success");
    } catch (err) {
      setError(err as Error);
      setScreenState("error");
    }
  }, [formData, isFormValid, cloneAgentConfigs, cloneOrchestratorConfig]);

  // Handle input
  useInput(
    (input, key) => {
      if (screenState !== "form") return;

      // Handle source type toggle with left/right arrows
      if (currentField === "source_type" && (key.leftArrow || key.rightArrow)) {
        setFormData((prev) => ({
          ...prev,
          sourceType:
            prev.sourceType === "benchmark" ? "scenarios" : "benchmark",
          // Clear the other source when switching
          benchmarkId: prev.sourceType === "scenarios" ? "" : prev.benchmarkId,
          benchmarkName:
            prev.sourceType === "scenarios" ? "" : prev.benchmarkName,
          scenarioIds: prev.sourceType === "benchmark" ? [] : prev.scenarioIds,
          scenarioNames:
            prev.sourceType === "benchmark" ? [] : prev.scenarioNames,
        }));
        return;
      }

      // Navigate between fields
      if (key.upArrow && currentFieldIndex > 0) {
        setCurrentField(fieldKeys[currentFieldIndex - 1]);
      } else if (key.downArrow && currentFieldIndex < fieldKeys.length - 1) {
        setCurrentField(fieldKeys[currentFieldIndex + 1]);
      } else if (key.escape) {
        goBack();
      } else if (key.return) {
        if (
          currentFieldDef?.type === "picker" &&
          currentField === "benchmark"
        ) {
          setScreenState("picking_benchmark");
        } else if (
          currentFieldDef?.type === "picker" &&
          currentField === "scenarios"
        ) {
          setScreenState("picking_scenarios");
        } else if (
          currentFieldDef?.type === "picker" &&
          currentField === "agents"
        ) {
          setScreenState("picking_agents");
        } else if (
          currentFieldDef?.type === "picker" &&
          currentField === "secrets"
        ) {
          setScreenState("secrets_config");
          setSecretsConfigSelectedIndex(0);
        } else if (
          currentFieldDef?.type === "metadata" &&
          currentField === "metadata"
        ) {
          setInMetadataSection(true);
          setSelectedMetadataIndex(0);
        } else if (
          currentFieldDef?.type === "action" &&
          currentField === "create"
        ) {
          handleCreate();
        } else if (currentFieldIndex < fieldKeys.length - 1) {
          // Move to next field on Enter for text inputs
          setCurrentField(fieldKeys[currentFieldIndex + 1]);
        }
      }
    },
    { isActive: !inMetadataSection },
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
    { isActive: inMetadataSection && screenState === "form" },
  );

  // ----- Secrets sub-flow -----
  const mappingEntries = Object.entries(formData.secretsMapping);

  if (screenState === "secrets_config") {
    return (
      <SecretsConfigView
        mappingEntries={mappingEntries}
        selectedIndex={secretsConfigSelectedIndex}
        onSelectIndex={setSecretsConfigSelectedIndex}
        onAdd={() => setScreenState("picking_secret")}
        onDone={() => setScreenState("form")}
        onRemove={(envVar) => {
          setFormData((prev) => {
            const next = { ...prev.secretsMapping };
            delete next[envVar];
            return { ...prev, secretsMapping: next };
          });
          setSecretsConfigSelectedIndex((i) => Math.max(0, i - 1));
        }}
        onBack={() => setScreenState("form")}
      />
    );
  }

  if (screenState === "entering_env_var" && pendingSecretForEnv) {
    return (
      <EnvVarInputView
        secretName={pendingSecretForEnv.name}
        onSubmit={(val) => handleEnvVarForSecretSubmit(val)}
        onCancel={() => {
          setPendingSecretForEnv(null);
          setScreenState("secrets_config");
        }}
      />
    );
  }

  if (screenState === "picking_secret") {
    return (
      <ResourcePicker<SecretListItem>
        config={secretPickerConfig}
        onSelect={handleSecretSelect}
        onCancel={() => setScreenState("secrets_config")}
        initialSelected={[]}
      />
    );
  }

  // Show benchmark picker (single-select)
  if (screenState === "picking_benchmark") {
    return (
      <ResourcePicker<Benchmark>
        config={benchmarkPickerConfig}
        onSelect={handleBenchmarkSelect}
        onCancel={() => setScreenState("form")}
        initialSelected={formData.benchmarkId ? [formData.benchmarkId] : []}
      />
    );
  }

  // Show scenario picker (multi-select)
  if (screenState === "picking_scenarios") {
    return (
      <ResourcePicker<Scenario>
        config={scenarioPickerConfig}
        onSelect={handleScenarioSelect}
        onCancel={() => setScreenState("form")}
        initialSelected={formData.scenarioIds}
      />
    );
  }

  // Show agent picker (single-select)
  if (screenState === "picking_agents") {
    return (
      <ResourcePicker<Agent>
        config={agentPickerConfig}
        onSelect={handleAgentSelect}
        onCancel={() => setScreenState("form")}
      />
    );
  }

  // Show creating state
  if (screenState === "creating") {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Jobs" },
            { label: "Create", active: true },
          ]}
        />
        <SpinnerComponent message="Creating benchmark job..." />
      </>
    );
  }

  // Show success state
  if (screenState === "success" && createdJob) {
    return (
      <SuccessScreen
        job={createdJob}
        onViewDetails={() =>
          navigate("benchmark-job-detail", { benchmarkJobId: createdJob.id })
        }
        onGoToList={() => navigate("benchmark-job-list")}
        onBack={goBack}
      />
    );
  }

  // Show error state
  if (screenState === "error") {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Jobs" },
            { label: "Error", active: true },
          ]}
        />
        <ErrorMessage
          message="Failed to create benchmark job"
          error={error || new Error("Unknown error")}
        />
        <Box marginTop={1}>
          <Text color={colors.textDim}>
            Press <Text color={colors.primary}>r</Text> to retry or{" "}
            <Text color={colors.primary}>Esc</Text> to go back
          </Text>
        </Box>
        <NavigationTips
          tips={[
            { key: "r", label: "Retry" },
            { key: "Esc", label: "Back" },
          ]}
        />
      </>
    );
  }

  // Helper to get display value for a field
  const getFieldValue = (fieldKey: FormField): string => {
    switch (fieldKey) {
      case "source_type":
        return formData.sourceType === "benchmark" ? "Benchmark" : "Scenarios";
      case "benchmark":
        return formData.benchmarkName;
      case "scenarios":
        // Show count based on IDs even if names aren't loaded yet
        if (formData.scenarioIds.length === 0) return "";
        if (formData.scenarioIds.length === 1) {
          return formData.scenarioNames[0] || formData.scenarioIds[0];
        }
        // If we have names, show the first name + count, otherwise show count
        if (formData.scenarioNames.length > 0) {
          return `${formData.scenarioNames.length} scenarios selected`;
        }
        return `${formData.scenarioIds.length} scenarios selected`;
      case "agents":
        if (formData.agentNames.length === 0) return "";
        if (formData.agentNames.length === 1) return formData.agentNames[0];
        return `${formData.agentNames.length} agents selected`;
      case "secrets": {
        const keys = Object.keys(formData.secretsMapping);
        if (keys.length === 0) return "";
        if (keys.length === 1)
          return `${keys[0]} → ${formData.secretsMapping[keys[0]]}`;
        return `${keys.length} mappings`;
      }
      case "model_names":
        return formData.modelNamesInput;
      case "name":
        return formData.name;
      case "agent_timeout":
        return formData.agentTimeout;
      case "concurrent_trials":
        return formData.concurrentTrials;
      case "metadata": {
        const keys = Object.keys(formData.metadata);
        if (keys.length === 0) return "";
        if (keys.length === 1)
          return `${keys[0]} = ${formData.metadata[keys[0]]}`;
        return `${keys.length} item(s)`;
      }
      default:
        return "";
    }
  };

  // Main form view
  const isCloning = !!cloneFromJobId;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Home" },
          { label: "Benchmarks" },
          { label: "Jobs" },
          { label: isCloning ? "Clone Job" : "Create", active: true },
        ]}
      />

      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color={colors.primary} bold>
            {figures.pointer}{" "}
            {isCloning ? "Clone Benchmark Job" : "Create Benchmark Job"}
          </Text>
        </Box>

        {fields.map((field) => {
          const isSelected = currentField === field.key;
          const value = getFieldValue(field.key);

          return (
            <Box key={field.key} marginBottom={field.type === "action" ? 1 : 0}>
              <Box width={4}>
                <Text color={isSelected ? colors.primary : colors.textDim}>
                  {isSelected ? figures.pointer : " "}
                </Text>
              </Box>

              {field.type === "toggle" ? (
                <Box>
                  <Text color={colors.textDim} dimColor>
                    {field.label}
                    {field.required && <Text color={colors.error}>*</Text>}
                    :{" "}
                  </Text>
                  {/* Toggle between Benchmark and Scenarios */}
                  <Text color={isSelected ? colors.text : colors.textDim}>
                    {isSelected ? figures.arrowLeft : ""}{" "}
                  </Text>
                  <Text
                    color={
                      formData.sourceType === "benchmark"
                        ? colors.primary
                        : colors.textDim
                    }
                    bold={formData.sourceType === "benchmark"}
                  >
                    Benchmark
                  </Text>
                  <Text color={colors.textDim}> / </Text>
                  <Text
                    color={
                      formData.sourceType === "scenarios"
                        ? colors.primary
                        : colors.textDim
                    }
                    bold={formData.sourceType === "scenarios"}
                  >
                    Scenarios
                  </Text>
                  <Text color={isSelected ? colors.text : colors.textDim}>
                    {" "}
                    {isSelected ? figures.arrowRight : ""}
                  </Text>
                </Box>
              ) : field.type === "action" ? (
                <Box>
                  <Text
                    color={isFormValid ? colors.success : colors.textDim}
                    bold={isSelected}
                    inverse={isSelected}
                  >
                    {" "}
                    {figures.play} {field.label}{" "}
                    {!isFormValid && "(select benchmark/scenarios and agents)"}
                  </Text>
                </Box>
              ) : field.type === "picker" ? (
                <Box flexDirection="column">
                  <Box>
                    <Text color={colors.textDim} dimColor>
                      {field.label}
                      {field.required && <Text color={colors.error}>*</Text>}
                      :{" "}
                    </Text>
                    {value ? (
                      <Text color={colors.idColor}>{value}</Text>
                    ) : (
                      <Text color={colors.textDim} dimColor>
                        (none selected)
                      </Text>
                    )}
                  </Box>
                  {isSelected && (
                    <Box marginLeft={2}>
                      <Text color={colors.textDim} dimColor>
                        Press Enter to select
                      </Text>
                    </Box>
                  )}
                </Box>
              ) : field.type === "metadata" ? (
                !inMetadataSection ? (
                  <Box flexDirection="column">
                    <Box>
                      <Text color={colors.textDim} dimColor>
                        {field.label}:{" "}
                      </Text>
                      <Text color={colors.text}>
                        {Object.keys(formData.metadata).length > 0
                          ? `${Object.keys(formData.metadata).length} item(s)`
                          : "None"}
                      </Text>
                      {isSelected && (
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
                ) : (
                  (() => {
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
                              {selectedMetadataIndex === 0
                                ? "Adding New"
                                : "Editing"}
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
                                <Text dimColor>
                                  Value: {metadataValue || ""}
                                </Text>
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
                                  const isMetadataSelected =
                                    selectedMetadataIndex === itemIndex;
                                  return (
                                    <Box key={key}>
                                      <Text
                                        color={
                                          isMetadataSelected
                                            ? colors.primary
                                            : colors.textDim
                                        }
                                      >
                                        {isMetadataSelected
                                          ? figures.pointer
                                          : " "}{" "}
                                      </Text>
                                      <Text
                                        color={
                                          isMetadataSelected
                                            ? colors.primary
                                            : colors.textDim
                                        }
                                        bold={isMetadataSelected}
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
                  })()
                )
              ) : (
                <Box>
                  <Text color={colors.textDim} dimColor>
                    {field.label}
                    {field.required && <Text color={colors.error}>*</Text>}
                    :{" "}
                  </Text>
                  {isSelected ? (
                    <TextInput
                      value={value}
                      onChange={(val) => {
                        if (field.key === "name") {
                          setFormData((prev) => ({ ...prev, name: val }));
                        } else if (field.key === "model_names") {
                          setFormData((prev) => ({
                            ...prev,
                            modelNamesInput: val,
                          }));
                        } else if (field.key === "agent_timeout") {
                          setFormData((prev) => ({
                            ...prev,
                            agentTimeout: val,
                          }));
                        } else if (field.key === "concurrent_trials") {
                          setFormData((prev) => ({
                            ...prev,
                            concurrentTrials: val,
                          }));
                        }
                      }}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <Text color={value ? colors.text : colors.textDim}>
                      {value || field.placeholder || "(empty)"}
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}

        {/* Current field description */}
        {currentFieldDef?.description && (
          <Box marginTop={1} marginLeft={4}>
            <Text color={colors.textDim} dimColor>
              {figures.info} {currentFieldDef.description}
            </Text>
          </Box>
        )}
      </Box>

      <NavigationTips
        showArrows
        tips={[
          {
            key: "Enter",
            label:
              currentFieldDef?.type === "picker"
                ? "Select"
                : currentFieldDef?.type === "action"
                  ? "Create"
                  : "Next",
          },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
}
