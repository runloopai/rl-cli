import React from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import figures from 'figures';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { Banner } from '../../components/Banner.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { StatusBadge, getStatusDisplay } from '../../components/StatusBadge.js';
import { MetadataDisplay } from '../../components/MetadataDisplay.js';
import { Breadcrumb } from '../../components/Breadcrumb.js';
import { Table, createTextColumn, createComponentColumn } from '../../components/Table.js';

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

interface ListOptions {
  status?: string;
}

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

type Operation = 'exec' | 'upload' | 'snapshot' | 'ssh' | 'logs' | 'tunnel' | 'suspend' | 'resume' | 'delete' | null;

const ListDevboxesUI: React.FC<{ status?: string }> = ({ status }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [loading, setLoading] = React.useState(true);
  const [devboxes, setDevboxes] = React.useState<any[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showDetails, setShowDetails] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [executingOperation, setExecutingOperation] = React.useState<Operation>(null);
  const [operationInput, setOperationInput] = React.useState('');
  const [operationResult, setOperationResult] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<Error | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshIcon, setRefreshIcon] = React.useState(0);
  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);
  const [detailScroll, setDetailScroll] = React.useState(0);

  // Calculate responsive column widths
  const terminalWidth = stdout?.columns || 120;
  const fixedWidth = 6; // pointer + status icon + spaces
  const idWidth = 25;
  const timeWidth = 20;
  const capabilitiesWidth = 18;
  const tagWidth = 6;

  // Responsive layout based on terminal width
  const showCapabilities = terminalWidth >= 100;
  const showTags = terminalWidth >= 90;
  const showFullId = terminalWidth >= 80;

  let nameWidth = 25;
  if (terminalWidth >= 120) {
    const remainingWidth = terminalWidth - fixedWidth - idWidth - timeWidth - capabilitiesWidth - tagWidth - 10;
    nameWidth = Math.max(20, Math.min(40, remainingWidth));
  } else if (terminalWidth >= 100) {
    nameWidth = terminalWidth - fixedWidth - idWidth - timeWidth - capabilitiesWidth - 10;
  } else if (terminalWidth >= 90) {
    nameWidth = terminalWidth - fixedWidth - idWidth - timeWidth - 8;
  } else if (terminalWidth >= 80) {
    nameWidth = terminalWidth - fixedWidth - idWidth - timeWidth - 8;
  } else {
    nameWidth = terminalWidth - fixedWidth - 15 - timeWidth - 8; // Short ID mode
  }

  const allOperations = [
    { key: 'exec', label: 'Execute Command', color: 'green', icon: figures.play },
    { key: 'upload', label: 'Upload File', color: 'green', icon: figures.arrowUp },
    { key: 'snapshot', label: 'Create Snapshot', color: 'yellow', icon: figures.circleFilled },
    { key: 'ssh', label: 'SSH onto the box', color: 'cyan', icon: figures.arrowRight },
    { key: 'logs', label: 'View Logs', color: 'blue', icon: figures.info },
    { key: 'tunnel', label: 'Open Tunnel', color: 'magenta', icon: figures.pointerSmall },
    { key: 'suspend', label: 'Suspend Devbox', color: 'yellow', icon: figures.squareSmallFilled },
    { key: 'resume', label: 'Resume Devbox', color: 'green', icon: figures.play },
    { key: 'delete', label: 'Delete Devbox', color: 'red', icon: figures.cross },
  ];

  React.useEffect(() => {
    const list = async () => {
      try {
        setRefreshing(true);
        const client = getClient();
        const allDevboxes: any[] = [];

        let count = 0;
        for await (const devbox of client.devboxes.list()) {
          if (!status || devbox.status === status) {
            allDevboxes.push(devbox);
          }
          count++;
          if (count >= MAX_FETCH) {
            break;
          }
        }

        setDevboxes(allDevboxes);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
        // Show refresh indicator briefly
        setTimeout(() => setRefreshing(false), 300);
      }
    };

    list();

    // Poll every 2 seconds, but only when in list view (not detail view)
    const interval = setInterval(() => {
      if (!showDetails && !showDetailedInfo) {
        list();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [showDetails, showDetailedInfo]);

  // Clear console when transitioning to detail view
  const prevShowDetailsRef = React.useRef(showDetails);
  React.useEffect(() => {
    // Only clear when transitioning from list to detail view (false -> true)
    if (showDetails && !prevShowDetailsRef.current) {
      console.clear();
    }
    prevShowDetailsRef.current = showDetails;
  }, [showDetails]);

  // Auto-execute operations that don't need input (delete, ssh, logs, suspend, resume)
  React.useEffect(() => {
    if ((executingOperation === 'delete' || executingOperation === 'ssh' || executingOperation === 'logs' || executingOperation === 'suspend' || executingOperation === 'resume') && !loading && selectedDevbox) {
      executeOperation();
    }
  }, [executingOperation]);

  // Animate refresh icon
  React.useEffect(() => {
    const interval = setInterval(() => {
      setRefreshIcon((prev) => (prev + 1) % 10);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    const pageDevboxes = currentDevboxes.length;

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
        // Keep showDetails true to return to detail page instead of list
      }
      return;
    }

    // Handle details view
    if (showDetails) {
      if (showDetailedInfo) {
        // In detailed info mode - only scrolling and back
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
      } else {
        // In operations selection mode
        if (input === 'q' || key.escape) {
          console.clear();
          setShowDetails(false);
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
      }
      return;
    }

    // Handle list view
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageDevboxes - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if ((input === 'n' || key.rightArrow) && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if ((input === 'p' || key.leftArrow) && currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (key.return) {
      console.clear();
      setShowDetails(true);
    } else if (input === 'o' && selectedDevbox) {
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
    } else if (input === 'q') {
      process.exit(0);
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
            const logsFormatted = logsResult.logs
              .slice(-50) // Show last 50 logs
              .map((log) => {
                const time = new Date(log.timestamp_ms).toLocaleTimeString();
                const level = log.level ? log.level[0].toUpperCase() : 'I';
                const source = log.source ? log.source.substring(0, 4) : 'exec';
                const message = (log.message || '').substring(0, 100);
                const cmd = log.cmd ? ` [${log.cmd.substring(0, 30)}${log.cmd.length > 30 ? '...' : ''}]` : '';
                const exitCode = log.exit_code !== null && log.exit_code !== undefined ? ` (${log.exit_code})` : '';
                return `${time} ${level}/${source}${exitCode}${cmd} ${message}`;
              })
              .join('\n');
            setOperationResult(`Logs (last ${Math.min(50, logsResult.logs.length)} of ${logsResult.logs.length}):\n\n${logsFormatted}`);
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
          setOperationResult(`Devbox ${devbox.id} deleted successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const running = devboxes.filter((d) => d.status === 'running').length;
  const stopped = devboxes.filter((d) =>
    ['stopped', 'suspended'].includes(d.status)
  ).length;

  const totalPages = Math.ceil(devboxes.length / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, devboxes.length);
  const currentDevboxes = devboxes.slice(startIndex, endIndex);
  const selectedDevbox = currentDevboxes[selectedIndex];

  // Filter operations based on devbox status
  const operations = selectedDevbox ? allOperations.filter(op => {
    const status = selectedDevbox.status;

    // When suspended: only resume
    if (status === 'suspended') {
      return op.key === 'resume';
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

  // Operation result display
  if (operationResult || operationError) {
    const operationLabel = operations.find((o) => o.key === executingOperation)?.label || 'Operation';
    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes' },
          { label: selectedDevbox?.name || selectedDevbox?.id.slice(0, 12) || 'Devbox' },
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
            { label: selectedDevbox.name || selectedDevbox.id.slice(0, 12) },
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
        delete: 'Deleting devbox...',
      };
      return (
        <>
          <Breadcrumb items={[
            { label: 'Devboxes' },
            { label: selectedDevbox.name || selectedDevbox.id.slice(0, 12) },
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
          { label: selectedDevbox.name || selectedDevbox.id.slice(0, 12) },
          { label: operationLabel, active: true }
        ]} />
        <Header title={operationLabel} />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {selectedDevbox.name || selectedDevbox.id.slice(0, 12)}
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

  // Details view with operation selection
  if (showDetails && selectedDevbox) {
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
            { label: selectedDevbox.name || selectedDevbox.id.slice(0, 12) },
            { label: 'Full Details', active: true }
          ]} />
          <Header
            title={`${selectedDevbox.name || selectedDevbox.id.slice(0, 12)} - Complete Information`}
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

    // Operations selection mode
    const lp = selectedDevbox.launch_parameters;
    const hasCapabilities = selectedDevbox.capabilities && selectedDevbox.capabilities.filter((c: string) => c !== 'unknown').length > 0;

    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes' },
          { label: selectedDevbox.name || selectedDevbox.id.slice(0, 12), active: true }
        ]} />
        <Header title="Devbox Details" />

        {/* Compact info section */}
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
          <Box>
            <Text color="cyan" bold>{selectedDevbox.name || selectedDevbox.id.slice(0, 12)}</Text>
            <Text> </Text>
            <StatusBadge status={selectedDevbox.status} />
            <Text color="gray" dimColor> • {selectedDevbox.id}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>{selectedDevbox.create_time_ms ? new Date(selectedDevbox.create_time_ms).toLocaleString() : ''}</Text>
            <Text color="gray" dimColor> ({selectedDevbox.create_time_ms ? formatTimeAgo(selectedDevbox.create_time_ms) : ''})</Text>
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
                {lp?.custom_cpu_cores && ` • ${lp.custom_cpu_cores}c`}
                {lp?.custom_gb_memory && ` • ${lp.custom_gb_memory}GB`}
                {lp?.custom_disk_size && ` • ${lp.custom_disk_size}GB disk`}
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
                {selectedDevbox.blueprint_id && `BP: ${selectedDevbox.blueprint_id.slice(0, 12)}`}
                {selectedDevbox.snapshot_id && `Snap: ${selectedDevbox.snapshot_id.slice(0, 12)}`}
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
  }

  // List view
  return (
    <>
      <Banner />
      <Breadcrumb items={[
        { label: 'Devboxes', active: true }
      ]} />
      <Header title="Devboxes" />
      {loading && <SpinnerComponent message="Loading..." />}
      {!loading && !error && devboxes.length === 0 && (
        <Box>
          <Text color="yellow">{figures.info}</Text>
          <Text> No devboxes found. Try: </Text>
          <Text color="cyan" bold>
            rln devbox create
          </Text>
        </Box>
      )}
      {!loading && !error && devboxes.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text color="green">
              {figures.tick} {running}
            </Text>
            <Text> </Text>
            <Text color="gray">
              {figures.circle} {stopped}
            </Text>
            <Text> </Text>
            <Text color="cyan">
              {figures.hamburger} {devboxes.length}
              {devboxes.length >= MAX_FETCH && '+'}
            </Text>
            {totalPages > 1 && (
              <>
                <Text color="gray"> • </Text>
                <Text color="gray" dimColor>
                  Page {currentPage + 1}/{totalPages}
                </Text>
              </>
            )}
            <Text> </Text>
            <Text color="gray">•</Text>
            <Text> </Text>
            {refreshing ? (
              <Text color="cyan">
                {['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][refreshIcon % 10]}
              </Text>
            ) : (
              <Text color="green">
                {figures.circleFilled}
              </Text>
            )}
          </Box>

          <Table
            data={currentDevboxes}
            keyExtractor={(devbox: any) => devbox.id}
            selectedIndex={selectedIndex}
            columns={[
              createComponentColumn(
                'status',
                'Status',
                (devbox: any) => <StatusBadge status={devbox.status} showText={false} />,
                { width: 2 }
              ),
              createTextColumn(
                'id',
                'ID',
                (devbox: any) => showFullId ? devbox.id : devbox.id.slice(0, 13),
                { width: showFullId ? idWidth : 15, color: 'gray', dimColor: true, bold: false }
              ),
              createTextColumn(
                'name',
                'Name',
                (devbox: any) => devbox.name || '',
                { width: nameWidth }
              ),
              createTextColumn(
                'capabilities',
                'Capabilities',
                (devbox: any) => {
                  const hasCapabilities = devbox.capabilities && devbox.capabilities.filter((c: string) => c !== 'unknown').length > 0;
                  return hasCapabilities
                    ? `[${devbox.capabilities
                        .filter((c: string) => c !== 'unknown')
                        .map((c: string) => c === 'computer_usage' ? 'comp' : c === 'browser_usage' ? 'browser' : c === 'docker_in_docker' ? 'docker' : c)
                        .join(',')}]`
                    : '';
                },
                { width: capabilitiesWidth, color: 'blue', dimColor: true, bold: false, visible: showCapabilities }
              ),
              createTextColumn(
                'tags',
                'Tags',
                (devbox: any) => devbox.blueprint_id ? '[bp]' : devbox.snapshot_id ? '[snap]' : '',
                { width: tagWidth, color: 'yellow', dimColor: true, bold: false, visible: showTags }
              ),
              createTextColumn(
                'created',
                'Created',
                (devbox: any) => devbox.create_time_ms ? formatTimeAgo(devbox.create_time_ms) : '',
                { width: timeWidth, color: 'gray', dimColor: true, bold: false }
              ),
            ]}
          />

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              {figures.arrowUp}
              {figures.arrowDown} Navigate • [Enter] Operations • [o] Open in Browser •
            </Text>
            {totalPages > 1 && (
              <Text color="gray" dimColor>
                {' '}{figures.arrowLeft}{figures.arrowRight} Page •
              </Text>
            )}
            <Text color="gray" dimColor>
              {' '}[q] Quit
            </Text>
          </Box>
        </>
      )}
      {error && <ErrorMessage message="Failed to list devboxes" error={error} />}
    </>
  );
};

export async function listDevboxes(options: ListOptions) {
  // Clear terminal
  console.clear();
  const { waitUntilExit } = render(<ListDevboxesUI status={options.status} />);
  await waitUntilExit();

  // Check if we need to spawn SSH after Ink exit
  const sshCommand = (global as any).__sshCommand;
  if (sshCommand) {
    delete (global as any).__sshCommand;

    // Import spawn
    const { spawnSync } = await import('child_process');

    // Clear and show connection message
    console.clear();
    console.log(`\nConnecting to devbox ${sshCommand.devboxName}...\n`);

    // Spawn SSH in foreground
    const result = spawnSync('ssh', [
      '-i', sshCommand.keyPath,
      '-o', `ProxyCommand=${sshCommand.proxyCommand}`,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      `${sshCommand.sshUser}@${sshCommand.url}`
    ], {
      stdio: 'inherit'
    });

    process.exit(result.status || 0);
  }
}
