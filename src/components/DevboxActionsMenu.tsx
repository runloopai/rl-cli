import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { Header } from "./Header.js";
import { SpinnerComponent } from "./Spinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { SuccessMessage } from "./SuccessMessage.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { ConfirmationPrompt } from "./ConfirmationPrompt.js";
import { colors } from "../utils/theme.js";
import { openInBrowser } from "../utils/browser.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useNavigation } from "../store/navigationStore.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import {
  suspendDevbox,
  resumeDevbox,
  shutdownDevbox,
  uploadFile,
  createSnapshot as createDevboxSnapshot,
  createTunnel,
  createSSHKey,
} from "../services/devboxService.js";
import { StreamingLogsViewer } from "./StreamingLogsViewer.js";
import { DevboxView } from "@runloop/api-client/resources/devboxes.mjs";

type Operation =
  | "exec"
  | "upload"
  | "snapshot"
  | "ssh"
  | "logs"
  | "tunnel"
  | "suspend"
  | "resume"
  | "delete"
  | null;

interface DevboxActionsMenuProps {
  devbox: DevboxView;
  onBack: () => void;
  breadcrumbItems?: Array<{ label: string; active?: boolean }>;
  initialOperation?: string; // Operation to execute immediately
  initialOperationIndex?: number; // Index of the operation to select
  skipOperationsMenu?: boolean; // Skip showing operations menu and execute immediately
}

