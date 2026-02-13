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
import { NavigationTips } from "./NavigationTips.js";
import { MetadataDisplay } from "./MetadataDisplay.js";
import { ResourcePicker, createTextColumn, Column } from "./ResourcePicker.js";
import { formatTimeAgo } from "./ResourceListView.js";
import { getStatusDisplay } from "./StatusBadge.js";
import {
  FormTextInput,
  FormSelect,
  FormActionButton,
  useFormSelectNavigation,
} from "./form/index.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { listBlueprints } from "../services/blueprintService.js";
import { listSnapshots } from "../services/snapshotService.js";
import { listNetworkPolicies } from "../services/networkPolicyService.js";
import { listGatewayConfigs } from "../services/gatewayConfigService.js";
import type { Blueprint } from "../store/blueprintStore.js";
import type { Snapshot } from "../store/snapshotStore.js";
import type { NetworkPolicy } from "../store/networkPolicyStore.js";
import type { GatewayConfig } from "../store/gatewayConfigStore.js";
import { SecretCreatePage } from "./SecretCreatePage.js";

// Secret list interface for the picker
interface SecretListItem {
  id: string;
  name: string;
  create_time_ms?: number;
}

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
  | "source"
  | "network_policy_id"
  | "gateways";

// Gateway configuration for devbox
interface GatewaySpec {
  envPrefix: string;
  gateway: string; // gateway config ID or name
  gatewayName: string; // display name
  secret: string; // secret ID or name
  secretName: string; // display name
}

