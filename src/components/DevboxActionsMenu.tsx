import React from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import figures from 'figures';
import { getClient } from '../utils/client.js';
import { Header } from './Header.js';
import { SpinnerComponent } from './Spinner.js';
import { ErrorMessage } from './ErrorMessage.js';
import { SuccessMessage } from './SuccessMessage.js';
import { Breadcrumb } from './Breadcrumb.js';
import type { SSHSessionConfig } from '../utils/sshSession.js';

type Operation = 'exec' | 'upload' | 'snapshot' | 'ssh' | 'logs' | 'tunnel' | 'suspend' | 'resume' | 'delete' | null;

interface DevboxActionsMenuProps {
  devbox: any;
  onBack: () => void;
  breadcrumbItems?: Array<{ label: string; active?: boolean }>;
  initialOperation?: string; // Operation to execute immediately
  initialOperationIndex?: number; // Index of the operation to select
  skipOperationsMenu?: boolean; // Skip showing operations menu and execute immediately
  onSSHRequest?: (config: SSHSessionConfig) => void; // Callback when SSH is requested
}

export const DevboxActionsMenu: React.FC<DevboxActionsMenuProps> = ({
  devbox,
  onBack,
  breadcrumbItems = [
    { label: 'Devboxes' },
    { label: devbox.name || devbox.id, active: true }
  ],
  initialOperation,
  initialOperationIndex = 0,
  skipOperationsMenu = false,
  onSSHRequest,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [loading, setLoading] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(initialOperationIndex);
  const [executingOperation, setExecutingOperation] = React.useState<Operation>(initialOperation as Operation || null);
  const [operationInput, setOperationInput] = React.useState('');
  const [operationResult, setOperationResult] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<Error | null>(null);
  const [logsWrapMode, setLogsWrapMode] = React.useState(false);
  const [logsScroll, setLogsScroll] = React.useState(0);
  const [execScroll, setExecScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  const allOperations = [
    { key: 'logs', label: 'View Logs', color: 'blue', icon: figures.info, shortcut: 'l' },
    { key: 'exec', label: 'Execute Command', color: 'green', icon: figures.play, shortcut: 'e' },
    { key: 'upload', label: 'Upload File', color: 'green', icon: figures.arrowUp, shortcut: 'u' },
    { key: 'snapshot', label: 'Create Snapshot', color: 'yellow', icon: figures.circleFilled, shortcut: 'n' },
    { key: 'ssh', label: 'SSH onto the box', color: 'cyan', icon: figures.arrowRight, shortcut: 's' },
    { key: 'tunnel', label: 'Open Tunnel', color: 'magenta', icon: figures.pointerSmall, shortcut: 't' },
    { key: 'suspend', label: 'Suspend Devbox', color: 'yellow', icon: figures.squareSmallFilled, shortcut: 'p' },
    { key: 'resume', label: 'Resume Devbox', color: 'green', icon: figures.play, shortcut: 'r' },
    { key: 'delete', label: 'Shutdown Devbox', color: 'red', icon: figures.cross, shortcut: 'd' },
  ];

  // Filter operations based on devbox status
  const operations = devbox ? allOperations.filter(op => {
    const status = devbox.status;

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

  // Auto-execute operations that don't need input
  React.useEffect(() => {
    const autoExecuteOps = ['delete', 'ssh', 'logs', 'suspend', 'resume'];
    if (executingOperation && autoExecuteOps.includes(executingOperation) && !loading && devbox) {
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
        setLogsWrapMode(true);
        setLogsScroll(0);
        setExecScroll(0);
        setCopyStatus(null);
      } else if ((key.upArrow || input === 'k') && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        setExecScroll(Math.max(0, execScroll - 1));
      } else if ((key.downArrow || input === 'j') && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        setExecScroll(execScroll + 1);
      } else if (key.pageUp && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        setExecScroll(Math.max(0, execScroll - 10));
      } else if (key.pageDown && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        setExecScroll(execScroll + 10);
      } else if (input === 'g' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        setExecScroll(0);
      } else if (input === 'G' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        const lines = [...((operationResult as any).stdout || '').split('\n'), ...((operationResult as any).stderr || '').split('\n')];
        const terminalHeight = stdout?.rows || 30;
        const viewportHeight = Math.max(10, terminalHeight - 15);
        const maxScroll = Math.max(0, lines.length - viewportHeight);
        setExecScroll(maxScroll);
      } else if (input === 'c' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
        // Copy exec output to clipboard
        const output = ((operationResult as any).stdout || '') + ((operationResult as any).stderr || '');

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

        copyToClipboard(output);
      } else if ((key.upArrow || input === 'k') && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        setLogsScroll(Math.max(0, logsScroll - 1));
      } else if ((key.downArrow || input === 'j') && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        setLogsScroll(logsScroll + 1);
      } else if (key.pageUp && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        setLogsScroll(Math.max(0, logsScroll - 10));
      } else if (key.pageDown && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        setLogsScroll(logsScroll + 10);
      } else if (input === 'g' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        setLogsScroll(0);
      } else if (input === 'G' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
        const logs = (operationResult as any).__logs || [];
        const terminalHeight = stdout?.rows || 30;
        const viewportHeight = Math.max(10, terminalHeight - 10);
        const maxScroll = Math.max(0, logs.length - viewportHeight);
        setLogsScroll(maxScroll);
      } else if (input === 'w' && operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
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

    // Operations selection mode
    if (input === 'q' || key.escape) {
      console.clear();
      onBack();
      setSelectedOperation(0);
    } else if (key.upArrow && selectedOperation > 0) {
      setSelectedOperation(selectedOperation - 1);
    } else if (key.downArrow && selectedOperation < operations.length - 1) {
      setSelectedOperation(selectedOperation + 1);
    } else if (key.return) {
      console.clear();
      const op = operations[selectedOperation].key as Operation;
      setExecutingOperation(op);
    } else if (input) {
      // Check if input matches any operation shortcut
      const matchedOp = operations.find(op => op.shortcut === input);
      if (matchedOp) {
        console.clear();
        setExecutingOperation(matchedOp.key as Operation);
      }
    }
  });

  const executeOperation = async () => {
    const client = getClient();

    try {
      setLoading(true);
      switch (executingOperation) {
        case 'exec':
          const execResult = await client.devboxes.executeSync(devbox.id, {
            command: operationInput,
          });
          // Format exec result for custom rendering
          const formattedExecResult: any = {
            __customRender: 'exec',
            command: operationInput,
            stdout: execResult.stdout || '',
            stderr: execResult.stderr || '',
            exitCode: (execResult as any).exit_code ?? 0,
          };
          setOperationResult(formattedExecResult);
          break;

        case 'upload':
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

          const fsModule = await import('fs');
          const pathModule = await import('path');
          const osModule = await import('os');

          const sshDir = pathModule.join(osModule.homedir(), '.runloop', 'ssh_keys');
          fsModule.mkdirSync(sshDir, { recursive: true });
          const keyPath = pathModule.join(sshDir, `${devbox.id}.pem`);

          fsModule.writeFileSync(keyPath, sshKey.ssh_private_key, { mode: 0o600 });

          const sshUser = devbox.launch_parameters?.user_parameters?.username || 'user';
          const env = process.env.RUNLOOP_ENV?.toLowerCase();
          const sshHost = env === 'dev' ? 'ssh.runloop.pro' : 'ssh.runloop.ai';
          const proxyCommand = `openssl s_client -quiet -verify_quiet -servername %h -connect ${sshHost}:443 2>/dev/null`;

          const sshConfig: SSHSessionConfig = {
            keyPath,
            proxyCommand,
            sshUser,
            url: sshKey.url,
            devboxId: devbox.id,
            devboxName: devbox.name || devbox.id
          };

          // Notify parent that SSH is requested
          if (onSSHRequest) {
            onSSHRequest(sshConfig);
            exit();
          } else {
            setOperationError(new Error('SSH session handler not configured'));
          }
          break;

        case 'logs':
          const logsResult = await client.devboxes.logs.list(devbox.id);
          if (logsResult.logs.length === 0) {
            setOperationResult('No logs available for this devbox.');
          } else {
            (logsResult as any).__customRender = 'logs';
            (logsResult as any).__logs = logsResult.logs;
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

  const operationLabel = operations.find((o) => o.key === executingOperation)?.label || 'Operation';

  // Operation result display
  if (operationResult || operationError) {
    // Check for custom exec rendering
    if (operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'exec') {
      const command = (operationResult as any).command || '';
      const stdout = (operationResult as any).stdout || '';
      const stderr = (operationResult as any).stderr || '';
      const exitCode = (operationResult as any).exitCode;

      const stdoutLines = stdout ? stdout.split('\n') : [];
      const stderrLines = stderr ? stderr.split('\n') : [];
      const allLines = [...stdoutLines, ...stderrLines].filter(line => line !== '');

      const terminalHeight = stdout?.rows || 30;
      const viewportHeight = Math.max(10, terminalHeight - 15);
      const maxScroll = Math.max(0, allLines.length - viewportHeight);
      const actualScroll = Math.min(execScroll, maxScroll);
      const visibleLines = allLines.slice(actualScroll, actualScroll + viewportHeight);
      const hasMore = actualScroll + viewportHeight < allLines.length;
      const hasLess = actualScroll > 0;

      const exitCodeColor = exitCode === 0 ? 'green' : 'red';

      return (
        <>
          <Breadcrumb items={[...breadcrumbItems, { label: 'Execute Command', active: true }]} />

          {/* Command header */}
          <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
            <Box>
              <Text color="cyan" bold>{figures.play} Command:</Text>
              <Text> </Text>
              <Text color="white">{command}</Text>
            </Box>
            <Box>
              <Text color="gray" dimColor>Exit Code: </Text>
              <Text color={exitCodeColor} bold>{exitCode}</Text>
            </Box>
          </Box>

          {/* Output display */}
          <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
            {allLines.length === 0 && (
              <Text color="gray" dimColor>No output</Text>
            )}
            {visibleLines.map((line: string, index: number) => {
              const actualIndex = actualScroll + index;
              const isStderr = actualIndex >= stdoutLines.length;
              const lineColor = isStderr ? 'red' : 'white';

              return (
                <Box key={index}>
                  <Text color={lineColor}>{line}</Text>
                </Box>
              );
            })}

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

          {/* Statistics bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color="cyan" bold>
              {figures.hamburger} {allLines.length}
            </Text>
            <Text color="gray" dimColor> lines</Text>
            {allLines.length > 0 && (
              <>
                <Text color="gray" dimColor> • </Text>
                <Text color="gray" dimColor>
                  Viewing {actualScroll + 1}-{Math.min(actualScroll + viewportHeight, allLines.length)} of {allLines.length}
                </Text>
              </>
            )}
            {stdout && (
              <>
                <Text color="gray" dimColor> • </Text>
                <Text color="green" dimColor>stdout: {stdoutLines.length} lines</Text>
              </>
            )}
            {stderr && (
              <>
                <Text color="gray" dimColor> • </Text>
                <Text color="red" dimColor>stderr: {stderrLines.length} lines</Text>
              </>
            )}
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
              {figures.arrowUp}{figures.arrowDown} Navigate • [g] Top • [G] Bottom • [c] Copy • [Enter], [q], or [esc] Back
            </Text>
          </Box>
        </>
      );
    }

    // Check for custom logs rendering
    if (operationResult && typeof operationResult === 'object' && (operationResult as any).__customRender === 'logs') {
      const logs = (operationResult as any).__logs || [];
      const totalCount = (operationResult as any).__totalCount || 0;

      const terminalHeight = stdout?.rows || 30;
      const terminalWidth = stdout?.columns || 120;
      const viewportHeight = Math.max(10, terminalHeight - 10);
      const maxScroll = Math.max(0, logs.length - viewportHeight);
      const actualScroll = Math.min(logsScroll, maxScroll);
      const visibleLogs = logs.slice(actualScroll, actualScroll + viewportHeight);
      const hasMore = actualScroll + viewportHeight < logs.length;
      const hasLess = actualScroll > 0;

      return (
        <>
          <Breadcrumb items={[...breadcrumbItems, { label: 'Logs', active: true }]} />

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
        <Breadcrumb items={[...breadcrumbItems, { label: operationLabel, active: true }]} />
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
  if (executingOperation && devbox) {
    const needsInput =
      executingOperation === 'exec' ||
      executingOperation === 'upload' ||
      executingOperation === 'snapshot' ||
      executingOperation === 'tunnel';

    if (loading) {
      return (
        <>
          <Breadcrumb items={[...breadcrumbItems, { label: operationLabel, active: true }]} />
          <Header title="Executing Operation" />
          <SpinnerComponent message="Please wait..." />
        </>
      );
    }

    if (!needsInput) {
      const messages: Record<string, string> = {
        ssh: 'Creating SSH key...',
        logs: 'Fetching logs...',
        suspend: 'Suspending devbox...',
        resume: 'Resuming devbox...',
        delete: 'Shutting down devbox...',
      };
      return (
        <>
          <Breadcrumb items={[...breadcrumbItems, { label: operationLabel, active: true }]} />
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
        <Breadcrumb items={[...breadcrumbItems, { label: operationLabel, active: true }]} />
        <Header title={operationLabel} />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {devbox.name || devbox.id}
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

  // Operations selection mode - only show if not skipping
  if (!skipOperationsMenu || !executingOperation) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box flexDirection="column">
          <Text color="cyan" bold>{figures.play} Operations</Text>
          <Box flexDirection="column">
            {operations.map((op, index) => {
              const isSelected = index === selectedOperation;
              return (
                <Box key={op.key}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? figures.pointer : ' '} </Text>
                  <Text color={isSelected ? op.color : 'gray'} bold={isSelected}>{op.icon} {op.label}</Text>
                  <Text color="gray" dimColor> [{op.shortcut}]</Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {figures.arrowUp}{figures.arrowDown} Navigate • [Enter] Select • [q] Back
          </Text>
        </Box>
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
