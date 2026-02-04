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
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { listBenchmarks, getBenchmark } from "../services/benchmarkService.js";
import {
  listScenarios,
  getScenario,
  type Scenario,
} from "../services/scenarioService.js";
import { listAgents, type Agent } from "../services/agentService.js";
import {
  createBenchmarkJob,
  type BenchmarkJob,
  type AgentConfig,
  type OrchestratorConfig,
} from "../services/benchmarkJobService.js";
import type { Benchmark } from "../store/benchmarkStore.js";

type FormField =
  | "source_type"
  | "benchmark"
  | "scenarios"
  | "agents"
  | "name"
  | "agent_timeout"
  | "concurrent_trials"
  | "create";

interface FormData {
  sourceType: "benchmark" | "scenarios";
  benchmarkId: string;
  benchmarkName: string;
  scenarioIds: string[];
  scenarioNames: string[];
  agentIds: string[];
  agentNames: string[];
  name: string;
  agentTimeout: string;
  concurrentTrials: string;
}

type ScreenState =
  | "form"
  | "picking_benchmark"
  | "picking_scenarios"
  | "picking_agents"
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

  const [formData, setFormData] = React.useState<FormData>({
    sourceType: initialSourceType,
    benchmarkId: initialBenchmarkIds || "",
    benchmarkName: "",
    scenarioIds: initialScenarioIds ? initialScenarioIds.split(",") : [],
    scenarioNames: [],
    agentIds: cloneAgentIds ? cloneAgentIds.split(",") : [],
    agentNames: cloneAgentNames ? cloneAgentNames.split(",") : [],
    name: cloneJobName ? `${cloneJobName} (clone)` : "",
    agentTimeout: cloneAgentTimeout || "",
    concurrentTrials: cloneConcurrentTrials || "1",
  });

  const [createdJob, setCreatedJob] = React.useState<BenchmarkJob | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

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
    type: "text" | "picker" | "action" | "toggle";
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
      });
      // Apply search filter if provided
      let filteredAgents = result.agents;
      if (params.search) {
        const searchLower = params.search.toLowerCase();
        filteredAgents = result.agents.filter(
          (agent) =>
            agent.name.toLowerCase().includes(searchLower) ||
            agent.id.toLowerCase().includes(searchLower),
        );
      }
      return {
        items: filteredAgents,
        hasMore: result.hasMore,
        totalCount: filteredAgents.length,
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

  // Memoize agent picker config (multi-select)
  const agentPickerConfig = React.useMemo(
    () => ({
      title: "Select Agents",
      fetchPage: fetchAgentsPage,
      getItemId: (agent: Agent) => agent.id,
      getItemLabel: (agent: Agent) => agent.name,
      getItemStatus: (agent: Agent) => (agent.is_public ? "public" : "private"),
      mode: "multi" as const,
      minSelection: 1,
      emptyMessage: "No agents found",
      searchPlaceholder: "Search agents...",
      breadcrumbItems: [
        { label: "Home" },
        { label: "Benchmarks" },
        { label: "Jobs" },
        { label: "Create" },
        { label: "Select Agents", active: true },
      ],
    }),
    [fetchAgentsPage],
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
        // Build agent configs from form data (backward compatibility)
        agentConfigs = formData.agentIds.map((agentId, index) => {
          const config: AgentConfig = {
            name: formData.agentNames[index],
            agentId: agentId,
          };

          if (formData.agentTimeout) {
            const timeout = parseInt(formData.agentTimeout, 10);
            if (!isNaN(timeout) && timeout > 0) {
              config.timeoutSeconds = timeout;
            }
          }

          return config;
        });
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
      });

      setCreatedJob(job);
      setScreenState("success");
    } catch (err) {
      setError(err as Error);
      setScreenState("error");
    }
  }, [formData, isFormValid, cloneAgentConfigs, cloneOrchestratorConfig]);

  // Handle input
  useInput((input, key) => {
    if (screenState !== "form") return;

    // Handle source type toggle with left/right arrows
    if (currentField === "source_type" && (key.leftArrow || key.rightArrow)) {
      setFormData((prev) => ({
        ...prev,
        sourceType: prev.sourceType === "benchmark" ? "scenarios" : "benchmark",
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
      if (currentFieldDef?.type === "picker" && currentField === "benchmark") {
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
        currentFieldDef?.type === "action" &&
        currentField === "create"
      ) {
        handleCreate();
      } else if (currentFieldIndex < fieldKeys.length - 1) {
        // Move to next field on Enter for text inputs
        setCurrentField(fieldKeys[currentFieldIndex + 1]);
      }
    }
  });

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

  // Show agent picker (multi-select)
  if (screenState === "picking_agents") {
    return (
      <ResourcePicker<Agent>
        config={agentPickerConfig}
        onSelect={handleAgentSelect}
        onCancel={() => setScreenState("form")}
        initialSelected={formData.agentIds}
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
      case "name":
        return formData.name;
      case "agent_timeout":
        return formData.agentTimeout;
      case "concurrent_trials":
        return formData.concurrentTrials;
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
