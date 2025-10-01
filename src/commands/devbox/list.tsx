import React from 'react';
import { render, Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import figures from 'figures';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { Banner } from '../../components/Banner.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';

interface ListOptions {
  status?: string;
}

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

type Operation = 'exec' | 'upload' | 'snapshot' | 'ssh' | 'logs' | 'delete' | null;

const ListDevboxesUI: React.FC<{ status?: string }> = ({ status }) => {
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

  const operations = [
    { key: 'exec', label: 'Execute Command', color: 'green', icon: figures.play },
    { key: 'upload', label: 'Upload File', color: 'green', icon: figures.arrowUp },
    { key: 'snapshot', label: 'Create Snapshot', color: 'yellow', icon: figures.circleFilled },
    { key: 'ssh', label: 'SSH onto the box', color: 'cyan', icon: figures.arrowRight },
    { key: 'logs', label: 'View Logs', color: 'blue', icon: figures.info },
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

    // Poll every 2 seconds
    const interval = setInterval(() => {
      list();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Auto-execute operations that don't need input (delete, ssh, logs)
  React.useEffect(() => {
    if ((executingOperation === 'delete' || executingOperation === 'ssh' || executingOperation === 'logs') && !loading && selectedDevbox) {
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

  // Clear screen when operation result is shown
  React.useEffect(() => {
    if (operationResult || operationError) {
      console.clear();
    }
  }, [operationResult, operationError]);

  // Clear screen when showing details view
  React.useEffect(() => {
    if (showDetails) {
      console.clear();
    }
  }, [showDetails]);

  useInput((input, key) => {
    const pageDevboxes = currentDevboxes.length;

    // Handle operation input mode
    if (executingOperation && !operationResult && !operationError) {
      if (key.return && operationInput.trim()) {
        executeOperation();
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
        setShowDetails(false);
      }
      return;
    }

    // Handle details view
    if (showDetails) {
      if (input === 'q' || key.escape) {
        console.clear();
        setShowDetails(false);
        setSelectedOperation(0);
      } else if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        console.clear();
        const op = operations[selectedOperation].key as Operation;
        setExecutingOperation(op);
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

          // Save SSH key to temporary file
          const fsModule = await import('fs');
          const pathModule = await import('path');
          const osModule = await import('os');

          const tmpDir = osModule.tmpdir();
          const keyPath = pathModule.join(tmpDir, `devbox-${devbox.id.slice(0, 8)}.pem`);

          fsModule.writeFileSync(keyPath, sshKey.ssh_private_key, { mode: 0o600 });

          // Start SSH session
          const { spawn } = await import('child_process');

          // Exit the Ink app before starting SSH
          process.stdin.setRawMode(false);

          const sshProcess = spawn('ssh', [
            '-i', keyPath,
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            sshKey.url
          ], {
            stdio: 'inherit'
          });

          sshProcess.on('close', () => {
            // Clean up key file
            fsModule.unlinkSync(keyPath);
            process.exit(0);
          });

          return;

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

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'running':
        return { icon: figures.tick, color: 'green', text: 'RUNNING' };
      case 'provisioning':
        return { icon: figures.ellipsis, color: 'yellow', text: 'PROVISIONING' };
      case 'initializing':
        return { icon: figures.ellipsis, color: 'cyan', text: 'INITIALIZING' };
      case 'stopped':
      case 'suspended':
        return { icon: figures.circle, color: 'gray', text: 'STOPPED' };
      case 'failed':
        return { icon: figures.cross, color: 'red', text: 'FAILED' };
      default:
        return { icon: figures.circle, color: 'gray', text: status.toUpperCase() };
    }
  };

  // Operation result display
  if (operationResult || operationError) {
    return (
      <>
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
      executingOperation === 'snapshot';

    if (loading) {
      return (
        <>
          <Header title="Executing Operation" />
          <SpinnerComponent message="Please wait..." />
        </>
      );
    }

    if (!needsInput) {
      // SSH, Logs, and Delete operations are auto-executed via useEffect
      const messages: Record<string, string> = {
        ssh: 'Creating SSH key...',
        logs: 'Fetching logs...',
        delete: 'Deleting devbox...',
      };
      return (
        <>
          <Header title="Executing Operation" />
          <SpinnerComponent message={messages[executingOperation as string] || 'Please wait...'} />
        </>
      );
    }

    const prompts: Record<string, string> = {
      exec: 'Command to execute:',
      upload: 'File path to upload:',
      snapshot: 'Snapshot name (optional):',
    };

    return (
      <>
        <Header title={operations.find((o) => o.key === executingOperation)?.label || ''} />
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
                  : 'my-snapshot'
              }
            />
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              Press [Enter] to execute
            </Text>
          </Box>
        </Box>
      </>
    );
  }

  // Details view with operation selection
  if (showDetails && selectedDevbox) {
    const statusDisplay = getStatusDisplay(selectedDevbox.status);
    const uptime = selectedDevbox.create_time_ms
      ? Math.floor((Date.now() - selectedDevbox.create_time_ms) / 1000 / 60)
      : null;

    return (
      <>
        <Header title="Devbox Details" />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {selectedDevbox.name || selectedDevbox.id.slice(0, 12)}
            </Text>
            <Text> </Text>
            <Text color={statusDisplay.color}>
              {statusDisplay.icon} {statusDisplay.text}
            </Text>
          </Box>
          <Box flexDirection="column" gap={1}>
            <Box>
              <Text color="gray">ID: </Text>
              <Text dimColor>{selectedDevbox.id}</Text>
            </Box>
            <Box>
              <Text color="gray">URL: </Text>
              <Text color="cyan" dimColor>
                https://platform.runloop.ai/devboxes/{selectedDevbox.id}
              </Text>
            </Box>
            {selectedDevbox.create_time_ms && (
              <Box>
                <Text color="gray">Created: </Text>
                <Text dimColor>{new Date(selectedDevbox.create_time_ms).toLocaleString()}</Text>
              </Box>
            )}
            {uptime !== null && selectedDevbox.status === 'running' && (
              <Box>
                <Text color="gray">Uptime: </Text>
                <Text dimColor>{uptime < 60 ? `${uptime}m` : `${Math.floor(uptime / 60)}h ${uptime % 60}m`}</Text>
              </Box>
            )}
            {selectedDevbox.launch_parameters?.keep_alive_time_seconds && (
              <Box>
                <Text color="gray">Keep Alive: </Text>
                <Text dimColor>{Math.floor(selectedDevbox.launch_parameters.keep_alive_time_seconds / 60)}m</Text>
              </Box>
            )}
            {selectedDevbox.capabilities && selectedDevbox.capabilities.length > 0 && (
              <Box>
                <Text color="gray">Capabilities: </Text>
                <Text dimColor>{selectedDevbox.capabilities.filter((c: string) => c !== 'unknown').join(', ')}</Text>
              </Box>
            )}
            {selectedDevbox.blueprint_id && (
              <Box>
                <Text color="gray">Blueprint: </Text>
                <Text dimColor>{selectedDevbox.blueprint_id}</Text>
              </Box>
            )}
            {selectedDevbox.snapshot_id && (
              <Box>
                <Text color="gray">Snapshot: </Text>
                <Text dimColor>{selectedDevbox.snapshot_id}</Text>
              </Box>
            )}
            {selectedDevbox.failure_reason && (
              <Box>
                <Text color="red">Failure: </Text>
                <Text color="red" dimColor>{selectedDevbox.failure_reason}</Text>
              </Box>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text color="cyan" bold>
            Select Operation:
          </Text>
          <Box marginTop={1} flexDirection="column">
            {operations.map((op, index) => {
              const isSelected = index === selectedOperation;
              return (
                <Box key={op.key}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>
                    {isSelected ? figures.pointer : ' '}
                  </Text>
                  <Text> </Text>
                  <Text color={isSelected ? op.color : 'gray'} bold={isSelected}>
                    {op.icon} {op.label}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Navigate • [Enter] Select • [q] Back
          </Text>
        </Box>
      </>
    );
  }

  // List view
  return (
    <>
      <Banner />
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
                {figures.tick}
              </Text>
            )}
          </Box>

          <Box flexDirection="column">
            {currentDevboxes.map((devbox, index) => {
              const isSelected = index === selectedIndex;
              const statusDisplay = getStatusDisplay(devbox.status);
              const displayName = devbox.name || devbox.id.slice(0, 12);
              const shortId = devbox.id.slice(0, 8);
              const hasCapabilities = devbox.capabilities && devbox.capabilities.filter((c: string) => c !== 'unknown').length > 0;
              const uptime = devbox.create_time_ms && devbox.status === 'running'
                ? Math.floor((Date.now() - devbox.create_time_ms) / 1000 / 60)
                : null;

              return (
                <Box key={devbox.id}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>
                    {isSelected ? figures.pointer : ' '}
                  </Text>
                  <Text> </Text>
                  <Text color={statusDisplay.color}>{statusDisplay.icon}</Text>
                  <Text> </Text>
                  <Box width={20}>
                    <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                      {displayName.slice(0, 18)}
                    </Text>
                  </Box>
                  <Text color="gray" dimColor>
                    {shortId}
                  </Text>
                  {hasCapabilities && (
                    <>
                      <Text> </Text>
                      <Text color="blue" dimColor>
                        [{devbox.capabilities.filter((c: string) => c !== 'unknown').map((c: string) => c === 'computer_usage' ? 'comp' : c === 'browser_usage' ? 'browser' : c === 'docker_in_docker' ? 'docker' : c).join(',')}]
                      </Text>
                    </>
                  )}
                  {(devbox.blueprint_id || devbox.snapshot_id) && (
                    <>
                      <Text> </Text>
                      <Text color="yellow" dimColor>
                        {devbox.blueprint_id ? '[bp]' : '[snap]'}
                      </Text>
                    </>
                  )}
                  {uptime !== null && (
                    <>
                      <Text> </Text>
                      <Text color="gray" dimColor>
                        {uptime < 60 ? `${uptime}m` : `${Math.floor(uptime / 60)}h`}
                      </Text>
                    </>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              {figures.arrowUp}
              {figures.arrowDown} Navigate • [Enter] Operations •
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
}
