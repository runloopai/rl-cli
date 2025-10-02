import React from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import figures from 'figures';
import { getClient } from '../utils/client.js';
import { Header } from './Header.js';
import { SpinnerComponent } from './Spinner.js';
import { ErrorMessage } from './ErrorMessage.js';
import { SuccessMessage } from './SuccessMessage.js';
import { StatusBadge } from './StatusBadge.js';
import { MetadataDisplay } from './MetadataDisplay.js';
import { Breadcrumb } from './Breadcrumb.js';

type Operation = 'exec' | 'upload' | 'snapshot' | 'ssh' | 'logs' | 'tunnel' | 'suspend' | 'resume' | 'delete' | null;

interface DevboxDetailPageProps {
  devbox: any;
  onBack: () => void;
}

// Format time ago in a succinct way
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

export const DevboxDetailPage: React.FC<DevboxDetailPageProps> = ({ devbox: initialDevbox, onBack }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [loading, setLoading] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [executingOperation, setExecutingOperation] = React.useState<Operation>(null);
  const [operationInput, setOperationInput] = React.useState('');
  const [operationResult, setOperationResult] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<Error | null>(null);
  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);
  const [detailScroll, setDetailScroll] = React.useState(0);
  const [logsWrapMode, setLogsWrapMode] = React.useState(true);
  const [logsScroll, setLogsScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  const selectedDevbox = initialDevbox;

  // Memoize time-based values to prevent re-rendering on every tick
  const formattedCreateTime = React.useMemo(
    () => selectedDevbox.create_time_ms ? new Date(selectedDevbox.create_time_ms).toLocaleString() : '',
    [selectedDevbox.create_time_ms]
  );

  const createTimeAgo = React.useMemo(
    () => selectedDevbox.create_time_ms ? formatTimeAgo(selectedDevbox.create_time_ms) : '',
    [selectedDevbox.create_time_ms]
  );

  const allOperations = [
    { key: 'logs', label: 'View Logs', color: 'blue', icon: figures.info },
    { key: 'exec', label: 'Execute Command', color: 'green', icon: figures.play },
    { key: 'upload', label: 'Upload File', color: 'green', icon: figures.arrowUp },
    { key: 'snapshot', label: 'Create Snapshot', color: 'yellow', icon: figures.circleFilled },
    { key: 'ssh', label: 'SSH onto the box', color: 'cyan', icon: figures.arrowRight },
    { key: 'tunnel', label: 'Open Tunnel', color: 'magenta', icon: figures.pointerSmall },
    { key: 'suspend', label: 'Suspend Devbox', color: 'yellow', icon: figures.squareSmallFilled },
    { key: 'resume', label: 'Resume Devbox', color: 'green', icon: figures.play },
    { key: 'delete', label: 'Shutdown Devbox', color: 'red', icon: figures.cross },
  ];

  // Filter operations based on devbox status
  const operations = selectedDevbox ? allOperations.filter(op => {
    const status = selectedDevbox.status;

    // When suspended: logs and resume
    if (status === 'suspended') {
      return op.key === 'resume' || op.key === 'logs';
    }

    // When not running (shutdown, failure, etc): only logs
    if (status !== 'running' && status !== 'provisioning' && status !== 'initializing') {
      return op.key === 'logs';
    }

    // When running: everything except resume
    if (status === 'running') {
      return op.key !== 'resume';
    }

    // Default for transitional states (provisioning, initializing)
    return op.key === 'logs' || op.key === 'delete';
  }) : allOperations;

  // Auto-execute operations that don't need input (delete, ssh, logs, suspend, resume)
  React.useEffect(() => {
    if ((executingOperation === 'delete' || executingOperation === 'ssh' || executingOperation === 'logs' || executingOperation === 'suspend' || executingOperation === 'resume') && !loading && selectedDevbox) {
      executeOperation();
    }
  }, [executingOperation]);

  useInput((input, key) => {
    // Handle operation input mode
    if (executingOperation && !operationResult && !operationError) {
      if (key.return && operationInput.trim()) {
        executeOperation();
      } else if (input === 'q' || key.escape) {
        console.clear();
        setExecutingOperation(null);
        setOperationInput('');
      }
      return;
    }

    // Handle operation result display
    if (operationResult || operationError) {
      if (input === 'q' || key.escape || key.return) {
        console.clear();
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setOperationInput('');
        setLogsWrapMode(true); // Reset wrap mode
        setLogsScroll(0); // Reset scroll
        setCopyStatus(null); // Reset copy status
        // Keep detail view open
      } else if ((key.upArrow || input === 'k') && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Scroll up in logs
        setLogsScroll(Math.max(0, logsScroll - 1));
      } else if ((key.downArrow || input === 'j') && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Scroll down in logs
        setLogsScroll(logsScroll + 1);
      } else if (key.pageUp && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Page up
        setLogsScroll(Math.max(0, logsScroll - 10));
      } else if (key.pageDown && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Page down
        setLogsScroll(logsScroll + 10);
      } else if (input === 'g' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Jump to top
        setLogsScroll(0);
      } else if (input === 'G' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Jump to bottom (last line)
        const logs = (operationResult as any).__logs || [];
        const terminalHeight = stdout?.rows || 30;
        const viewportHeight = Math.max(10, terminalHeight - 10);
        const maxScroll = Math.max(0, logs.length - viewportHeight);
        setLogsScroll(maxScroll);
      } else if (input === 'w' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Toggle wrap mode for logs
        setLogsWrapMode(!logsWrapMode);
      } else if (input === 'c' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        // Copy logs to clipboard
        const logs = (operationResult as any).__logs || [];
        const logsText = logs.map((log: any) => {
          const time = new Date(log.timestamp_ms).toLocaleString();
          const level = log.level || 'INFO';
          const source = log.source || 'exec';
          const message = log.message || '';
          const cmd = log.cmd ? `[${log.cmd}] ` : '';
          const exitCode = log.exit_code !== null && log.exit_code !== undefined ? `(${log.exit_code}) ` : '';
          return `${time} ${level}/${source} ${exitCode}${cmd}${message}`;
        }).join('\n');

        // Copy to clipboard using pbcopy (macOS), xclip (Linux), or clip (Windows)
        const copyToClipboard = async (text: string) => {
          const { spawn } = await import('child_process');
          const platform = process.platform;

          let command: string;
          let args: string[];

          if (platform === 'darwin') {
            command = 'pbcopy';
            args = [];
          } else if (platform === 'win32') {
            command = 'clip';
            args = [];
          } else {
            command = 'xclip';
            args = ['-selection', 'clipboard'];
          }

          const proc = spawn(command, args);
          proc.stdin.write(text);
          proc.stdin.end();

          proc.on('exit', (code) => {
            if (code === 0) {
              setCopyStatus('Copied to clipboard!');
              setTimeout(() => setCopyStatus(null), 2000);
            } else {
              setCopyStatus('Failed to copy');
              setTimeout(() => setCopyStatus(null), 2000);
            }
          });

          proc.on('error', () => {
            setCopyStatus('Copy not supported');
            setTimeout(() => setCopyStatus(null), 2000);
          });
        };

        copyToClipboard(logsText);
      }
      return;
    }

    // Handle detailed info mode
    if (showDetailedInfo) {
      if (input === 'q' || key.escape) {
        setShowDetailedInfo(false);
        setDetailScroll(0);
      } else if (input === 'j' || input === 's' || key.downArrow) {
        // Scroll down in detailed info
        setDetailScroll(detailScroll + 1);
      } else if (input === 'k' || input === 'w' || key.upArrow) {
        // Scroll up in detailed info
        setDetailScroll(Math.max(0, detailScroll - 1));
      } else if (key.pageDown) {
        // Page down
        setDetailScroll(detailScroll + 10);
      } else if (key.pageUp) {
        // Page up
        setDetailScroll(Math.max(0, detailScroll - 10));
      }
      return;
    }

    // Operations selection mode
    if (input === 'q' || key.escape) {
      console.clear();
      onBack();
      setSelectedOperation(0);
    } else if (input === 'i') {
      setShowDetailedInfo(true);
      setDetailScroll(0);
    } else if (input === 'o') {
      // Open in browser
      const url = `https://platform.runloop.ai/devboxes/${selectedDevbox.id}`;
      const openBrowser = async () => {
        const { exec } = await import('child_process');
        const platform = process.platform;

        let openCommand: string;
        if (platform === 'darwin') {
          openCommand = `open "${url}"`;
        } else if (platform === 'win32') {
          openCommand = `start "${url}"`;
        } else {
          openCommand = `xdg-open "${url}"`;
        }

        exec(openCommand);
      };
      openBrowser();
    } else if (key.upArrow && selectedOperation > 0) {
      setSelectedOperation(selectedOperation - 1);
    } else if (key.downArrow && selectedOperation < operations.length - 1) {
      setSelectedOperation(selectedOperation + 1);
    } else if (key.return) {
      console.clear();
      const op = operations[selectedOperation].key as Operation;
      setExecutingOperation(op);
    }
  });

  const executeOperation = async () => {
    const client = getClient();
    const devbox = selectedDevbox;

    try {
      setLoading(true);
      switch (executingOperation) {
        case 'exec':
          const execResult = await client.devboxes.executeSync(devbox.id, {
            command: operationInput,
          });
          setOperationResult(execResult.stdout || execResult.stderr || 'Command executed');
          break;

        case 'upload':
          // For upload, operationInput should be file path
          const fs = await import('fs');
          const fileStream = fs.createReadStream(operationInput);
          const filename = operationInput.split('/').pop() || 'file';
          await client.devboxes.uploadFile(devbox.id, {
            path: filename,
            file: fileStream,
          });
          setOperationResult(`File ${filename} uploaded successfully`);
          break;

        case 'snapshot':
          const snapshot = await client.devboxes.snapshotDisk(devbox.id, {
            name: operationInput || `snapshot-${Date.now()}`,
          });
          setOperationResult(`Snapshot created: ${snapshot.id}`);
          break;

        case 'ssh':
          const sshKey = await client.devboxes.createSSHKey(devbox.id);

          // Save SSH key to persistent location
          const fsModule = await import('fs');
          const pathModule = await import('path');
          const osModule = await import('os');

          const sshDir = pathModule.join(osModule.homedir(), '.runloop', 'ssh_keys');
          fsModule.mkdirSync(sshDir, { recursive: true });
          const keyPath = pathModule.join(sshDir, `${devbox.id}.pem`);

          fsModule.writeFileSync(keyPath, sshKey.ssh_private_key, { mode: 0o600 });

          // Determine user from launch parameters
          const sshUser = devbox.launch_parameters?.user_parameters?.username || 'user';

          const proxyCommand = 'openssl s_client -quiet -verify_quiet -servername %h -connect ssh.runloop.ai:443 2>/dev/null';

          // Store SSH command details globally
          (global as any).__sshCommand = {
            keyPath,
            proxyCommand,
            sshUser,
            url: sshKey.url,
            devboxName: devbox.name || devbox.id
          };

          // Exit Ink app to release terminal, SSH will be spawned after exit
          exit();
          break;

        case 'logs':
          const logsResult = await client.devboxes.logs.list(devbox.id);
          if (logsResult.logs.length === 0) {
            setOperationResult('No logs available for this devbox.');
          } else {
            // Store logs data for custom rendering - show all logs
            (logsResult as any).__customRender = 'logs';
            (logsResult as any).__logs = logsResult.logs; // Show all logs, not just last 50
            (logsResult as any).__totalCount = logsResult.logs.length;
            setOperationResult(logsResult as any);
          }
          break;

        case 'tunnel':
          const port = parseInt(operationInput);
          if (isNaN(port) || port < 1 || port > 65535) {
            setOperationError(new Error('Invalid port number. Please enter a port between 1 and 65535.'));
          } else {
            const tunnel = await client.devboxes.createTunnel(devbox.id, { port });
            setOperationResult(
              `Tunnel created!\n\n` +
              `Local Port: ${port}\n` +
              `Public URL: ${tunnel.url}\n\n` +
              `You can now access port ${port} on the devbox via:\n${tunnel.url}`
            );
          }
          break;

        case 'suspend':
          await client.devboxes.suspend(devbox.id);
          setOperationResult(`Devbox ${devbox.id} suspended successfully`);
          break;

        case 'resume':
          await client.devboxes.resume(devbox.id);
          setOperationResult(`Devbox ${devbox.id} resumed successfully`);
          break;

        case 'delete':
          await client.devboxes.shutdown(devbox.id);
          setOperationResult(`Devbox ${devbox.id} shut down successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const uptime = selectedDevbox.create_time_ms
    ? Math.floor((Date.now() - selectedDevbox.create_time_ms) / 1000 / 60)
    : null;

  // Build detailed info lines for scrolling
  const buildDetailLines = (): JSX.Element[] => {
    const lines: JSX.Element[] = [];

    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

    // Core Information
    lines.push(<Text key="core-title" color="yellow" bold>Devbox Details</Text>);
    lines.push(<Text key="core-id" dimColor>  ID: {selectedDevbox.id}</Text>);
    lines.push(<Text key="core-name" dimColor>  Name: {selectedDevbox.name || '(none)'}</Text>);
    lines.push(<Text key="core-status" dimColor>  Status: {capitalize(selectedDevbox.status)}</Text>);
    lines.push(<Text key="core-created" dimColor>  Created: {new Date(selectedDevbox.create_time_ms).toLocaleString()}</Text>);
    if (selectedDevbox.end_time_ms) {
      lines.push(<Text key="core-ended" dimColor>  Ended: {new Date(selectedDevbox.end_time_ms).toLocaleString()}</Text>);
    }
    lines.push(<Text key="core-space"> </Text>);

    // Capabilities
    if (selectedDevbox.capabilities && selectedDevbox.capabilities.length > 0) {
      lines.push(<Text key="cap-title" color="yellow" bold>Capabilities</Text>);
      selectedDevbox.capabilities.forEach((cap: string, idx: number) => {
        lines.push(<Text key={`cap-${idx}`} dimColor>  {figures.pointer} {cap}</Text>);
      });
      lines.push(<Text key="cap-space"> </Text>);
    }

    // Launch Parameters
    if (selectedDevbox.launch_parameters) {
      lines.push(<Text key="launch-title" color="yellow" bold>Launch Parameters</Text>);

      const lp = selectedDevbox.launch_parameters;

      if (lp.resource_size_request) {
        lines.push(<Text key="launch-size-req" dimColor>  Resource Size Request: {lp.resource_size_request}</Text>);
      }
      if (lp.architecture) {
        lines.push(<Text key="launch-arch" dimColor>  Architecture: {lp.architecture}</Text>);
      }
      if (lp.custom_cpu_cores) {
        lines.push(<Text key="launch-cpu" dimColor>  CPU Cores: {lp.custom_cpu_cores}</Text>);
      }
      if (lp.custom_gb_memory) {
        lines.push(<Text key="launch-memory" dimColor>  Memory: {lp.custom_gb_memory}GB</Text>);
      }
      if (lp.custom_disk_size) {
        lines.push(<Text key="launch-disk" dimColor>  Disk Size: {lp.custom_disk_size}GB</Text>);
      }
      if (lp.keep_alive_time_seconds) {
        lines.push(<Text key="launch-keepalive" dimColor>  Keep Alive: {lp.keep_alive_time_seconds}s ({Math.floor(lp.keep_alive_time_seconds / 60)}m)</Text>);
      }
      if (lp.after_idle) {
        lines.push(<Text key="launch-afteridle" dimColor>  After Idle: {lp.after_idle.on_idle} after {lp.after_idle.idle_time_seconds}s</Text>);
      }
      if (lp.available_ports && lp.available_ports.length > 0) {
        lines.push(<Text key="launch-ports" dimColor>  Available Ports: {lp.available_ports.join(', ')}</Text>);
      }
      if (lp.launch_commands && lp.launch_commands.length > 0) {
        lines.push(<Text key="launch-launch-cmds" dimColor>  Launch Commands:</Text>);
        lp.launch_commands.forEach((cmd: string, idx: number) => {
          lines.push(<Text key={`launch-cmd-${idx}`} dimColor>    {figures.pointer} {cmd}</Text>);
        });
      }
      if (lp.required_services && lp.required_services.length > 0) {
        lines.push(<Text key="launch-services" dimColor>  Required Services: {lp.required_services.join(', ')}</Text>);
      }
      if (lp.user_parameters) {
        lines.push(<Text key="launch-user" dimColor>  User Parameters:</Text>);
        if (lp.user_parameters.username) {
          lines.push(<Text key="user-name" dimColor>    Username: {lp.user_parameters.username}</Text>);
        }
        if (lp.user_parameters.uid) {
          lines.push(<Text key="user-uid" dimColor>    UID: {lp.user_parameters.uid}</Text>);
        }
      }
      lines.push(<Text key="launch-space"> </Text>);
    }

    // Source
    if (selectedDevbox.blueprint_id || selectedDevbox.snapshot_id) {
      lines.push(<Text key="source-title" color="yellow" bold>Source</Text>);
      if (selectedDevbox.blueprint_id) {
        lines.push(<Text key="source-bp" dimColor>  Blueprint: {selectedDevbox.blueprint_id}</Text>);
      }
      if (selectedDevbox.snapshot_id) {
        lines.push(<Text key="source-snap" dimColor>  Snapshot: {selectedDevbox.snapshot_id}</Text>);
      }
      lines.push(<Text key="source-space"> </Text>);
    }

    // Initiator
    if (selectedDevbox.initiator_type) {
      lines.push(<Text key="init-title" color="yellow" bold>Initiator</Text>);
      lines.push(<Text key="init-type" dimColor>  Type: {selectedDevbox.initiator_type}</Text>);
      if (selectedDevbox.initiator_id) {
        lines.push(<Text key="init-id" dimColor>  ID: {selectedDevbox.initiator_id}</Text>);
      }
      lines.push(<Text key="init-space"> </Text>);
    }

    // Status Details
    if (selectedDevbox.failure_reason || selectedDevbox.shutdown_reason) {
      lines.push(<Text key="status-title" color="yellow" bold>Status Details</Text>);
      if (selectedDevbox.failure_reason) {
        lines.push(<Text key="status-fail" color="red" dimColor>  Failure Reason: {selectedDevbox.failure_reason}</Text>);
      }
      if (selectedDevbox.shutdown_reason) {
        lines.push(<Text key="status-shut" dimColor>  Shutdown Reason: {selectedDevbox.shutdown_reason}</Text>);
      }
      lines.push(<Text key="status-space"> </Text>);
    }

    // Metadata
    if (selectedDevbox.metadata && Object.keys(selectedDevbox.metadata).length > 0) {
      lines.push(<Text key="meta-title" color="yellow" bold>Metadata</Text>);
      Object.entries(selectedDevbox.metadata).forEach(([key, value], idx) => {
        lines.push(<Text key={`meta-${idx}`} dimColor>  {key}: {value as string}</Text>);
      });
      lines.push(<Text key="meta-space"> </Text>);
    }

    // State Transitions
    if (selectedDevbox.state_transitions && selectedDevbox.state_transitions.length > 0) {
      lines.push(<Text key="state-title" color="yellow" bold>State History</Text>);
      selectedDevbox.state_transitions.forEach((transition: any, idx: number) => {
        const text = `${idx + 1}. ${capitalize(transition.status)}${transition.transition_time_ms ? ` at ${new Date(transition.transition_time_ms).toLocaleString()}` : ''}`;
        lines.push(<Text key={`state-${idx}`} dimColor>  {text}</Text>);
      });
      lines.push(<Text key="state-space"> </Text>);
    }

    // Raw JSON (full)
    lines.push(<Text key="json-title" color="yellow" bold>Raw JSON</Text>);
    const jsonLines = JSON.stringify(selectedDevbox, null, 2).split('\n');
    jsonLines.forEach((line, idx) => {
      lines.push(<Text key={`json-${idx}`} dimColor>  {line}</Text>);
    });

    return lines;
  };

  // Operation result display
  if (operationResult || operationError) {
    const operationLabel = operations.find((o) => o.key === executingOperation)?.label || 'Operation';

    // Check for custom logs rendering
    if (operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
      const logs = (operationResult as any).__logs || [];
      const totalCount = (operationResult as any).__totalCount || 0;

      // Calculate viewport for scrolling
      const terminalHeight = stdout?.rows || 30;
      const terminalWidth = stdout?.columns || 120;
      const viewportHeight = Math.max(10, terminalHeight - 10); // Reserve space for header/footer
      const maxScroll = Math.max(0, logs.length - viewportHeight);
      const actualScroll = Math.min(logsScroll, maxScroll);
      const visibleLogs = logs.slice(actualScroll, actualScroll + viewportHeight);
      const hasMore = actualScroll + viewportHeight < logs.length;
      const hasLess = actualScroll > 0;

      return (
        <>
          <Breadcrumb items={[
            { label: 'Devboxes' },
            { label: selectedDevbox?.name || selectedDevbox?.id || 'Devbox' },
            { label: 'Logs', active: true }
          ]} />

          {/* Logs display with border */}
          <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
            {visibleLogs.map((log: any, index: number) => {
              const time = new Date(log.timestamp_ms).toLocaleTimeString();
              const level = log.level ? log.level[0].toUpperCase() : 'I';
              const source = log.source ? log.source.substring(0, 8) : 'exec';
              const fullMessage = log.message || '';
              const cmd = log.cmd ? `[${log.cmd.substring(0, 40)}${log.cmd.length > 40 ? '...' : ''}] ` : '';
              const exitCode = log.exit_code !== null && log.exit_code !== undefined ? `(${log.exit_code}) ` : '';

              let levelColor = 'gray';
              if (level === 'E') levelColor = 'red';
              else if (level === 'W') levelColor = 'yellow';
              else if (level === 'I') levelColor = 'cyan';

              if (logsWrapMode) {
                // Wrap mode: show full message on same line, let terminal handle wrapping
                return (
                  <Box key={index}>
                    <Text color="gray" dimColor>{time}</Text>
                    <Text> </Text>
                    <Text color={levelColor} bold>{level}</Text>
                    <Text color="gray" dimColor>/{source}</Text>
                    <Text> </Text>
                    {exitCode && <Text color="yellow">{exitCode}</Text>}
                    {cmd && <Text color="blue" dimColor>{cmd}</Text>}
                    <Text>{fullMessage}</Text>
                  </Box>
                );
              } else {
                // No-wrap mode: calculate actual metadata width and truncate accordingly
                // Time (11) + space (1) + Level (1) + /source (1+8) + space (1) + exitCode.length + cmd.length + border/padding (6)
                const metadataWidth = 11 + 1 + 1 + 1 + 8 + 1 + exitCode.length + cmd.length + 6;
                const availableMessageWidth = Math.max(20, terminalWidth - metadataWidth);
                const truncatedMessage = fullMessage.length > availableMessageWidth
                  ? fullMessage.substring(0, availableMessageWidth - 3) + '...'
                  : fullMessage;
                return (
                  <Box key={index}>
                    <Text color="gray" dimColor>{time}</Text>
                    <Text> </Text>
                    <Text color={levelColor} bold>{level}</Text>
                    <Text color="gray" dimColor>/{source}</Text>
                    <Text> </Text>
                    {exitCode && <Text color="yellow">{exitCode}</Text>}
                    {cmd && <Text color="blue" dimColor>{cmd}</Text>}
                    <Text>{truncatedMessage}</Text>
                  </Box>
                );
              }
            })}

            {/* Scroll indicators */}
            {hasLess && (
              <Box>
                <Text color="cyan">{figures.arrowUp} More above</Text>
              </Box>
            )}
            {hasMore && (
              <Box>
                <Text color="cyan">{figures.arrowDown} More below</Text>
              </Box>
            )}
          </Box>

          {/* Statistics bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color="cyan" bold>
              {figures.hamburger} {totalCount}
            </Text>
            <Text color="gray" dimColor> total logs</Text>
            <Text color="gray" dimColor> • </Text>
            <Text color="gray" dimColor>
              Viewing {actualScroll + 1}-{Math.min(actualScroll + viewportHeight, logs.length)} of {logs.length}
            </Text>
            <Text color="gray" dimColor> • </Text>
            <Text color={logsWrapMode ? 'green' : 'gray'} bold={logsWrapMode}>
              {logsWrapMode ? 'Wrap: ON' : 'Wrap: OFF'}
            </Text>
            {copyStatus && (
              <>
                <Text color="gray" dimColor> • </Text>
                <Text color="green" bold>{copyStatus}</Text>
              </>
            )}
          </Box>

          {/* Help bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color="gray" dimColor>
              {figures.arrowUp}{figures.arrowDown} Navigate • [g] Top • [G] Bottom • [w] Toggle Wrap • [c] Copy • [Enter], [q], or [esc] Back
            </Text>
          </Box>
        </>
      );
    }

    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes' },
          { label: selectedDevbox?.name || selectedDevbox?.id || 'Devbox' },
          { label: operationLabel, active: true }
        ]} />
        <Header title="Operation Result" />
        {operationResult && <SuccessMessage message={operationResult} />}
        {operationError && <ErrorMessage message="Operation failed" error={operationError} />}
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Press [Enter], [q], or [esc] to continue
          </Text>
        </Box>
      </>
    );
  }

  // Operation input mode
  if (executingOperation && selectedDevbox) {
    const needsInput =
      executingOperation === 'exec' ||
      executingOperation === 'upload' ||
      executingOperation === 'snapshot' ||
      executingOperation === 'tunnel';

    const operationLabel = operations.find((o) => o.key === executingOperation)?.label || 'Operation';

    if (loading) {
      return (
        <>
          <Breadcrumb items={[
            { label: 'Devboxes' },
            { label: selectedDevbox.name || selectedDevbox.id },
            { label: operationLabel, active: true }
          ]} />
          <Header title="Executing Operation" />
          <SpinnerComponent message="Please wait..." />
        </>
      );
    }

    if (!needsInput) {
      // SSH, Logs, Suspend, Resume, and Delete operations are auto-executed via useEffect
      const messages: Record<string, string> = {
        ssh: 'Creating SSH key...',
        logs: 'Fetching logs...',
        suspend: 'Suspending devbox...',
        resume: 'Resuming devbox...',
        delete: 'Shutting down devbox...',
      };
      return (
        <>
          <Breadcrumb items={[
            { label: 'Devboxes' },
            { label: selectedDevbox.name || selectedDevbox.id },
            { label: operationLabel, active: true }
          ]} />
          <Header title="Executing Operation" />
          <SpinnerComponent message={messages[executingOperation as string] || 'Please wait...'} />
        </>
      );
    }

    const prompts: Record<string, string> = {
      exec: 'Command to execute:',
      upload: 'File path to upload:',
      snapshot: 'Snapshot name (optional):',
      tunnel: 'Port number to expose:',
    };

    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes' },
          { label: selectedDevbox.name || selectedDevbox.id },
          { label: operationLabel, active: true }
        ]} />
        <Header title={operationLabel} />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {selectedDevbox.name || selectedDevbox.id}
            </Text>
          </Box>
          <Box>
            <Text color="gray">{prompts[executingOperation]} </Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value={operationInput}
              onChange={setOperationInput}
              placeholder={
                executingOperation === 'exec'
                  ? 'ls -la'
                  : executingOperation === 'upload'
                  ? '/path/to/file'
                  : executingOperation === 'tunnel'
                  ? '8080'
                  : 'my-snapshot'
              }
            />
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              Press [Enter] to execute • [q or esc] Cancel
            </Text>
          </Box>
        </Box>
      </>
    );
  }

  // Detailed info mode - full screen
  if (showDetailedInfo) {
    const detailLines = buildDetailLines();
    const terminalHeight = stdout?.rows || 30;
    const viewportHeight = Math.max(10, terminalHeight - 12); // Reserve space for header/footer
    const maxScroll = Math.max(0, detailLines.length - viewportHeight);
    const actualScroll = Math.min(detailScroll, maxScroll);
    const visibleLines = detailLines.slice(actualScroll, actualScroll + viewportHeight);
    const hasMore = actualScroll + viewportHeight < detailLines.length;
    const hasLess = actualScroll > 0;

    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes' },
          { label: selectedDevbox.name || selectedDevbox.id },
          { label: 'Full Details', active: true }
        ]} />
        <Header
          title={`${selectedDevbox.name || selectedDevbox.id} - Complete Information`}
        />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <StatusBadge status={selectedDevbox.status} />
            <Text> </Text>
            <Text color="gray" dimColor>{selectedDevbox.id}</Text>
          </Box>
        </Box>

        <Box
          flexDirection="column"
          marginTop={1}
          marginBottom={1}
          borderStyle="round"
          borderColor="gray"
          paddingX={2}
          paddingY={1}
        >
          <Box flexDirection="column">
            {visibleLines}
          </Box>
          {hasLess && (
            <Box marginTop={1}>
              <Text color="cyan">{figures.arrowUp} More above</Text>
            </Box>
          )}
          {hasMore && (
            <Box marginTop={hasLess ? 0 : 1}>
              <Text color="cyan">{figures.arrowDown} More below</Text>
            </Box>
          )}
        </Box>

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Scroll • [q or esc] Back to Operations • Line {actualScroll + 1}-{Math.min(actualScroll + viewportHeight, detailLines.length)} of {detailLines.length}
          </Text>
        </Box>
      </>
    );
  }

  // Operations selection mode (main detail view)
  const lp = selectedDevbox.launch_parameters;
  const hasCapabilities = selectedDevbox.capabilities && selectedDevbox.capabilities.filter((c: string) => c !== 'unknown').length > 0;

  return (
    <>
      <Breadcrumb items={[
        { label: 'Devboxes' },
        { label: selectedDevbox.name || selectedDevbox.id, active: true }
      ]} />
      <Header title="Devbox Details" />

      {/* Compact info section */}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
        <Box>
          <Text color="cyan" bold>{selectedDevbox.name || selectedDevbox.id}</Text>
          <Text> </Text>
          <StatusBadge status={selectedDevbox.status} />
          <Text color="gray" dimColor> • {selectedDevbox.id}</Text>
        </Box>
        <Box>
          <Text color="gray" dimColor>{formattedCreateTime}</Text>
          <Text color="gray" dimColor> ({createTimeAgo})</Text>
        </Box>
        {uptime !== null && selectedDevbox.status === 'running' && (
          <Box>
            <Text color="green" dimColor>Uptime: {uptime < 60 ? `${uptime}m` : `${Math.floor(uptime / 60)}h ${uptime % 60}m`}</Text>
            {lp?.keep_alive_time_seconds && (
              <Text color="gray" dimColor> • Keep-alive: {Math.floor(lp.keep_alive_time_seconds / 60)}m</Text>
            )}
          </Box>
        )}
      </Box>

      {/* Compact resources + capabilities + source in one row */}
      <Box flexDirection="row" gap={1}>
        {/* Resources */}
        {(lp?.resource_size_request || lp?.custom_cpu_cores || lp?.custom_gb_memory || lp?.custom_disk_size || lp?.architecture) && (
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0} flexGrow={1}>
            <Text color="yellow" bold>{figures.squareSmallFilled} Resources</Text>
            <Text dimColor>
              {lp?.resource_size_request && `${lp.resource_size_request}`}
              {lp?.architecture && ` • ${lp.architecture}`}
              {lp?.custom_cpu_cores && ` • ${lp.custom_cpu_cores}VCPU`}
              {lp?.custom_gb_memory && ` • ${lp.custom_gb_memory}GB RAM`}
              {lp?.custom_disk_size && ` • ${lp.custom_disk_size}GB DISC`}
            </Text>
          </Box>
        )}

        {/* Capabilities */}
        {hasCapabilities && (
          <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} paddingY={0} flexGrow={1}>
            <Text color="blue" bold>{figures.tick} Capabilities</Text>
            <Text dimColor>{selectedDevbox.capabilities.filter((c: string) => c !== 'unknown').join(', ')}</Text>
          </Box>
        )}

        {/* Source */}
        {(selectedDevbox.blueprint_id || selectedDevbox.snapshot_id) && (
          <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} paddingY={0} flexGrow={1}>
            <Text color="magenta" bold>{figures.circleFilled} Source</Text>
            <Text dimColor>
              {selectedDevbox.blueprint_id && `BP: ${selectedDevbox.blueprint_id}`}
              {selectedDevbox.snapshot_id && `Snap: ${selectedDevbox.snapshot_id}`}
            </Text>
          </Box>
        )}
      </Box>

      {/* Metadata - compact */}
      {selectedDevbox.metadata && Object.keys(selectedDevbox.metadata).length > 0 && (
        <Box borderStyle="round" borderColor="green" paddingX={1} paddingY={0}>
          <MetadataDisplay metadata={selectedDevbox.metadata} showBorder={false} />
        </Box>
      )}

      {/* Failure - compact */}
      {selectedDevbox.failure_reason && (
        <Box borderStyle="round" borderColor="red" paddingX={1} paddingY={0}>
          <Text color="red" bold>{figures.cross} </Text>
          <Text color="red" dimColor>{selectedDevbox.failure_reason}</Text>
        </Box>
      )}

      {/* Operations - compact */}
      <Box flexDirection="column">
        <Text color="cyan" bold>{figures.play} Operations</Text>
        <Box flexDirection="column">
          {operations.map((op, index) => {
            const isSelected = index === selectedOperation;
            return (
              <Box key={op.key}>
                <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? figures.pointer : ' '} </Text>
                <Text color={isSelected ? op.color : 'gray'} bold={isSelected}>{op.icon} {op.label}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {figures.arrowUp}{figures.arrowDown} Navigate • [Enter] Select • [i] Full Details • [o] Browser • [q] Back
        </Text>
      </Box>
    </>
  );
};