export const DevboxActionsMenu = ({
  devbox,
  onBack,
  breadcrumbItems = [
    { label: "Devboxes" },
    { label: devbox.name || devbox.id, active: true },
  ],
  initialOperation,
  initialOperationIndex = 0,
  skipOperationsMenu = false,
}: DevboxActionsMenuProps) => {
  const { navigate, currentScreen, params } = useNavigation();
  const [loading, setLoading] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(
    initialOperationIndex,
  );
  const [executingOperation, setExecutingOperation] = React.useState<Operation>(
    (initialOperation as Operation) || null,
  );
  const [operationInput, setOperationInput] = React.useState("");
  const [operationResult, setOperationResult] = React.useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = React.useState<Error | null>(
    null,
  );
  const [execScroll, setExecScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Snapshot form state
  const [snapshotFormMode, setSnapshotFormMode] = React.useState(false);
  const [snapshotName, setSnapshotName] = React.useState("");
  const [snapshotCommitMessage, setSnapshotCommitMessage] = React.useState("");
  const [snapshotMetadata, setSnapshotMetadata] = React.useState<
    Record<string, string>
  >({});
  const [snapshotFormField, setSnapshotFormField] = React.useState<
    "name" | "commit_message" | "metadata" | "create"
  >("name");
  const [inSnapshotMetadataSection, setInSnapshotMetadataSection] =
    React.useState(false);
  const [snapshotMetadataKey, setSnapshotMetadataKey] = React.useState("");
  const [snapshotMetadataValue, setSnapshotMetadataValue] = React.useState("");
  const [snapshotMetadataInputMode, setSnapshotMetadataInputMode] =
    React.useState<"key" | "value" | null>(null);
  const [selectedSnapshotMetadataIndex, setSelectedSnapshotMetadataIndex] =
    React.useState(0);

  // Calculate viewport for exec output:
  // - Breadcrumb (3 lines + marginBottom): 4 lines
  // - Command header (border + 2 content + border + marginBottom): 5 lines
  // - Output box borders: 2 lines
  // - Stats bar (marginTop + content): 2 lines
  // - Help bar (marginTop + content): 2 lines
  // - Safety buffer: 1 line
  // Total: 16 lines
  const execViewport = useViewportHeight({ overhead: 16, minHeight: 10 });

  // CRITICAL: Aggressive memory cleanup to prevent heap exhaustion
  React.useEffect(() => {
    // Clear large data immediately when results are shown to free memory faster
    if (operationResult || operationError) {
      const timer = setTimeout(() => {
        // After 100ms, if user hasn't acted, start aggressive cleanup
        // This helps with memory without disrupting UX
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [operationResult, operationError]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Aggressively null out all large data structures
      setOperationResult(null);
      setOperationError(null);
      setOperationInput("");
      setLoading(false);
    };
  }, []);

  const allOperations = [
    {
      key: "logs",
      label: "View Logs",
      color: colors.info,
      icon: figures.info,
      shortcut: "l",
    },
    {
      key: "exec",
      label: "Execute Command",
      color: colors.success,
      icon: figures.play,
      shortcut: "e",
    },
    {
      key: "upload",
      label: "Upload File",
      color: colors.success,
      icon: figures.arrowUp,
      shortcut: "u",
    },
    {
      key: "snapshot",
      label: "Create Snapshot",
      color: colors.warning,
      icon: figures.circleFilled,
      shortcut: "n",
    },
    {
      key: "ssh",
      label: "SSH onto the box",
      color: colors.primary,
      icon: figures.arrowRight,
      shortcut: "s",
    },
    {
      key: "tunnel",
      label: "Open Tunnel",
      color: colors.secondary,
      icon: figures.pointerSmall,
      shortcut: "t",
    },
    {
      key: "suspend",
      label: "Suspend Devbox",
      color: colors.warning,
      icon: figures.squareSmallFilled,
      shortcut: "p",
    },
    {
      key: "resume",
      label: "Resume Devbox",
      color: colors.success,
      icon: figures.play,
      shortcut: "r",
    },
    {
      key: "delete",
      label: "Shutdown Devbox",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Filter operations based on devbox status
  const hasTunnel = !!(devbox?.tunnel && devbox.tunnel.tunnel_key);
  const operations = devbox
    ? allOperations
        .filter((op) => {
          const status = devbox.status;

          // When suspended: logs and resume
          if (status === "suspended") {
            return op.key === "resume" || op.key === "logs";
          }

          // When not running (shutdown, failure, etc): only logs
          if (
            status !== "running" &&
            status !== "provisioning" &&
            status !== "initializing"
          ) {
            return op.key === "logs";
          }

          // When running: everything except resume
          if (status === "running") {
            return op.key !== "resume";
          }

          // Default for transitional states (provisioning, initializing)
          return op.key === "logs" || op.key === "delete";
        })
        .map((op) => {
          // Dynamic tunnel label based on whether tunnel is active
          if (op.key === "tunnel") {
            return hasTunnel
              ? {
                  ...op,
                  label: "Tunnel (Active)",
                  color: colors.success,
                  icon: figures.tick,
                }
              : op;
          }
          return op;
        })
    : allOperations;

  // Auto-execute operations that don't need input (except delete which needs confirmation)
  React.useEffect(() => {
    const autoExecuteOps = ["ssh", "logs", "suspend", "resume"];
    if (
      executingOperation &&
      autoExecuteOps.includes(executingOperation) &&
      !loading &&
      devbox
    ) {
      executeOperation();
    }
    // Show confirmation for delete
    if (
      executingOperation === "delete" &&
      !loading &&
      devbox &&
      !showDeleteConfirm
    ) {
      setShowDeleteConfirm(true);
    }
    // Show snapshot form
    if (
      executingOperation === "snapshot" &&
      !loading &&
      devbox &&
      !snapshotFormMode &&
      !operationResult &&
      !operationError
    ) {
      setSnapshotFormMode(true);
      setSnapshotFormField("name");
    }
  }, [executingOperation]);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  useInput((input, key) => {
    // Handle snapshot metadata section input
    if (snapshotFormMode && inSnapshotMetadataSection) {
      const metadataKeys = Object.keys(snapshotMetadata);
      const maxIndex = metadataKeys.length + 1;

      // Handle input mode (typing key or value)
      if (snapshotMetadataInputMode) {
        if (
          snapshotMetadataInputMode === "key" &&
          key.return &&
          snapshotMetadataKey.trim()
        ) {
          setSnapshotMetadataInputMode("value");
          return;
        } else if (snapshotMetadataInputMode === "value" && key.return) {
          if (snapshotMetadataKey.trim() && snapshotMetadataValue.trim()) {
            setSnapshotMetadata({
              ...snapshotMetadata,
              [snapshotMetadataKey.trim()]: snapshotMetadataValue.trim(),
            });
          }
          setSnapshotMetadataKey("");
          setSnapshotMetadataValue("");
          setSnapshotMetadataInputMode(null);
          setSelectedSnapshotMetadataIndex(0);
          return;
        } else if (key.escape) {
          setSnapshotMetadataKey("");
          setSnapshotMetadataValue("");
          setSnapshotMetadataInputMode(null);
          return;
        } else if (key.tab) {
          setSnapshotMetadataInputMode(
            snapshotMetadataInputMode === "key" ? "value" : "key",
          );
          return;
        }
        return;
      }

      // Navigation mode in metadata section
      if (key.upArrow && selectedSnapshotMetadataIndex > 0) {
        setSelectedSnapshotMetadataIndex(selectedSnapshotMetadataIndex - 1);
      } else if (key.downArrow && selectedSnapshotMetadataIndex < maxIndex) {
        setSelectedSnapshotMetadataIndex(selectedSnapshotMetadataIndex + 1);
      } else if (key.return) {
        if (selectedSnapshotMetadataIndex === 0) {
          setSnapshotMetadataKey("");
          setSnapshotMetadataValue("");
          setSnapshotMetadataInputMode("key");
        } else if (selectedSnapshotMetadataIndex === maxIndex) {
          setInSnapshotMetadataSection(false);
          setSelectedSnapshotMetadataIndex(0);
          setSnapshotMetadataKey("");
          setSnapshotMetadataValue("");
          setSnapshotMetadataInputMode(null);
        } else if (
          selectedSnapshotMetadataIndex >= 1 &&
          selectedSnapshotMetadataIndex <= metadataKeys.length
        ) {
          const keyToEdit = metadataKeys[selectedSnapshotMetadataIndex - 1];
          setSnapshotMetadataKey(keyToEdit || "");
          setSnapshotMetadataValue(snapshotMetadata[keyToEdit] || "");
          const newMetadata = { ...snapshotMetadata };
          delete newMetadata[keyToEdit];
          setSnapshotMetadata(newMetadata);
          setSnapshotMetadataInputMode("key");
        }
      } else if (
        (input === "d" || key.delete) &&
        selectedSnapshotMetadataIndex >= 1 &&
        selectedSnapshotMetadataIndex <= metadataKeys.length
      ) {
        const keyToDelete = metadataKeys[selectedSnapshotMetadataIndex - 1];
        const newMetadata = { ...snapshotMetadata };
        delete newMetadata[keyToDelete];
        setSnapshotMetadata(newMetadata);
        const newLength = Object.keys(newMetadata).length;
        if (selectedSnapshotMetadataIndex > newLength) {
          setSelectedSnapshotMetadataIndex(Math.max(0, newLength));
        }
      } else if (key.escape || input === "q") {
        setInSnapshotMetadataSection(false);
        setSelectedSnapshotMetadataIndex(0);
        setSnapshotMetadataKey("");
        setSnapshotMetadataValue("");
        setSnapshotMetadataInputMode(null);
      }
      return;
    }

    // Handle snapshot form mode (main form navigation)
    if (snapshotFormMode && !inSnapshotMetadataSection) {
      const snapshotFields = [
        "name",
        "commit_message",
        "metadata",
        "create",
      ] as const;
      const currentFieldIndex = snapshotFields.indexOf(snapshotFormField);

      if (input === "q" || key.escape) {
        // Cancel snapshot form
        setSnapshotFormMode(false);
        setSnapshotName("");
        setSnapshotCommitMessage("");
        setSnapshotMetadata({});
        setSnapshotFormField("name");
        setExecutingOperation(null);
        if (skipOperationsMenu) {
          onBack();
        }
        return;
      }

      // Navigate between fields (only when not actively editing text fields)
      if (
        snapshotFormField !== "name" &&
        snapshotFormField !== "commit_message"
      ) {
        if (key.upArrow && currentFieldIndex > 0) {
          setSnapshotFormField(snapshotFields[currentFieldIndex - 1]);
          return;
        }
        if (key.downArrow && currentFieldIndex < snapshotFields.length - 1) {
          setSnapshotFormField(snapshotFields[currentFieldIndex + 1]);
          return;
        }
      }

      // Handle Enter key
      if (key.return) {
        if (snapshotFormField === "name") {
          // Move to commit_message field
          setSnapshotFormField("commit_message");
        } else if (snapshotFormField === "commit_message") {
          // Move to metadata field
          setSnapshotFormField("metadata");
        } else if (snapshotFormField === "metadata") {
          // Enter metadata section
          setInSnapshotMetadataSection(true);
          setSelectedSnapshotMetadataIndex(0);
        } else if (snapshotFormField === "create") {
          // Execute snapshot creation
          executeOperation();
        }
        return;
      }

      // Tab navigation (when not in text input fields)
      if (
        key.tab &&
        snapshotFormField !== "name" &&
        snapshotFormField !== "commit_message"
      ) {
        const nextIndex = key.shift
          ? Math.max(0, currentFieldIndex - 1)
          : Math.min(snapshotFields.length - 1, currentFieldIndex + 1);
        setSnapshotFormField(snapshotFields[nextIndex]);
        return;
      }

      return;
    }

    // Handle operation input mode (for exec, upload, tunnel)
    if (
      executingOperation &&
      !operationResult &&
      !operationError &&
      !snapshotFormMode
    ) {
      if (key.return && operationInput.trim()) {
        // For exec, navigate to dedicated exec screen
        if (executingOperation === "exec") {
          navigate("devbox-exec", {
            devboxId: devbox.id,
            devboxName: devbox.name || devbox.id,
            execCommand: operationInput,
          });
        } else {
          executeOperation();
        }
      } else if (input === "q" || key.escape) {
        setExecutingOperation(null);
        setOperationInput("");
      }
      return;
    }

    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        // Clear large data structures immediately to prevent memory leaks
        setOperationResult(null);
        setOperationError(null);
        setOperationInput("");
        setExecScroll(0);
        setCopyStatus(null);

        // If skipOperationsMenu is true, go back to parent instead of operations menu
        if (skipOperationsMenu) {
          setExecutingOperation(null);
          onBack();
        } else {
          setExecutingOperation(null);
        }
      } else if (
        input === "o" &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "tunnel"
      ) {
        // Open tunnel URL in browser
        const tunnelUrl = (operationResult as any).__tunnelUrl;
        if (tunnelUrl) {
          openInBrowser(tunnelUrl);
          setCopyStatus("Opened in browser!");
          setTimeout(() => setCopyStatus(null), 2000);
        }
      } else if (
        (key.upArrow || input === "k") &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        setExecScroll(Math.max(0, execScroll - 1));
      } else if (
        (key.downArrow || input === "j") &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        setExecScroll(execScroll + 1);
      } else if (
        key.pageUp &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        setExecScroll(Math.max(0, execScroll - 10));
      } else if (
        key.pageDown &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        setExecScroll(execScroll + 10);
      } else if (
        input === "g" &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        setExecScroll(0);
      } else if (
        input === "G" &&
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        const lines = [
          ...((operationResult as any).stdout || "").split("\n"),
          ...((operationResult as any).stderr || "").split("\n"),
        ];
        const maxScroll = Math.max(
          0,
          lines.length - execViewport.viewportHeight,
        );
        setExecScroll(maxScroll);
      } else if (
        input === "c" &&
        !key.ctrl && // Ignore if Ctrl+C for quit
        operationResult &&
        typeof operationResult === "object" &&
        (operationResult as any).__customRender === "exec"
      ) {
        // Copy exec output to clipboard
        const output =
          ((operationResult as any).stdout || "") +
          ((operationResult as any).stderr || "");

        copyToClipboard(output).then((status) => {
          setCopyStatus(status);
          setTimeout(() => setCopyStatus(null), 2000);
        });
      }
      return;
    }

    // Operations selection mode
    if (input === "q" || key.escape) {
      // Clear all state before going back to free memory
      setOperationResult(null);
      setOperationError(null);
      setOperationInput("");
      setExecutingOperation(null);
      setSelectedOperation(0);
      setLoading(false);
      onBack();
    } else if (key.upArrow && selectedOperation > 0) {
      setSelectedOperation(selectedOperation - 1);
    } else if (key.downArrow && selectedOperation < operations.length - 1) {
      setSelectedOperation(selectedOperation + 1);
    } else if (key.return) {
      const op = operations[selectedOperation].key as Operation;
      setExecutingOperation(op);
    } else if (input) {
      // Check if input matches any operation shortcut
      const matchedOp = operations.find((op) => op.shortcut === input);
      if (matchedOp) {
        setExecutingOperation(matchedOp.key as Operation);
      }
    }
  });

  const executeOperation = async () => {
    try {
      setLoading(true);
      switch (executingOperation) {
        // Note: "exec" is now handled by ExecViewer component directly

        case "upload":
          // Use service layer
          const filename = operationInput.split("/").pop() || "file";
          await uploadFile(devbox.id, operationInput, filename);
          setOperationResult(`File ${filename} uploaded successfully`);
          break;

        case "snapshot":
          // Use service layer with form data
          const snapshotOptions: {
            name?: string;
            metadata?: Record<string, string>;
            commit_message?: string;
          } = {};
          if (snapshotName.trim()) {
            snapshotOptions.name = snapshotName.trim();
          } else {
            snapshotOptions.name = `snapshot-${Date.now()}`;
          }
          if (snapshotCommitMessage.trim()) {
            snapshotOptions.commit_message = snapshotCommitMessage.trim();
          }
          if (Object.keys(snapshotMetadata).length > 0) {
            snapshotOptions.metadata = snapshotMetadata;
          }
          const snapshot = await createDevboxSnapshot(
            devbox.id,
            snapshotOptions,
          );
          setOperationResult(`Snapshot created: ${snapshot.id}`);
          // Reset snapshot form state
          setSnapshotFormMode(false);
          setSnapshotName("");
          setSnapshotCommitMessage("");
          setSnapshotMetadata({});
          setSnapshotFormField("name");
          break;

        case "ssh":
          // Use service layer
          const sshKey = await createSSHKey(devbox.id);

          const fsModule = await import("fs");
          const pathModule = await import("path");
          const osModule = await import("os");

          const sshDir = pathModule.join(
            osModule.homedir(),
            ".runloop",
            "ssh_keys",
          );
          fsModule.mkdirSync(sshDir, { recursive: true });
          const keyPath = pathModule.join(sshDir, `${devbox.id}.pem`);

          fsModule.writeFileSync(keyPath, sshKey.ssh_private_key, {
            mode: 0o600,
          });

          const sshUser =
            devbox.launch_parameters?.user_parameters?.username || "user";
          const env = process.env.RUNLOOP_ENV?.toLowerCase();
          const sshHost = env === "dev" ? "ssh.runloop.pro" : "ssh.runloop.ai";
          // macOS openssl doesn't support -verify_quiet, use compatible flags
          // servername should be %h (target hostname) - SSH will replace %h with the actual hostname from the SSH command
          // This matches the reference implementation where servername is the target hostname
          const proxyCommand = `openssl s_client -quiet -servername %h -connect ${sshHost}:443 2>/dev/null`;

          // Navigate to SSH session screen
          navigate("ssh-session", {
            keyPath,
            proxyCommand,
            sshUser,
            url: sshKey.url,
            devboxId: devbox.id,
            devboxName: devbox.name || devbox.id,
            returnScreen: currentScreen,
            returnParams: params,
          });
          break;

        case "logs":
          // Set flag to show streaming logs viewer
          const logsResult: any = {
            __customRender: "logs",
          };
          setOperationResult(logsResult);
          break;

        case "tunnel":
          // Use service layer
          const port = parseInt(operationInput);
          if (isNaN(port) || port < 1 || port > 65535) {
            setOperationError(
              new Error(
                "Invalid port number. Please enter a port between 1 and 65535.",
              ),
            );
          } else {
            const tunnel = await createTunnel(devbox.id, port);
            // Store tunnel result with custom render type to enable "open in browser"
            const tunnelResult: any = {
              __customRender: "tunnel",
              __tunnelUrl: tunnel.url,
              __port: port,
            };
            setOperationResult(tunnelResult);
          }
          break;

        case "suspend":
          // Use service layer
          await suspendDevbox(devbox.id);
          setOperationResult(`Devbox ${devbox.id} suspended successfully`);
          break;

        case "resume":
          // Use service layer
          await resumeDevbox(devbox.id);
          setOperationResult(`Devbox ${devbox.id} resumed successfully`);
          break;

        case "delete":
          // Use service layer
          await shutdownDevbox(devbox.id);
          setOperationResult(`Devbox ${devbox.id} shut down successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const operationLabel =
    operations.find((o) => o.key === executingOperation)?.label || "Operation";

  // Show delete confirmation
  if (showDeleteConfirm) {
    return (
      <ConfirmationPrompt
        title="Shutdown Devbox"
        message={`Are you sure you want to shutdown "${devbox.name || devbox.id}"?`}
        details="The devbox will be terminated and all unsaved data will be lost."
        breadcrumbItems={[
          ...breadcrumbItems.slice(0, -1),
          { label: devbox.name || devbox.id },
          { label: "Shutdown", active: true },
        ]}
        confirmLabel="Yes, shutdown"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          executeOperation();
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation(null);
          onBack();
        }}
      />
    );
  }

  // Operation result display
  if (operationResult || operationError) {
    // Check for custom exec rendering
    if (
      operationResult &&
      typeof operationResult === "object" &&
      (operationResult as any).__customRender === "exec"
    ) {
      const command = (operationResult as any).command || "";
      const stdout = (operationResult as any).stdout || "";
      const stderr = (operationResult as any).stderr || "";
      const exitCode = (operationResult as any).exitCode;

      const stdoutLines = stdout ? stdout.split("\n") : [];
      const stderrLines = stderr ? stderr.split("\n") : [];
      const allLines = [...stdoutLines, ...stderrLines].filter(
        (line) => line !== "",
      );

      const viewportHeight = execViewport.viewportHeight;
      const maxScroll = Math.max(0, allLines.length - viewportHeight);
      const actualScroll = Math.min(execScroll, maxScroll);
      const visibleLines = allLines.slice(
        actualScroll,
        actualScroll + viewportHeight,
      );
      const hasMore = actualScroll + viewportHeight < allLines.length;
      const hasLess = actualScroll > 0;

      const exitCodeColor = exitCode === 0 ? colors.success : colors.error;

      return (
        <>
          <Breadcrumb
            items={[
              ...breadcrumbItems,
              { label: "Execute Command", active: true },
            ]}
          />

          {/* Command header */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.primary}
            paddingX={1}
            marginBottom={1}
          >
            <Box>
              <Text color={colors.primary} bold>
                {figures.play} Command:
              </Text>
              <Text> </Text>
              <Text color={colors.text}>
                {command.length > 500
                  ? command.substring(0, 500) + "..."
                  : command}
              </Text>
            </Box>
            <Box>
              <Text color={colors.textDim} dimColor>
                Exit Code:{" "}
              </Text>
              <Text color={exitCodeColor} bold>
                {exitCode}
              </Text>
            </Box>
          </Box>

          {/* Output display */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.border}
            paddingX={1}
          >
            {allLines.length === 0 && (
              <Text color={colors.textDim} dimColor>
                No output
              </Text>
            )}
            {visibleLines.map((line: string, index: number) => {
              const actualIndex = actualScroll + index;
              const isStderr = actualIndex >= stdoutLines.length;
              const lineColor = isStderr ? colors.error : colors.text;

              return (
                <Box key={index}>
                  <Text color={lineColor}>{line}</Text>
                </Box>
              );
            })}
          </Box>

          {/* Statistics bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color={colors.primary} bold>
              {figures.hamburger} {allLines.length}
            </Text>
            <Text color={colors.textDim} dimColor>
              {" "}
              lines
            </Text>
            {allLines.length > 0 && (
              <>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  •{" "}
                </Text>
                <Text color={colors.textDim} dimColor>
                  Viewing {actualScroll + 1}-
                  {Math.min(actualScroll + viewportHeight, allLines.length)} of{" "}
                  {allLines.length}
                </Text>
                {hasLess && (
                  <Text color={colors.primary}> {figures.arrowUp}</Text>
                )}
                {hasMore && (
                  <Text color={colors.primary}> {figures.arrowDown}</Text>
                )}
              </>
            )}
            {stdout && (
              <>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  •{" "}
                </Text>
                <Text color={colors.success} dimColor>
                  stdout: {stdoutLines.length} lines
                </Text>
              </>
            )}
            {stderr && (
              <>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  •{" "}
                </Text>
                <Text color={colors.error} dimColor>
                  stderr: {stderrLines.length} lines
                </Text>
              </>
            )}
            {copyStatus && (
              <>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  •{" "}
                </Text>
                <Text color={colors.success} bold>
                  {copyStatus}
                </Text>
              </>
            )}
          </Box>

          {/* Help bar */}
          <NavigationTips
            showArrows
            tips={[
              { key: "g", label: "Top" },
              { key: "G", label: "Bottom" },
              { key: "c", label: "Copy" },
              { key: "Enter/q/esc", label: "Back" },
            ]}
          />
        </>
      );
    }

    // Check for custom logs rendering - use streaming logs viewer
    if (
      operationResult &&
      typeof operationResult === "object" &&
      (operationResult as any).__customRender === "logs"
    ) {
      return (
        <StreamingLogsViewer
          devboxId={devbox.id}
          breadcrumbItems={[
            ...breadcrumbItems,
            { label: "Logs", active: true },
          ]}
          onBack={() => {
            // Clear state
            setOperationResult(null);
            setOperationError(null);
            setOperationInput("");

            // If skipOperationsMenu is true, go back to parent instead of operations menu
            if (skipOperationsMenu) {
              setExecutingOperation(null);
              onBack();
            } else {
              setExecutingOperation(null);
            }
          }}
        />
      );
    }

    // Check for custom tunnel rendering
    if (
      operationResult &&
      typeof operationResult === "object" &&
      (operationResult as any).__customRender === "tunnel"
    ) {
      const tunnelUrl = (operationResult as any).__tunnelUrl || "";
      const tunnelPort = (operationResult as any).__port || "";

      return (
        <>
          <Breadcrumb
            items={[...breadcrumbItems, { label: "Open Tunnel", active: true }]}
          />
          <Header title="Tunnel Created" />
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.success}
            paddingX={1}
            paddingY={1}
            marginBottom={1}
          >
            <Box marginBottom={1}>
              <Text color={colors.success} bold>
                {figures.tick} Tunnel created successfully!
              </Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>Port: </Text>
              <Text color={colors.primary} bold>
                {tunnelPort}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={colors.textDim}>Public URL: </Text>
            </Box>
            <Box>
              <Text color={colors.info} bold>
                {tunnelUrl}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={colors.textDim} dimColor>
                You can now access port {tunnelPort} on the devbox via this URL
              </Text>
            </Box>
            {copyStatus && (
              <Box marginTop={1}>
                <Text color={colors.success} bold>
                  {copyStatus}
                </Text>
              </Box>
            )}
          </Box>
          <NavigationTips
            tips={[
              { key: "o", label: "Open in Browser" },
              { key: "Enter/q/esc", label: "Back" },
            ]}
          />
        </>
      );
    }

    return (
      <>
        <Breadcrumb
          items={[...breadcrumbItems, { label: operationLabel, active: true }]}
        />
        <Header title="Operation Result" />
        {operationResult && <SuccessMessage message={operationResult} />}
        {operationError && (
          <ErrorMessage message="Operation failed" error={operationError} />
        )}
        <NavigationTips tips={[{ key: "Enter/q/esc", label: "Continue" }]} />
      </>
    );
  }

  // Snapshot form mode
  if (snapshotFormMode && executingOperation === "snapshot" && devbox) {
    if (loading) {
      return (
        <>
          <Breadcrumb
            items={[
              ...breadcrumbItems,
              { label: "Create Snapshot", active: true },
            ]}
          />
          <Header title="Creating Snapshot" />
          <SpinnerComponent message="Creating snapshot..." />
        </>
      );
    }

    const snapshotFields = [
      { key: "name", label: "Name (optional)" },
      { key: "metadata", label: "Metadata (optional)" },
      { key: "create", label: "Create Snapshot" },
    ] as const;

    const currentFieldIndex = snapshotFields.findIndex(
      (f) => f.key === snapshotFormField,
    );

    // Expanded metadata section
    if (inSnapshotMetadataSection) {
      const metadataKeys = Object.keys(snapshotMetadata);
      const maxIndex = metadataKeys.length + 1;

      return (
        <>
          <Breadcrumb
            items={[
              ...breadcrumbItems,
              { label: "Create Snapshot", active: true },
            ]}
          />
          <Header title="Create Snapshot - Metadata" />
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

            {/* Input form - shown when adding or editing */}
            {snapshotMetadataInputMode && (
              <Box
                flexDirection="column"
                marginTop={1}
                borderStyle="single"
                borderColor={
                  selectedSnapshotMetadataIndex === 0
                    ? colors.success
                    : colors.warning
                }
                paddingX={1}
              >
                <Text
                  color={
                    selectedSnapshotMetadataIndex === 0
                      ? colors.success
                      : colors.warning
                  }
                  bold
                >
                  {selectedSnapshotMetadataIndex === 0
                    ? "Adding New"
                    : "Editing"}
                </Text>
                <Box>
                  {snapshotMetadataInputMode === "key" ? (
                    <>
                      <Text color={colors.primary}>Key: </Text>
                      <TextInput
                        value={snapshotMetadataKey || ""}
                        onChange={setSnapshotMetadataKey}
                        placeholder="env"
                      />
                    </>
                  ) : (
                    <Text dimColor>Key: {snapshotMetadataKey || ""}</Text>
                  )}
                </Box>
                <Box>
                  {snapshotMetadataInputMode === "value" ? (
                    <>
                      <Text color={colors.primary}>Value: </Text>
                      <TextInput
                        value={snapshotMetadataValue || ""}
                        onChange={setSnapshotMetadataValue}
                        placeholder="production"
                      />
                    </>
                  ) : (
                    <Text dimColor>Value: {snapshotMetadataValue || ""}</Text>
                  )}
                </Box>
              </Box>
            )}

            {/* Navigation menu - shown when not in input mode */}
            {!snapshotMetadataInputMode && (
              <>
                {/* Add new option */}
                <Box marginTop={1}>
                  <Text
                    color={
                      selectedSnapshotMetadataIndex === 0
                        ? colors.primary
                        : colors.textDim
                    }
                  >
                    {selectedSnapshotMetadataIndex === 0
                      ? figures.pointer
                      : " "}{" "}
                  </Text>
                  <Text
                    color={
                      selectedSnapshotMetadataIndex === 0
                        ? colors.success
                        : colors.textDim
                    }
                    bold={selectedSnapshotMetadataIndex === 0}
                  >
                    + Add new metadata
                  </Text>
                </Box>

                {/* Existing items */}
                {metadataKeys.length > 0 && (
                  <Box flexDirection="column" marginTop={1}>
                    {metadataKeys.map((key, index) => {
                      const itemIndex = index + 1;
                      const isSelected =
                        selectedSnapshotMetadataIndex === itemIndex;
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
                            {key}: {snapshotMetadata[key]}
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
                      selectedSnapshotMetadataIndex === maxIndex
                        ? colors.primary
                        : colors.textDim
                    }
                  >
                    {selectedSnapshotMetadataIndex === maxIndex
                      ? figures.pointer
                      : " "}{" "}
                  </Text>
                  <Text
                    color={
                      selectedSnapshotMetadataIndex === maxIndex
                        ? colors.success
                        : colors.textDim
                    }
                    bold={selectedSnapshotMetadataIndex === maxIndex}
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
                {snapshotMetadataInputMode
                  ? `[Tab] Switch field • [Enter] ${snapshotMetadataInputMode === "key" ? "Next" : "Save"} • [esc] Cancel`
                  : `${figures.arrowUp}${figures.arrowDown} Navigate • [Enter] ${selectedSnapshotMetadataIndex === 0 ? "Add" : selectedSnapshotMetadataIndex === maxIndex ? "Done" : "Edit"} • [d] Delete • [esc] Back`}
              </Text>
            </Box>
          </Box>
        </>
      );
    }

    // Main snapshot form
    return (
      <>
        <Breadcrumb
          items={[
            ...breadcrumbItems,
            { label: "Create Snapshot", active: true },
          ]}
        />
        <Header title="Create Snapshot" />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color={colors.primary} bold>
              {(() => {
                const name = devbox.name || devbox.id;
                return name.length > 100
                  ? name.substring(0, 100) + "..."
                  : name;
              })()}
            </Text>
          </Box>

          {/* Name field */}
          <Box marginBottom={1}>
            <Text
              color={
                snapshotFormField === "name" ? colors.primary : colors.textDim
              }
            >
              {snapshotFormField === "name" ? figures.pointer : " "} Name:{" "}
            </Text>
            {snapshotFormField === "name" ? (
              <TextInput
                value={snapshotName}
                onChange={setSnapshotName}
                placeholder="my-snapshot (optional)"
              />
            ) : (
              <Text color={colors.text}>
                {snapshotName || "(auto-generated)"}
              </Text>
            )}
          </Box>

          {/* Commit message field */}
          <Box marginBottom={1}>
            <Text
              color={
                snapshotFormField === "commit_message"
                  ? colors.primary
                  : colors.textDim
              }
            >
              {snapshotFormField === "commit_message" ? figures.pointer : " "}{" "}
              Commit Message:{" "}
            </Text>
            {snapshotFormField === "commit_message" ? (
              <TextInput
                value={snapshotCommitMessage}
                onChange={setSnapshotCommitMessage}
                placeholder="Describe this snapshot (optional)"
              />
            ) : (
              <Text color={colors.text}>
                {snapshotCommitMessage || "(none)"}
              </Text>
            )}
          </Box>

          {/* Metadata field */}
          <Box marginBottom={1} flexDirection="column">
            <Box>
              <Text
                color={
                  snapshotFormField === "metadata"
                    ? colors.primary
                    : colors.textDim
                }
              >
                {snapshotFormField === "metadata" ? figures.pointer : " "}{" "}
                Metadata:{" "}
              </Text>
              <Text color={colors.text}>
                {Object.keys(snapshotMetadata).length} item(s)
              </Text>
              {snapshotFormField === "metadata" && (
                <Text color={colors.textDim} dimColor>
                  {" "}
                  [Enter to manage]
                </Text>
              )}
            </Box>
            {Object.keys(snapshotMetadata).length > 0 && (
              <Box marginLeft={4} flexDirection="column">
                {Object.entries(snapshotMetadata).map(([key, value]) => (
                  <Text key={key} color={colors.textDim} dimColor>
                    {key}: {value}
                  </Text>
                ))}
              </Box>
            )}
          </Box>

          {/* Create button */}
          <Box marginTop={1}>
            <Text
              color={
                snapshotFormField === "create" ? colors.success : colors.textDim
              }
              bold={snapshotFormField === "create"}
            >
              {snapshotFormField === "create" ? figures.pointer : " "}{" "}
              {figures.play} Create Snapshot
            </Text>
          </Box>
        </Box>
        <NavigationTips
          showArrows
          tips={[
            {
              key: "Enter",
              label: snapshotFormField === "create" ? "Create" : "Select",
            },
            { key: "q/esc", label: "Cancel" },
          ]}
        />
      </>
    );
  }

  // Operation input mode
  if (executingOperation && devbox) {
    const needsInput =
      executingOperation === "exec" ||
      executingOperation === "upload" ||
      executingOperation === "tunnel";

    if (loading) {
      return (
        <>
          <Breadcrumb
            items={[
              ...breadcrumbItems,
              { label: operationLabel, active: true },
            ]}
          />
          <Header title="Executing Operation" />
          <SpinnerComponent message="Please wait..." />
        </>
      );
    }

    if (!needsInput) {
      const messages: Record<string, string> = {
        ssh: "Creating SSH key...",
        logs: "Fetching logs...",
        suspend: "Suspending devbox...",
        resume: "Resuming devbox...",
        delete: "Shutting down devbox...",
      };
      return (
        <>
          <Breadcrumb
            items={[
              ...breadcrumbItems,
              { label: operationLabel, active: true },
            ]}
          />
          <Header title="Executing Operation" />
          <SpinnerComponent
            message={messages[executingOperation as string] || "Please wait..."}
          />
        </>
      );
    }

    const prompts: Record<string, string> = {
      exec: "Command to execute:",
      upload: "File path to upload:",
      tunnel: "Port number to expose:",
    };

    return (
      <>
        <Breadcrumb
          items={[...breadcrumbItems, { label: operationLabel, active: true }]}
        />
        <Header title={operationLabel} />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color={colors.primary} bold>
              {(() => {
                const name = devbox.name || devbox.id;
                return name.length > 100
                  ? name.substring(0, 100) + "..."
                  : name;
              })()}
            </Text>
          </Box>
          <Box>
            <Text color={colors.textDim}>{prompts[executingOperation]} </Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value={operationInput}
              onChange={setOperationInput}
              placeholder={
                executingOperation === "exec"
                  ? "ls -la"
                  : executingOperation === "upload"
                    ? "/path/to/file"
                    : "8080"
              }
            />
          </Box>
          <NavigationTips
            tips={
              executingOperation === "exec"
                ? [
                    { key: "Enter", label: "Execute" },
                    { key: "q/esc", label: "Cancel" },
                  ]
                : [
                    { key: "Enter", label: "Execute" },
                    { key: "q/esc", label: "Cancel" },
                  ]
            }
          />
        </Box>
      </>
    );
  }

  // Operations selection mode - only show if not skipping
  if (!skipOperationsMenu || !executingOperation) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box flexDirection="column">
          <Text color={colors.primary} bold>
            {figures.play} Operations
          </Text>
          <Box flexDirection="column">
            {operations.map((op, index) => {
              const isSelected = index === selectedOperation;
              return (
                <Box key={op.key}>
                  <Text color={isSelected ? colors.primary : colors.textDim}>
                    {isSelected ? figures.pointer : " "}{" "}
                  </Text>
                  <Text
                    color={isSelected ? op.color : colors.textDim}
                    bold={isSelected}
                  >
                    {op.icon} {op.label}
                  </Text>
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [{op.shortcut}]
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <NavigationTips
          showArrows
          paddingX={0}
          tips={[
            { key: "Enter", label: "Select" },
            { key: "q", label: "Back" },
          ]}
        />
      </>
    );
  }

  // If skipOperationsMenu is true and executingOperation is set, show loading while it executes
  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <SpinnerComponent message="Loading..." />
    </>
  );
};