const sourceTypes = ["blueprint", "snapshot"] as const;
type SourceTypeToggle = (typeof sourceTypes)[number];

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
  network_policy_id: string;
  gateways: GatewaySpec[];
}

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
    network_policy_id: "",
    gateways: [],
  });
  const [metadataKey, setMetadataKey] = React.useState("");
  const [metadataValue, setMetadataValue] = React.useState("");
  const [inMetadataSection, setInMetadataSection] = React.useState(false);
  const [metadataInputMode, setMetadataInputMode] = React.useState<
    "key" | "value" | null
  >(null);
  const [selectedMetadataIndex, setSelectedMetadataIndex] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<DevboxView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  // Source picker states (toggle between blueprint/snapshot)
  const [sourceTypeToggle, setSourceTypeToggle] = React.useState<
    "blueprint" | "snapshot"
  >(initialSnapshotId ? "snapshot" : "blueprint");
  const [showBlueprintPicker, setShowBlueprintPicker] = React.useState(false);
  const [showSnapshotPicker, setShowSnapshotPicker] = React.useState(false);
  const [showNetworkPolicyPicker, setShowNetworkPolicyPicker] =
    React.useState(false);
  const [selectedBlueprintName, setSelectedBlueprintName] =
    React.useState<string>("");
  const [selectedSnapshotName, setSelectedSnapshotName] =
    React.useState<string>("");
  const [selectedNetworkPolicyName, setSelectedNetworkPolicyName] =
    React.useState<string>("");

  // Gateway picker states
  const [showGatewayPicker, setShowGatewayPicker] = React.useState(false);
  const [showSecretPicker, setShowSecretPicker] = React.useState(false);
  const [inGatewaySection, setInGatewaySection] = React.useState(false);
  const [gatewayEnvPrefix, setGatewayEnvPrefix] = React.useState("");
  const [selectedGatewayIndex, setSelectedGatewayIndex] = React.useState(0);
  const [pendingGateway, setPendingGateway] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingSecret, setPendingSecret] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [showInlineSecretCreate, setShowInlineSecretCreate] =
    React.useState(false);
  // Gateway attach form: when active, shows a mini-form to configure a gateway
  const [gatewayFormActive, setGatewayFormActive] = React.useState(false);
  const [gatewayFormField, setGatewayFormField] = React.useState<
    "attach" | "gateway" | "envName" | "secret"
  >("attach");

  const gatewayFormFields = ["attach", "gateway", "envName", "secret"] as const;
  const gatewayFormFieldIndex = gatewayFormFields.indexOf(gatewayFormField);

  const baseFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "metadata" | "action" | "picker" | "source";
    placeholder?: string;
  }> = [
    { key: "create", label: "Devbox Create", type: "action" },
    { key: "name", label: "Name", type: "text", placeholder: "my-devbox" },
    { key: "architecture", label: "Architecture", type: "select" },
    { key: "resource_size", label: "Resource Size", type: "select" },
  ];

  // Add custom resource fields if CUSTOM_SIZE is selected
  const customFields: Array<{
    key: FormField;
    label: string;
    type: "text" | "select" | "metadata" | "action" | "picker" | "source";
    placeholder?: string;
  }> =
    formData.resource_size === "CUSTOM_SIZE"
      ? [
          {
            key: "custom_cpu",
            label: "CPU Cores (2-16, even)",
            type: "text",
            placeholder: "4",
          },
          {
            key: "custom_memory",
            label: "Memory GB (2-64, even)",
            type: "text",
            placeholder: "8",
          },
          {
            key: "custom_disk",
            label: "Disk GB (2-64, even)",
            type: "text",
            placeholder: "16",
          },
        ]
      : [];

  const remainingFields: Array<{
    key: FormField;
    label: string;
    type:
      | "text"
      | "select"
      | "metadata"
      | "action"
      | "picker"
      | "source"
      | "gateways";
    placeholder?: string;
  }> = [
    {
      key: "keep_alive",
      label: "Keep Alive (seconds)",
      type: "text",
      placeholder: "3600",
    },
    {
      key: "source",
      label: "Source (optional)",
      type: "source",
      placeholder: "Select Blueprint or Snapshot...",
    },
    {
      key: "network_policy_id",
      label: "Network Policy (optional)",
      type: "picker",
      placeholder: "Select a network policy...",
    },
    {
      key: "gateways",
      label: "AI Gateways (optional)",
      type: "gateways",
      placeholder: "Configure API credential proxying...",
    },
    { key: "metadata", label: "Metadata (optional)", type: "metadata" },
  ];

  const fields = [...baseFields, ...customFields, ...remainingFields];

  const currentFieldIndex = fields.findIndex((f) => f.key === currentField);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Select navigation handlers using shared hook
  const handleArchitectureNav = useFormSelectNavigation(
    formData.architecture,
    architectures,
    (value) => setFormData({ ...formData, architecture: value }),
    currentField === "architecture",
  );

  const handleResourceSizeNav = useFormSelectNavigation(
    formData.resource_size || "SMALL",
    resourceSizes,
    (value) => setFormData({ ...formData, resource_size: value }),
    currentField === "resource_size",
  );

  const handleSourceTypeNav = useFormSelectNavigation(
    sourceTypeToggle,
    sourceTypes,
    (value) => setSourceTypeToggle(value),
    currentField === "source",
  );

  // Main form input handler - active when not in metadata section
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

      // Enter key on metadata field to enter metadata section
      if (currentField === "metadata" && key.return) {
        setInMetadataSection(true);
        setSelectedMetadataIndex(0);
        return;
      }

      // Enter key on gateways field to enter gateway section
      if (currentField === "gateways" && key.return) {
        setInGatewaySection(true);
        setSelectedGatewayIndex(0);
        return;
      }

      // Enter key on source field to open the appropriate picker
      if (currentField === "source" && key.return) {
        // If something is already selected, open that type's picker to change it
        const hasBlueprint = !!(selectedBlueprintName || formData.blueprint_id);
        const hasSnapshot = !!(selectedSnapshotName || formData.snapshot_id);

        if (hasBlueprint) {
          setShowBlueprintPicker(true);
        } else if (hasSnapshot) {
          setShowSnapshotPicker(true);
        } else {
          // Nothing selected, use the toggle value
          if (sourceTypeToggle === "blueprint") {
            setShowBlueprintPicker(true);
          } else {
            setShowSnapshotPicker(true);
          }
        }
        return;
      }

      // Delete key on source field to clear selection
      if (currentField === "source" && (input === "d" || key.delete)) {
        handleClearSource();
        return;
      }
      if (currentField === "network_policy_id" && key.return) {
        setShowNetworkPolicyPicker(true);
        return;
      }

      // Handle Enter on any field to submit
      if (key.return) {
        handleCreate();
        return;
      }

      // Handle select field navigation using shared hooks
      if (handleArchitectureNav(input, key)) return;
      if (handleResourceSizeNav(input, key)) return;
      if (handleSourceTypeNav(input, key)) return;

      // Navigation (up/down arrows and tab/shift+tab)
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
    {
      isActive:
        !inMetadataSection &&
        !inGatewaySection &&
        !showBlueprintPicker &&
        !showSnapshotPicker &&
        !showNetworkPolicyPicker &&
        !showGatewayPicker &&
        !showSecretPicker &&
        !showInlineSecretCreate,
    },
  );

  // Handle blueprint selection
  const handleBlueprintSelect = React.useCallback((blueprints: Blueprint[]) => {
    if (blueprints.length > 0) {
      const blueprint = blueprints[0];
      setFormData((prev) => ({
        ...prev,
        blueprint_id: blueprint.id,
        snapshot_id: "",
      }));
      setSelectedBlueprintName(blueprint.name || blueprint.id);
      setSelectedSnapshotName("");
    }
    setShowBlueprintPicker(false);
  }, []);

  // Handle snapshot selection
  const handleSnapshotSelect = React.useCallback((snapshots: Snapshot[]) => {
    if (snapshots.length > 0) {
      const snapshot = snapshots[0];
      setFormData((prev) => ({
        ...prev,
        snapshot_id: snapshot.id,
        blueprint_id: "",
      }));
      setSelectedSnapshotName(snapshot.name || snapshot.id);
      setSelectedBlueprintName("");
    }
    setShowSnapshotPicker(false);
  }, []);

  // Handle network policy selection
  const handleNetworkPolicySelect = React.useCallback(
    (policies: NetworkPolicy[]) => {
      if (policies.length > 0) {
        const policy = policies[0];
        setFormData((prev) => ({ ...prev, network_policy_id: policy.id }));
        setSelectedNetworkPolicyName(policy.name || policy.id);
      }
      setShowNetworkPolicyPicker(false);
    },
    [],
  );

  // Handle gateway config selection
  const handleGatewaySelect = React.useCallback((configs: GatewayConfig[]) => {
    if (configs.length > 0) {
      const config = configs[0];
      const configName = config.name || config.id;
      setPendingGateway({ id: config.id, name: configName });
      // Auto-fill ENV name from config name (uppercase, underscores, no GWS_ prefix)
      const autoEnvName = configName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      setGatewayEnvPrefix(autoEnvName);
      setShowGatewayPicker(false);
      // Move to env name field in the form
      setGatewayFormField("envName");
    } else {
      setShowGatewayPicker(false);
    }
  }, []);

  // Handle secret selection for gateway
  const handleSecretSelect = React.useCallback(
    (secrets: SecretListItem[]) => {
      if (secrets.length > 0) {
        const secret = secrets[0];
        setPendingSecret({ id: secret.id, name: secret.name || secret.id });
      }
      setShowSecretPicker(false);
      // Return to the form at the attach button
      setGatewayFormField("attach");
    },
    [],
  );

  // Attach the configured gateway to the devbox
  const handleAttachGateway = React.useCallback(() => {
    if (!pendingGateway || !pendingSecret || !gatewayEnvPrefix.trim()) return;
    const newGateway: GatewaySpec = {
      envPrefix: gatewayEnvPrefix.trim(),
      gateway: pendingGateway.id,
      gatewayName: pendingGateway.name,
      secret: pendingSecret.id,
      secretName: pendingSecret.name,
    };
    setFormData((prev) => ({
      ...prev,
      gateways: [...prev.gateways, newGateway],
    }));
    // Reset form
    setPendingGateway(null);
    setPendingSecret(null);
    setGatewayEnvPrefix("");
    setGatewayFormActive(false);
    setGatewayFormField("attach");
    setSelectedGatewayIndex(0);
  }, [pendingGateway, pendingSecret, gatewayEnvPrefix]);

  // Handle clearing source
  const handleClearSource = React.useCallback(() => {
    setFormData((prev) => ({ ...prev, blueprint_id: "", snapshot_id: "" }));
    setSelectedBlueprintName("");
    setSelectedSnapshotName("");
  }, []);

  // Metadata section input handler - active when in metadata section
  useInput(
    (input, key) => {
      const metadataKeys = Object.keys(formData.metadata);
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

      // Navigation mode in metadata section
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

  // Gateway section input handler - active when in gateway section
  useInput(
    (input, key) => {
      // === Gateway attach form mode ===
      if (gatewayFormActive) {
        // envName field is a text input - only handle navigation keys
        if (gatewayFormField === "envName") {
          if (key.upArrow || (key.tab && key.shift)) {
            setGatewayFormField("gateway");
            return;
          }
          if (key.downArrow || (key.tab && !key.shift)) {
            setGatewayFormField("secret");
            return;
          }
          if (key.escape) {
            // Cancel the form
            setPendingGateway(null);
            setPendingSecret(null);
            setGatewayEnvPrefix("");
            setGatewayFormActive(false);
            setGatewayFormField("attach");
            return;
          }
          // Let TextInput handle other keys
          return;
        }

        // Navigation between form fields
        if (key.upArrow || (key.tab && key.shift)) {
          const prevIdx = Math.max(0, gatewayFormFieldIndex - 1);
          setGatewayFormField(gatewayFormFields[prevIdx]);
          return;
        }
        if (key.downArrow || (key.tab && !key.shift)) {
          const nextIdx = Math.min(
            gatewayFormFields.length - 1,
            gatewayFormFieldIndex + 1,
          );
          setGatewayFormField(gatewayFormFields[nextIdx]);
          return;
        }

        // Enter on specific fields
        if (key.return) {
          if (gatewayFormField === "gateway") {
            setShowGatewayPicker(true);
            return;
          }
          if (gatewayFormField === "secret") {
            setShowSecretPicker(true);
            return;
          }
          if (gatewayFormField === "attach") {
            handleAttachGateway();
            return;
          }
        }

        if (key.escape || input === "q") {
          // Cancel the form
          setPendingGateway(null);
          setPendingSecret(null);
          setGatewayEnvPrefix("");
          setGatewayFormActive(false);
          setGatewayFormField("attach");
          return;
        }
        return;
      }

      // === List navigation mode (existing gateways + attach/done) ===
      const gatewayCount = formData.gateways.length;
      const maxIndex = gatewayCount + 1; // Attach + existing items + Done

      if (key.upArrow && selectedGatewayIndex > 0) {
        setSelectedGatewayIndex(selectedGatewayIndex - 1);
      } else if (key.downArrow && selectedGatewayIndex < maxIndex) {
        setSelectedGatewayIndex(selectedGatewayIndex + 1);
      } else if (key.return) {
        if (selectedGatewayIndex === 0) {
          // Open the attach form
          setPendingGateway(null);
          setPendingSecret(null);
          setGatewayEnvPrefix("");
          setGatewayFormActive(true);
          setGatewayFormField("gateway");
        } else if (selectedGatewayIndex === maxIndex) {
          // Done
          setInGatewaySection(false);
          setSelectedGatewayIndex(0);
        }
      } else if (
        (input === "d" || key.delete) &&
        selectedGatewayIndex >= 1 &&
        selectedGatewayIndex <= gatewayCount
      ) {
        // Remove gateway at index
        const indexToDelete = selectedGatewayIndex - 1;
        const newGateways = [...formData.gateways];
        newGateways.splice(indexToDelete, 1);
        setFormData({ ...formData, gateways: newGateways });
        const newLength = newGateways.length;
        if (selectedGatewayIndex > newLength) {
          setSelectedGatewayIndex(Math.max(0, newLength));
        }
      } else if (key.escape || input === "q") {
        setInGatewaySection(false);
        setSelectedGatewayIndex(0);
      }
    },
    {
      isActive:
        inGatewaySection &&
        !showGatewayPicker &&
        !showSecretPicker &&
        !showInlineSecretCreate,
    },
  );

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

      if (formData.network_policy_id) {
        launchParameters.network_policy_id = formData.network_policy_id;
      }

      if (Object.keys(launchParameters).length > 0) {
        createParams.launch_parameters = launchParameters;
      }

      // Add gateway specifications
      if (formData.gateways.length > 0) {
        const gateways: Record<string, { gateway: string; secret: string }> =
          {};
        for (const gw of formData.gateways) {
          gateways[gw.envPrefix] = {
            gateway: gw.gateway,
            secret: gw.secret,
          };
        }
        createParams.gateways = gateways;
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
          items={[{ label: "Devboxes" }, { label: "Create", active: true }]}
        />
        <ErrorMessage message="Failed to create devbox" error={error} />
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
          items={[{ label: "Devboxes" }, { label: "Create", active: true }]}
        />
        <SpinnerComponent message="Creating devbox..." />
      </>
    );
  }

  // Blueprint picker screen
  if (showBlueprintPicker) {
    const blueprintColumns: Column<Blueprint>[] = [
      {
        key: "statusIcon",
        label: "",
        width: 2,
        render: (blueprint, _index, isSelected) => {
          const statusDisplay = getStatusDisplay(blueprint.status || "");
          return (
            <Text
              color={isSelected ? "white" : statusDisplay.color}
              bold={true}
              inverse={isSelected}
              wrap="truncate"
            >
              {statusDisplay.icon}{" "}
            </Text>
          );
        },
      },
      createTextColumn<Blueprint>("id", "ID", (blueprint) => blueprint.id, {
        width: 25,
        color: colors.idColor,
      }),
      createTextColumn<Blueprint>(
        "name",
        "Name",
        (blueprint) => blueprint.name || "",
        { width: 30 },
      ),
      {
        key: "status",
        label: "Status",
        width: 12,
        render: (blueprint, _index, isSelected) => {
          const statusDisplay = getStatusDisplay(blueprint.status || "");
          const padded = statusDisplay.text.slice(0, 12).padEnd(12, " ");
          return (
            <Text
              color={isSelected ? "white" : statusDisplay.color}
              bold={true}
              inverse={isSelected}
              wrap="truncate"
            >
              {padded}
            </Text>
          );
        },
      },
      createTextColumn<Blueprint>(
        "created",
        "Created",
        (blueprint) =>
          blueprint.create_time_ms
            ? formatTimeAgo(blueprint.create_time_ms)
            : "",
        { width: 18, color: colors.textDim },
      ),
    ];

    // Filter out failed blueprints
    const failedStatuses = ["failure", "build_failed", "failed"];

    return (
      <ResourcePicker<Blueprint>
        config={{
          title: "Select Blueprint",
          fetchPage: async (params) => {
            const result = await listBlueprints({
              limit: params.limit,
              startingAfter: params.startingAt,
              search: params.search,
            });
            // Filter out failed blueprints
            const validBlueprints = result.blueprints.filter(
              (bp) => !failedStatuses.includes(bp.status || ""),
            );
            return {
              items: validBlueprints,
              hasMore: result.hasMore,
              totalCount: validBlueprints.length,
            };
          },
          getItemId: (blueprint) => blueprint.id,
          getItemLabel: (blueprint) => blueprint.name || blueprint.id,
          columns: blueprintColumns,
          mode: "single",
          emptyMessage: "No blueprints found (failed blueprints are hidden)",
          searchPlaceholder: "Search blueprints...",
          breadcrumbItems: [
            { label: "Devboxes" },
            { label: "Create" },
            { label: "Select Blueprint", active: true },
          ],
        }}
        onSelect={handleBlueprintSelect}
        onCancel={() => setShowBlueprintPicker(false)}
        initialSelected={formData.blueprint_id ? [formData.blueprint_id] : []}
      />
    );
  }

  // Snapshot picker screen
  if (showSnapshotPicker) {
    const snapshotColumns: Column<Snapshot>[] = [
      createTextColumn<Snapshot>("id", "ID", (snapshot) => snapshot.id, {
        width: 25,
        color: colors.idColor,
      }),
      createTextColumn<Snapshot>(
        "name",
        "Name",
        (snapshot) => snapshot.name || "",
        { width: 30 },
      ),
      createTextColumn<Snapshot>(
        "status",
        "Status",
        (snapshot) => snapshot.status || "",
        { width: 12 },
      ),
      createTextColumn<Snapshot>(
        "created",
        "Created",
        (snapshot) =>
          snapshot.create_time_ms ? formatTimeAgo(snapshot.create_time_ms) : "",
        { width: 18, color: colors.textDim },
      ),
    ];

    return (
      <ResourcePicker<Snapshot>
        config={{
          title: "Select Snapshot",
          fetchPage: async (params) => {
            const result = await listSnapshots({
              limit: params.limit,
              startingAfter: params.startingAt,
            });
            return {
              items: result.snapshots,
              hasMore: result.hasMore,
              totalCount: result.totalCount,
            };
          },
          getItemId: (snapshot) => snapshot.id,
          getItemLabel: (snapshot) => snapshot.name || snapshot.id,
          columns: snapshotColumns,
          mode: "single",
          emptyMessage: "No snapshots found",
          searchPlaceholder: "Search snapshots...",
          breadcrumbItems: [
            { label: "Devboxes" },
            { label: "Create" },
            { label: "Select Snapshot", active: true },
          ],
        }}
        onSelect={handleSnapshotSelect}
        onCancel={() => setShowSnapshotPicker(false)}
        initialSelected={formData.snapshot_id ? [formData.snapshot_id] : []}
      />
    );
  }

  // Network policy picker screen
  if (showNetworkPolicyPicker) {
    // Helper to get egress type label
    const getEgressLabel = (egress: NetworkPolicy["egress"]) => {
      if (egress.allow_all) return "Allow All";
      if (egress.allowed_hostnames?.length === 0) return "Deny All";
      return `Custom (${egress.allowed_hostnames?.length || 0})`;
    };

    const buildNetworkPolicyColumns = (tw: number): Column<NetworkPolicy>[] => {
      const fixedWidth = 6;
      const idWidth = 25;
      const egressWidth = 15;
      const timeWidth = 18;
      const baseWidth = fixedWidth + idWidth + egressWidth + timeWidth;
      const nameWidth = Math.min(80, Math.max(15, tw - baseWidth));
      return [
        createTextColumn<NetworkPolicy>("id", "ID", (policy) => policy.id, {
          width: idWidth + 1,
          color: colors.idColor,
        }),
        createTextColumn<NetworkPolicy>(
          "name",
          "Name",
          (policy) => policy.name || "",
          { width: nameWidth },
        ),
        createTextColumn<NetworkPolicy>(
          "egress",
          "Egress",
          (policy) => getEgressLabel(policy.egress),
          { width: egressWidth },
        ),
        createTextColumn<NetworkPolicy>(
          "created",
          "Created",
          (policy) =>
            policy.create_time_ms ? formatTimeAgo(policy.create_time_ms) : "",
          { width: timeWidth, color: colors.textDim },
        ),
      ];
    };

    return (
      <ResourcePicker<NetworkPolicy>
        config={{
          title: "Select Network Policy",
          fetchPage: async (params) => {
            const result = await listNetworkPolicies({
              limit: params.limit,
              startingAfter: params.startingAt,
              search: params.search,
            });
            return {
              items: result.networkPolicies,
              hasMore: result.hasMore,
              totalCount: result.totalCount,
            };
          },
          getItemId: (policy) => policy.id,
          getItemLabel: (policy) => policy.name || policy.id,
          columns: buildNetworkPolicyColumns,
          mode: "single",
          emptyMessage: "No network policies found",
          searchPlaceholder: "Search network policies...",
          breadcrumbItems: [
            { label: "Devboxes" },
            { label: "Create" },
            { label: "Select Network Policy", active: true },
          ],
        }}
        onSelect={handleNetworkPolicySelect}
        onCancel={() => setShowNetworkPolicyPicker(false)}
        initialSelected={
          formData.network_policy_id ? [formData.network_policy_id] : []
        }
      />
    );
  }

  // Gateway config picker screen
  if (showGatewayPicker) {
    const buildGatewayColumns = (tw: number): Column<GatewayConfig>[] => {
      const fixedWidth = 6;
      const idWidth = 25;
      const timeWidth = 20;
      const showEndpoint = tw >= 100;
      const endpointWidth = Math.max(20, tw >= 140 ? 40 : 25);
      const baseWidth = fixedWidth + idWidth + timeWidth;
      const optionalWidth = showEndpoint ? endpointWidth : 0;
      const nameWidth = Math.min(80, Math.max(15, tw - baseWidth - optionalWidth));
      return [
        createTextColumn<GatewayConfig>("id", "ID", (config) => config.id, {
          width: idWidth + 1,
          color: colors.idColor,
        }),
        createTextColumn<GatewayConfig>(
          "name",
          "Name",
          (config) => config.name || "",
          { width: nameWidth },
        ),
        ...(showEndpoint
          ? [
              createTextColumn<GatewayConfig>(
                "endpoint",
                "Endpoint",
                (config) => config.endpoint || "",
                { width: endpointWidth, color: colors.textDim },
              ),
            ]
          : []),
        createTextColumn<GatewayConfig>(
          "created",
          "Created",
          (config) =>
            config.create_time_ms ? formatTimeAgo(config.create_time_ms) : "",
          { width: timeWidth, color: colors.textDim },
        ),
      ];
    };

    return (
      <ResourcePicker<GatewayConfig>
        key="gateway-config-picker"
        config={{
          title: "Select AI Gateway",
          fetchPage: async (params) => {
            const result = await listGatewayConfigs({
              limit: params.limit,
              startingAfter: params.startingAt,
              search: params.search,
            });
            return {
              items: result.gatewayConfigs,
              hasMore: result.hasMore,
              totalCount: result.totalCount,
            };
          },
          getItemId: (config) => config.id,
          getItemLabel: (config) => config.name || config.id,
          columns: buildGatewayColumns,
          mode: "single",
          emptyMessage: "No gateway configs found",
          searchPlaceholder: "Search gateway configs...",
          breadcrumbItems: [
            { label: "Devboxes" },
            { label: "Create" },
            { label: "Attach AI Gateway" },
            { label: "Select Config", active: true },
          ],
        }}
        onSelect={handleGatewaySelect}
        onCancel={() => {
          setShowGatewayPicker(false);
          // Return to the form at the gateway field
          setGatewayFormField("gateway");
        }}
        initialSelected={[]}
      />
    );
  }

  // Inline secret creation screen (from gateway flow)
  if (showInlineSecretCreate) {
    return (
      <SecretCreatePage
        onBack={() => {
          setShowInlineSecretCreate(false);
          // Return to secret picker
          setShowSecretPicker(true);
        }}
        onCreate={(secret) => {
          setShowInlineSecretCreate(false);
          // Store as pending secret and return to the attach form
          setPendingSecret({
            id: secret.id,
            name: secret.name || secret.id,
          });
          setShowSecretPicker(false);
          setGatewayFormField("attach");
        }}
      />
    );
  }

  // Secret picker screen (for gateway)
  if (showSecretPicker) {
    const buildSecretColumns = (tw: number): Column<SecretListItem>[] => {
      const fixedWidth = 6;
      const idWidth = 30;
      const timeWidth = 20;
      const baseWidth = fixedWidth + idWidth + timeWidth;
      const nameWidth = Math.min(80, Math.max(15, tw - baseWidth));
      return [
        createTextColumn<SecretListItem>("id", "ID", (secret) => secret.id, {
          width: idWidth + 1,
          color: colors.idColor,
        }),
        createTextColumn<SecretListItem>(
          "name",
          "Name",
          (secret) => secret.name || "",
          { width: nameWidth },
        ),
        createTextColumn<SecretListItem>(
          "created",
          "Created",
          (secret) =>
            secret.create_time_ms ? formatTimeAgo(secret.create_time_ms) : "",
          { width: timeWidth, color: colors.textDim },
        ),
      ];
    };

    return (
      <ResourcePicker<SecretListItem>
        key="secret-picker"
        config={{
          title: "Select Secret for Gateway",
          fetchPage: async (params) => {
            const client = getClient();
            // Secrets API doesn't support cursor pagination, so we fetch all
            // and do client-side pagination by slicing to the requested page
            const page = await client.secrets.list({
              limit: 1000,
            });
            const allSecrets = (page.secrets || []).map(
              (s: { id: string; name: string; create_time_ms?: number }) => ({
                id: s.id,
                name: s.name,
                create_time_ms: s.create_time_ms,
              }),
            );
            // Client-side cursor pagination
            let startIdx = 0;
            if (params.startingAt) {
              const cursorIdx = allSecrets.findIndex(
                (s) => s.id === params.startingAt,
              );
              if (cursorIdx >= 0) {
                startIdx = cursorIdx + 1;
              }
            }
            const sliced = allSecrets.slice(startIdx, startIdx + params.limit);
            return {
              items: sliced,
              hasMore: startIdx + params.limit < allSecrets.length,
              totalCount: allSecrets.length,
            };
          },
          getItemId: (secret) => secret.id,
          getItemLabel: (secret) => secret.name || secret.id,
          columns: buildSecretColumns,
          mode: "single",
          emptyMessage: "No secrets found",
          searchPlaceholder: "Search secrets...",
          breadcrumbItems: [
            { label: "Devboxes" },
            { label: "Create" },
            { label: "Attach AI Gateway" },
            { label: "Select Secret", active: true },
          ],
          onCreateNew: () => {
            setShowSecretPicker(false);
            setShowInlineSecretCreate(true);
          },
          createNewLabel: "Create secret",
        }}
        onSelect={handleSecretSelect}
        onCancel={() => {
          setShowSecretPicker(false);
          // Return to the form at the secret field
          setGatewayFormField("secret");
        }}
        initialSelected={[]}
      />
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
              <FormActionButton
                key={field.key}
                label={field.label}
                isActive={isActive}
                hint="[Enter to create]"
              />
            );
          }

          if (field.type === "text") {
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
                options={
                  field.key === "architecture" ? architectures : resourceSizes
                }
                onChange={(newValue) =>
                  setFormData({ ...formData, [field.key]: newValue })
                }
                isActive={isActive}
              />
            );
          }

          if (field.type === "source") {
            // Check if either blueprint or snapshot is selected
            const selectedBlueprintValue =
              selectedBlueprintName || formData.blueprint_id;
            const selectedSnapshotValue =
              selectedSnapshotName || formData.snapshot_id;
            const hasBlueprint = !!selectedBlueprintValue;
            const hasSnapshot = !!selectedSnapshotValue;
            const hasSelection = hasBlueprint || hasSnapshot;

            // If something is selected, show it clearly with its type
            if (hasSelection) {
              const selectedType = hasBlueprint ? "Blueprint" : "Snapshot";
              const selectedValue = hasBlueprint
                ? selectedBlueprintValue
                : selectedSnapshotValue;

              return (
                <Box key={field.key} marginBottom={0}>
                  <Text color={isActive ? colors.primary : colors.textDim}>
                    {isActive ? figures.pointer : " "} {field.label}:{" "}
                  </Text>
                  <Text color={colors.success}>{selectedType}: </Text>
                  <Text color={colors.idColor}>{selectedValue}</Text>
                  {isActive && (
                    <Text color={colors.textDim} dimColor>
                      {" "}
                      [Enter to change, d to clear]
                    </Text>
                  )}
                </Box>
              );
            }

            // Nothing selected - show toggle to choose type
            return (
              <Box key={field.key} marginBottom={0}>
                <Text color={isActive ? colors.primary : colors.textDim}>
                  {isActive ? figures.pointer : " "} {field.label}:{" "}
                </Text>
                {/* Toggle between Blueprint and Snapshot */}
                <Text color={isActive ? colors.text : colors.textDim}>
                  {isActive ? figures.arrowLeft : ""}{" "}
                </Text>
                <Text
                  color={
                    sourceTypeToggle === "blueprint"
                      ? colors.primary
                      : colors.textDim
                  }
                  bold={sourceTypeToggle === "blueprint"}
                >
                  Blueprint
                </Text>
                <Text color={colors.textDim}> / </Text>
                <Text
                  color={
                    sourceTypeToggle === "snapshot"
                      ? colors.primary
                      : colors.textDim
                  }
                  bold={sourceTypeToggle === "snapshot"}
                >
                  Snapshot
                </Text>
                <Text color={isActive ? colors.text : colors.textDim}>
                  {" "}
                  {isActive ? figures.arrowRight : ""}
                </Text>
                {isActive && (
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [Enter to select]
                  </Text>
                )}
              </Box>
            );
          }

          if (field.type === "picker") {
            const value = fieldData as string;
            const displayName =
              field.key === "network_policy_id"
                ? selectedNetworkPolicyName || value
                : value;

            return (
              <Box key={field.key} marginBottom={0}>
                <Text color={isActive ? colors.primary : colors.textDim}>
                  {isActive ? figures.pointer : " "} {field.label}:{" "}
                </Text>
                {displayName ? (
                  <Text color={colors.idColor}>{displayName}</Text>
                ) : (
                  <Text color={colors.textDim} dimColor>
                    {field.placeholder || "(none)"}
                  </Text>
                )}
                {isActive && (
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [Enter to {displayName ? "change" : "select"}]
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

          if (field.type === "gateways") {
            if (!inGatewaySection) {
              // Collapsed view
              return (
                <Box key={field.key} flexDirection="column" marginBottom={0}>
                  <Box>
                    <Text color={isActive ? colors.primary : colors.textDim}>
                      {isActive ? figures.pointer : " "} {field.label}:{" "}
                    </Text>
                    <Text color={colors.text}>
                      {formData.gateways.length} configured
                    </Text>
                    {isActive && (
                      <Text color={colors.textDim} dimColor>
                        {" "}
                        [Enter to manage]
                      </Text>
                    )}
                  </Box>
                  {formData.gateways.length > 0 && (
                    <Box marginLeft={2} flexDirection="column">
                      {formData.gateways.map((gw, idx) => (
                        <Text key={idx} color={colors.textDim} dimColor>
                          {figures.pointer} ENV: {gw.envPrefix} | Config:{" "}
                          {gw.gatewayName} | Secret: {gw.secretName}
                        </Text>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            }

            // Expanded gateway section view
            const gatewayCount = formData.gateways.length;
            const maxGatewayIndex = gatewayCount + 1;

            const canAttach =
              !!pendingGateway &&
              !!pendingSecret &&
              !!gatewayEnvPrefix.trim();

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
                  {figures.hamburger} Configure AI Gateways for Devbox
                </Text>

                {/* Attach form - shown when configuring a new gateway */}
                {gatewayFormActive && (
                  <Box
                    flexDirection="column"
                    marginTop={1}
                    borderStyle="single"
                    borderColor={colors.success}
                    paddingX={1}
                  >
                    <Text color={colors.success} bold>
                      Attach AI Gateway
                    </Text>

                    {/* Attach button */}
                    <Box marginTop={1}>
                      <Text
                        color={
                          gatewayFormField === "attach"
                            ? canAttach
                              ? colors.success
                              : colors.primary
                            : colors.textDim
                        }
                      >
                        {gatewayFormField === "attach"
                          ? figures.pointer
                          : " "}{" "}
                      </Text>
                      <Text
                        color={
                          gatewayFormField === "attach"
                            ? canAttach
                              ? colors.success
                              : colors.primary
                            : colors.textDim
                        }
                        bold={gatewayFormField === "attach"}
                      >
                        {canAttach
                          ? `${figures.tick} Attach Gateway`
                          : `${figures.ellipsis} Attach Gateway (fill fields below)`}
                      </Text>
                    </Box>

                    {/* Field 1: Gateway Config */}
                    <Box marginTop={1}>
                      <Text
                        color={
                          gatewayFormField === "gateway"
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {gatewayFormField === "gateway"
                          ? figures.pointer
                          : " "}{" "}
                        AI Gateway:{" "}
                      </Text>
                      {pendingGateway ? (
                        <Text color={colors.success}>
                          {pendingGateway.name}
                        </Text>
                      ) : (
                        <Text color={colors.textDim} dimColor>
                          (none selected)
                        </Text>
                      )}
                      {gatewayFormField === "gateway" && (
                        <Text color={colors.textDim} dimColor>
                          {" "}
                          [Enter to select]
                        </Text>
                      )}
                    </Box>

                    {/* Field 2: ENV Name */}
                    <Box>
                      <Text
                        color={
                          gatewayFormField === "envName"
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {gatewayFormField === "envName"
                          ? figures.pointer
                          : " "}{" "}
                        ENV Name:{" "}
                      </Text>
                      {gatewayFormField === "envName" ? (
                        <TextInput
                          value={gatewayEnvPrefix || ""}
                          onChange={setGatewayEnvPrefix}
                          placeholder="ANTHROPIC"
                        />
                      ) : (
                        <Text
                          color={
                            gatewayEnvPrefix
                              ? colors.text
                              : colors.textDim
                          }
                          dimColor={!gatewayEnvPrefix}
                        >
                          {gatewayEnvPrefix || "(auto-filled from config)"}
                        </Text>
                      )}
                    </Box>

                    {/* Field 3: Secret */}
                    <Box>
                      <Text
                        color={
                          gatewayFormField === "secret"
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {gatewayFormField === "secret"
                          ? figures.pointer
                          : " "}{" "}
                        Secret:{" "}
                      </Text>
                      {pendingSecret ? (
                        <Text color={colors.success}>
                          {pendingSecret.name}
                        </Text>
                      ) : (
                        <Text color={colors.textDim} dimColor>
                          (none selected)
                        </Text>
                      )}
                      {gatewayFormField === "secret" && (
                        <Text color={colors.textDim} dimColor>
                          {" "}
                          [Enter to select]
                        </Text>
                      )}
                    </Box>

                    {/* Help text for form */}
                    <Box
                      marginTop={1}
                      borderStyle="single"
                      borderColor={colors.border}
                      paddingX={1}
                    >
                      <Text color={colors.textDim} dimColor>
                        {gatewayFormField === "envName"
                          ? `Type to edit • ${figures.arrowUp}${figures.arrowDown} Navigate • [esc] Cancel`
                          : gatewayFormField === "attach"
                            ? canAttach
                              ? `[Enter] Attach • ${figures.arrowUp}${figures.arrowDown} Navigate • [esc] Cancel`
                              : `${figures.arrowUp}${figures.arrowDown} Navigate • [esc] Cancel`
                            : `[Enter] Select • ${figures.arrowUp}${figures.arrowDown} Navigate • [esc] Cancel`}
                      </Text>
                    </Box>
                  </Box>
                )}

                {/* Navigation menu - shown when not in form mode */}
                {!gatewayFormActive && (
                  <>
                    {/* Attach new option */}
                    <Box marginTop={1}>
                      <Text
                        color={
                          selectedGatewayIndex === 0
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {selectedGatewayIndex === 0
                          ? figures.pointer
                          : " "}{" "}
                      </Text>
                      <Text
                        color={
                          selectedGatewayIndex === 0
                            ? colors.success
                            : colors.textDim
                        }
                        bold={selectedGatewayIndex === 0}
                      >
                        + Attach AI gateway
                      </Text>
                    </Box>

                    {/* Existing items */}
                    {gatewayCount > 0 && (
                      <Box flexDirection="column" marginTop={1}>
                        {formData.gateways.map((gw, index) => {
                          const itemIndex = index + 1;
                          const isGatewaySelected =
                            selectedGatewayIndex === itemIndex;
                          return (
                            <Box key={gw.envPrefix} flexDirection="column">
                              <Box>
                                <Text
                                  color={
                                    isGatewaySelected
                                      ? colors.primary
                                      : colors.textDim
                                  }
                                >
                                  {isGatewaySelected
                                    ? figures.pointer
                                    : " "}{" "}
                                </Text>
                                <Text
                                  color={
                                    isGatewaySelected
                                      ? colors.primary
                                      : colors.textDim
                                  }
                                  bold={isGatewaySelected}
                                >
                                  ENV: {gw.envPrefix}
                                </Text>
                              </Box>
                              <Box marginLeft={3} flexDirection="column">
                                <Text color={colors.textDim} dimColor>
                                  AI Gateway: {gw.gatewayName} ({gw.gateway})
                                </Text>
                                <Text color={colors.textDim} dimColor>
                                  Secret: {gw.secretName} ({gw.secret})
                                </Text>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {/* Done option */}
                    <Box marginTop={1}>
                      <Text
                        color={
                          selectedGatewayIndex === maxGatewayIndex
                            ? colors.primary
                            : colors.textDim
                        }
                      >
                        {selectedGatewayIndex === maxGatewayIndex
                          ? figures.pointer
                          : " "}{" "}
                      </Text>
                      <Text
                        color={
                          selectedGatewayIndex === maxGatewayIndex
                            ? colors.success
                            : colors.textDim
                        }
                        bold={selectedGatewayIndex === maxGatewayIndex}
                      >
                        {figures.tick} Done
                      </Text>
                    </Box>

                    {/* Help text */}
                    <Box
                      marginTop={1}
                      borderStyle="single"
                      borderColor={colors.border}
                      paddingX={1}
                    >
                      <Text color={colors.textDim} dimColor>
                        {`${figures.arrowUp}${figures.arrowDown} Navigate • [Enter] ${selectedGatewayIndex === 0 ? "Attach" : selectedGatewayIndex === maxGatewayIndex ? "Done" : "Select"} • [d] Remove • [esc] Back`}
                      </Text>
                    </Box>
                  </>
                )}
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

      {!inMetadataSection && !inGatewaySection && (
        <NavigationTips
          showArrows
          tips={[
            { key: "Enter", label: "Create" },
            { key: "q", label: "Cancel" },
          ]}
        />
      )}
    </>
  );
};
