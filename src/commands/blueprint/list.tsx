import React from 'react';
import { render, Box, Text, useInput, useStdout, useApp } from 'ink';
import TextInput from 'ink-text-input';
import figures from 'figures';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Breadcrumb } from '../../components/Breadcrumb.js';
import { MetadataDisplay } from '../../components/MetadataDisplay.js';
import { Table, createTextColumn, createComponentColumn } from '../../components/Table.js';
import { OperationsMenu, Operation } from '../../components/OperationsMenu.js';
import { createExecutor } from '../../utils/CommandExecutor.js';
import { getBlueprintUrl } from '../../utils/url.js';

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

type OperationType = 'create_devbox' | 'delete' | null;

// Format time ago
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

const ListBlueprintsUI: React.FC = () => {
  const { stdout } = useStdout();
  const { exit } = useApp();
  const [loading, setLoading] = React.useState(true);
  const [blueprints, setBlueprints] = React.useState<any[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showDetails, setShowDetails] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [executingOperation, setExecutingOperation] = React.useState<OperationType>(null);
  const [operationInput, setOperationInput] = React.useState('');
  const [operationResult, setOperationResult] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<Error | null>(null);

  // Calculate responsive column widths
  const terminalWidth = stdout?.columns || 120;
  const showDescription = terminalWidth >= 120;
  const showFullId = terminalWidth >= 80;

  const idWidth = 25;
  const nameWidth = terminalWidth >= 120 ? 30 : 25;
  const descriptionWidth = 40;
  const timeWidth = 20;

  const allOperations: Operation[] = [
    {
      key: 'create_devbox',
      label: 'Create Devbox from Blueprint',
      color: 'green',
      icon: figures.play,
      needsInput: true,
      inputPrompt: 'Devbox name (optional):',
      inputPlaceholder: 'my-devbox',
    },
    {
      key: 'delete',
      label: 'Delete Blueprint',
      color: 'red',
      icon: figures.cross,
    },
  ];

  React.useEffect(() => {
    const list = async () => {
      try {
        const client = getClient();
        const allBlueprints: any[] = [];

        let count = 0;
        for await (const blueprint of client.blueprints.list()) {
          allBlueprints.push(blueprint);
          count++;
          if (count >= MAX_FETCH) {
            break;
          }
        }

        setBlueprints(allBlueprints);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    list();
  }, []);

  // Clear console when transitioning to detail view
  const prevShowDetailsRef = React.useRef(showDetails);
  React.useEffect(() => {
    if (showDetails && !prevShowDetailsRef.current) {
      console.clear();
    }
    prevShowDetailsRef.current = showDetails;
  }, [showDetails]);

  // Auto-execute operations that don't need input
  React.useEffect(() => {
    if (executingOperation === 'delete' && !loading && selectedBlueprint) {
      executeOperation();
    }
  }, [executingOperation]);

  const executeOperation = async () => {
    const client = getClient();
    const blueprint = selectedBlueprint;

    try {
      setLoading(true);
      switch (executingOperation) {
        case 'create_devbox':
          const devbox = await client.devboxes.create({
            blueprint_id: blueprint.id,
            name: operationInput || undefined,
          });
          setOperationResult(
            `Devbox created successfully!\n\n` +
              `ID: ${devbox.id}\n` +
              `Name: ${devbox.name || '(none)'}\n` +
              `Status: ${devbox.status}\n\n` +
              `Use 'rln devbox list' to view all devboxes.`
          );
          break;

        case 'delete':
          await client.blueprints.delete(blueprint.id);
          setOperationResult(`Blueprint ${blueprint.id} deleted successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    const pageBlueprints = currentBlueprints.length;

    // Handle operation input mode
    if (executingOperation && !operationResult && !operationError) {
      const currentOp = allOperations.find((op) => op.key === executingOperation);
      if (currentOp?.needsInput) {
        if (key.return) {
          executeOperation();
        } else if (input === 'q' || key.escape) {
          console.clear();
          setExecutingOperation(null);
          setOperationInput('');
        }
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
      }
      return;
    }

    // Handle details view
    if (showDetails) {
      if (input === 'q' || key.escape) {
        console.clear();
        setShowDetails(false);
        setSelectedOperation(0);
      } else if (input === 'o' && selectedBlueprint) {
        // Open in browser
        const url = getBlueprintUrl(selectedBlueprint.id);
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
        const op = operations[selectedOperation].key as OperationType;
        setExecutingOperation(op);
      }
      return;
    }

    // Handle list view
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageBlueprints - 1) {
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
    } else if (input === 'o' && selectedBlueprint) {
      // Open in browser
      const url = getBlueprintUrl(selectedBlueprint.id);
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
    } else if (key.escape) {
      exit();
    }
  });

  const totalPages = Math.ceil(blueprints.length / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, blueprints.length);
  const currentBlueprints = blueprints.slice(startIndex, endIndex);
  const selectedBlueprint = currentBlueprints[selectedIndex];

  const buildComplete = blueprints.filter((b) => b.status === 'build_complete').length;
  const building = blueprints.filter((b) => ['provisioning', 'building'].includes(b.status)).length;
  const failed = blueprints.filter((b) => b.status === 'build_failed').length;

  // Filter operations based on blueprint status
  const operations =
    selectedBlueprint
      ? allOperations.filter((op) => {
          const status = selectedBlueprint.status;

          // Only allow creating devbox if build is complete
          if (op.key === 'create_devbox') {
            return status === 'build_complete';
          }

          // Allow delete for any status
          return true;
        })
      : allOperations;

  // Operation result display
  if (operationResult || operationError) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label || 'Operation';
    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Blueprints' },
            {
              label: selectedBlueprint?.name || selectedBlueprint?.id || 'Blueprint',
            },
            { label: operationLabel, active: true },
          ]}
        />
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
  if (executingOperation && selectedBlueprint) {
    const currentOp = allOperations.find((op) => op.key === executingOperation);
    const needsInput = currentOp?.needsInput;
    const operationLabel = currentOp?.label || 'Operation';

    if (loading) {
      return (
        <>
          <Breadcrumb
            items={[
              { label: 'Blueprints' },
              { label: selectedBlueprint.name || selectedBlueprint.id },
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
        delete: 'Deleting blueprint...',
      };
      return (
        <>
          <Breadcrumb
            items={[
              { label: 'Blueprints' },
              { label: selectedBlueprint.name || selectedBlueprint.id },
              { label: operationLabel, active: true },
            ]}
          />
          <Header title="Executing Operation" />
          <SpinnerComponent message={messages[executingOperation as string] || 'Please wait...'} />
        </>
      );
    }

    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Blueprints' },
            { label: selectedBlueprint.name || selectedBlueprint.id },
            { label: operationLabel, active: true },
          ]}
        />
        <Header title={operationLabel} />
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              {selectedBlueprint.name || selectedBlueprint.id}
            </Text>
          </Box>
          <Box>
            <Text color="gray">{currentOp.inputPrompt} </Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value={operationInput}
              onChange={setOperationInput}
              placeholder={currentOp.inputPlaceholder || ''}
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
  if (showDetails && selectedBlueprint) {
    const ds = selectedBlueprint.dockerfile_setup;

    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Blueprints' },
            {
              label: selectedBlueprint.name || selectedBlueprint.id,
              active: true,
            },
          ]}
        />
        <Header title="Blueprint Details" />

        {/* Compact info section */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          paddingY={0}
        >
          <Box>
            <Text color="cyan" bold>
              {selectedBlueprint.name || selectedBlueprint.id}
            </Text>
            <Text> </Text>
            <StatusBadge status={selectedBlueprint.status} />
            <Text color="gray" dimColor>
              {' '}
              • {selectedBlueprint.id}
            </Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>
              {selectedBlueprint.create_time_ms
                ? new Date(selectedBlueprint.create_time_ms).toLocaleString()
                : ''}
            </Text>
            <Text color="gray" dimColor>
              {' '}
              (
              {selectedBlueprint.create_time_ms
                ? formatTimeAgo(selectedBlueprint.create_time_ms)
                : ''}
              )
            </Text>
          </Box>
          {ds?.description && (
            <Box>
              <Text color="gray" dimColor>
                {ds.description}
              </Text>
            </Box>
          )}
        </Box>

        {/* Dockerfile setup details */}
        {ds && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="yellow"
            paddingX={1}
            paddingY={0}
          >
            <Text color="yellow" bold>
              {figures.squareSmallFilled} Dockerfile Setup
            </Text>
            {ds.base_image && (
              <Text dimColor>Base Image: {ds.base_image}</Text>
            )}
            {ds.entrypoint && (
              <Text dimColor>Entrypoint: {ds.entrypoint}</Text>
            )}
            {ds.system_packages && ds.system_packages.length > 0 && (
              <Text dimColor>
                System Packages: {ds.system_packages.join(', ')}
              </Text>
            )}
            {ds.python_packages && ds.python_packages.length > 0 && (
              <Text dimColor>
                Python Packages: {ds.python_packages.join(', ')}
              </Text>
            )}
          </Box>
        )}

        {/* Metadata */}
        {selectedBlueprint.metadata && Object.keys(selectedBlueprint.metadata).length > 0 && (
          <Box borderStyle="round" borderColor="green" paddingX={1} paddingY={0}>
            <MetadataDisplay metadata={selectedBlueprint.metadata} showBorder={false} />
          </Box>
        )}

        {/* Failure reason */}
        {selectedBlueprint.build_error && (
          <Box borderStyle="round" borderColor="red" paddingX={1} paddingY={0}>
            <Text color="red" bold>
              {figures.cross}{' '}
            </Text>
            <Text color="red" dimColor>
              {selectedBlueprint.build_error}
            </Text>
          </Box>
        )}

        {/* Operations */}
        <OperationsMenu
          operations={operations}
          selectedIndex={selectedOperation}
          onNavigate={(direction) => {
            if (direction === 'up' && selectedOperation > 0) {
              setSelectedOperation(selectedOperation - 1);
            } else if (direction === 'down' && selectedOperation < operations.length - 1) {
              setSelectedOperation(selectedOperation + 1);
            }
          }}
          onSelect={(op) => {
            console.clear();
            setExecutingOperation(op.key as OperationType);
          }}
          onBack={() => {
            console.clear();
            setShowDetails(false);
            setSelectedOperation(0);
          }}
          additionalActions={[{ key: 'o', label: 'Browser', handler: () => {} }]}
        />
      </>
    );
  }

  // List view
  return (
    <>
      <Breadcrumb items={[{ label: 'Blueprints', active: true }]} />
      {loading && <SpinnerComponent message="Loading blueprints..." />}
      {!loading && !error && blueprints.length === 0 && (
        <Box>
          <Text color="yellow">{figures.info}</Text>
          <Text> No blueprints found. Try: </Text>
          <Text color="cyan" bold>
            rln blueprint create
          </Text>
        </Box>
      )}
      {!loading && !error && blueprints.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text color="green">
              {figures.tick} {buildComplete}
            </Text>
            <Text> </Text>
            <Text color="yellow">
              {figures.ellipsis} {building}
            </Text>
            <Text> </Text>
            <Text color="red">
              {figures.cross} {failed}
            </Text>
            <Text> </Text>
            <Text color="cyan">
              {figures.hamburger} {blueprints.length}
              {blueprints.length >= MAX_FETCH && '+'}
            </Text>
            {totalPages > 1 && (
              <>
                <Text color="gray"> • </Text>
                <Text color="gray" dimColor>
                  Page {currentPage + 1}/{totalPages}
                </Text>
              </>
            )}
          </Box>

          <Table
            data={currentBlueprints}
            keyExtractor={(blueprint: any) => blueprint.id}
            selectedIndex={selectedIndex}
            columns={[
              createComponentColumn(
                'status',
                'Status',
                (blueprint: any) => <StatusBadge status={blueprint.status} showText={false} />,
                { width: 2 }
              ),
              createTextColumn(
                'id',
                'ID',
                (blueprint: any) => (showFullId ? blueprint.id : blueprint.id.slice(0, 13)),
                {
                  width: showFullId ? idWidth : 15,
                  color: 'gray',
                  dimColor: true,
                  bold: false,
                }
              ),
              createTextColumn(
                'name',
                'Name',
                (blueprint: any) => blueprint.name || '(unnamed)',
                { width: nameWidth }
              ),
              createTextColumn(
                'description',
                'Description',
                (blueprint: any) => blueprint.dockerfile_setup?.description || '',
                {
                  width: descriptionWidth,
                  color: 'gray',
                  dimColor: true,
                  bold: false,
                  visible: showDescription,
                }
              ),
              createTextColumn(
                'created',
                'Created',
                (blueprint: any) =>
                  blueprint.create_time_ms ? formatTimeAgo(blueprint.create_time_ms) : '',
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
                {' '}
                {figures.arrowLeft}
                {figures.arrowRight} Page •
              </Text>
            )}
            <Text color="gray" dimColor>
              {' '}
              [Esc] Back
            </Text>
          </Box>
        </>
      )}
      {error && <ErrorMessage message="Failed to list blueprints" error={error} />}
    </>
  );
};

interface ListBlueprintsOptions {
  output?: string;
}

export async function listBlueprints(options: ListBlueprintsOptions = {}) {
  const executor = createExecutor(options);

  await executor.executeList(
    async () => {
      const client = executor.getClient();
      return executor.fetchFromIterator(client.blueprints.list(), {
        limit: PAGE_SIZE,
      });
    },
    () => <ListBlueprintsUI />,
    PAGE_SIZE
  );
}
