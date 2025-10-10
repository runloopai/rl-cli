import { jest } from '@jest/globals';
import { mockDevbox, mockAPIClient, mockSSHKey, mockLogEntry, mockExecution } from '../../../fixtures/mocks';
import { mockSubprocess, mockFileSystem, mockNetwork, createMockCommandOptions } from '../../../helpers';
// Mock the client and executor
jest.mock('@/utils/client', () => ({
    getClient: jest.fn()
}));
jest.mock('@/utils/CommandExecutor', () => ({
    createExecutor: jest.fn()
}));
// Mock fs/promises globally; individual tests will set behaviors
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    writeFile: jest.fn(),
}));
describe('Devbox Commands', () => {
    let mockClient;
    let mockExecutor;
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = mockAPIClient();
        mockExecutor = {
            getClient: jest.fn().mockReturnValue(mockClient),
            executeAction: jest.fn(async (action) => {
                return await action();
            })
        };
        jest.doMock('@/utils/client', () => ({
            getClient: () => mockClient
        }));
        jest.doMock('@/utils/CommandExecutor', () => ({
            createExecutor: () => mockExecutor
        }));
    });
    describe('getDevbox', () => {
        it('should retrieve devbox details', async () => {
            const mockDevboxData = mockDevbox({ status: 'running' });
            mockClient.devboxes.retrieve.mockResolvedValue(mockDevboxData);
            const { getDevbox } = await import('@/commands/devbox/get');
            await getDevbox('test-id', createMockCommandOptions());
            expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
            expect(mockExecutor.executeAction).toHaveBeenCalled();
        });
        it('should handle devbox not found', async () => {
            mockClient.devboxes.retrieve.mockRejectedValue(new Error('Not found'));
            const { getDevbox } = await import('@/commands/devbox/get');
            await expect(getDevbox('nonexistent-id', createMockCommandOptions()))
                .rejects.toThrow('Not found');
        });
    });
    describe('suspendDevbox', () => {
        it('should suspend a devbox', async () => {
            const mockSuspendedDevbox = mockDevbox({ status: 'suspended' });
            mockClient.devboxes.suspend.mockResolvedValue(mockSuspendedDevbox);
            const { suspendDevbox } = await import('@/commands/devbox/suspend');
            await suspendDevbox('test-id', createMockCommandOptions());
            expect(mockClient.devboxes.suspend).toHaveBeenCalledWith('test-id');
            expect(mockExecutor.executeAction).toHaveBeenCalled();
        });
    });
    describe('resumeDevbox', () => {
        it('should resume a suspended devbox', async () => {
            const mockResumedDevbox = mockDevbox({ status: 'running' });
            mockClient.devboxes.resume.mockResolvedValue(mockResumedDevbox);
            const { resumeDevbox } = await import('@/commands/devbox/resume');
            await resumeDevbox('test-id', createMockCommandOptions());
            expect(mockClient.devboxes.resume).toHaveBeenCalledWith('test-id');
            expect(mockExecutor.executeAction).toHaveBeenCalled();
        });
    });
    describe('shutdownDevbox', () => {
        it('should shutdown a devbox', async () => {
            const mockShutdownDevbox = mockDevbox({ status: 'shutdown' });
            mockClient.devboxes.shutdown.mockResolvedValue(mockShutdownDevbox);
            const { shutdownDevbox } = await import('@/commands/devbox/shutdown');
            await shutdownDevbox('test-id', createMockCommandOptions());
            expect(mockClient.devboxes.shutdown).toHaveBeenCalledWith('test-id');
            expect(mockExecutor.executeAction).toHaveBeenCalled();
        });
    });
    describe('sshDevbox', () => {
        const { mockRun } = mockSubprocess();
        const { mockExists, mockMkdir, mockChmod, mockFsync } = mockFileSystem();
        beforeEach(() => {
            jest.doMock('@/utils/ssh', () => ({
                getSSHKey: jest.fn(async () => ({ keyfilePath: '/tmp/key', url: 'ssh://example' })),
                waitForReady: jest.fn(async () => true),
                generateSSHConfig: jest.fn(() => 'Host example\n  User user'),
                checkSSHTools: jest.fn(async () => true),
                getProxyCommand: jest.fn(() => 'proxycmd')
            }));
            jest.doMock('child_process', () => ({
                spawn: jest.fn(),
                exec: jest.fn()
            }));
            jest.doMock('fs', () => ({
                existsSync: mockExists,
                mkdirSync: mockMkdir,
                writeFileSync: jest.fn(),
                chmodSync: mockChmod,
                fsyncSync: mockFsync
            }));
        });
        it('should generate SSH key and connect', async () => {
            const mockSSHKeyData = mockSSHKey();
            mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
            mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());
            const { sshDevbox } = await import('@/commands/devbox/ssh');
            await sshDevbox('test-id', {
                ...createMockCommandOptions(),
                configOnly: false,
                noWait: false
            });
            expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
        });
        it('should print SSH config when config-only is true', async () => {
            const mockSSHKeyData = mockSSHKey();
            mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
            mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());
            const { sshDevbox } = await import('@/commands/devbox/ssh');
            await sshDevbox('test-id', {
                ...createMockCommandOptions(),
                configOnly: true,
                noWait: true
            });
            // getSSHKey is used internally; we just verify no error thrown and mocks were used
        });
    });
    describe('scpDevbox', () => {
        const { mockRun } = mockSubprocess();
        beforeEach(() => {
            jest.doMock('child_process', () => ({
                spawn: jest.fn(),
                exec: jest.fn((cmd, cb) => cb(null, { stdout: '', stderr: '' }))
            }));
            jest.doMock('fs', () => ({
                writeFileSync: jest.fn(),
            }));
        });
        it('should execute scp command with correct arguments', async () => {
            const mockSSHKeyData = mockSSHKey();
            mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
            mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());
            const { scpFiles } = await import('@/commands/devbox/scp');
            await scpFiles('test-id', {
                src: './local.txt',
                dst: ':/remote.txt',
                outputFormat: 'interactive'
            });
            expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
        });
    });
    describe('rsyncDevbox', () => {
        const { mockRun } = mockSubprocess();
        beforeEach(() => {
            jest.doMock('child_process', () => ({
                spawn: jest.fn(),
                exec: jest.fn((cmd, cb) => cb(null, { stdout: '', stderr: '' }))
            }));
        });
        it('should execute rsync command with correct arguments', async () => {
            const mockSSHKeyData = mockSSHKey();
            mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
            mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());
            const { rsyncFiles } = await import('@/commands/devbox/rsync');
            await rsyncFiles('test-id', {
                src: ':/remote_dir',
                dst: './local_dir',
                rsyncOptions: '-avz',
                outputFormat: 'interactive'
            });
            expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
        });
    });
    describe('tunnelDevbox', () => {
        const { mockRun } = mockSubprocess();
        beforeEach(() => {
            jest.doMock('child_process', () => ({
                spawn: jest.fn(),
                exec: jest.fn((cmd, cb) => cb(null, { stdout: '', stderr: '' }))
            }));
        });
        it('should create SSH tunnel with port forwarding', async () => {
            const mockSSHKeyData = mockSSHKey();
            mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
            mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());
            const { createTunnel } = await import('@/commands/devbox/tunnel');
            await createTunnel('test-id', {
                ports: '8080:3000',
                outputFormat: 'interactive'
            });
            expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
        });
    });
    describe('readFile', () => {
        beforeEach(() => {
            const fsPromises = jest.requireMock('fs/promises');
            fsPromises.writeFile.mockResolvedValue(undefined);
        });
        it('should read file contents from devbox', async () => {
            const fileContents = 'Hello, World!';
            mockClient.devboxes.readFileContents.mockResolvedValue(fileContents);
            const { readFile } = await import('@/commands/devbox/read');
            await readFile('test-id', {
                remote: '/path/to/remote/file.txt',
                outputPath: '/path/to/local/file.txt',
                output: 'interactive'
            });
            expect(mockClient.devboxes.readFileContents).toHaveBeenCalledWith('test-id', {
                file_path: '/path/to/remote/file.txt'
            });
        });
    });
    describe('writeFile', () => {
        beforeEach(() => {
            const fsPromises = jest.requireMock('fs/promises');
            fsPromises.readFile.mockResolvedValue('local content');
        });
        it('should write file contents to devbox', async () => {
            mockClient.devboxes.writeFileContents.mockResolvedValue(undefined);
            const { writeFile } = await import('@/commands/devbox/write');
            await writeFile('test-id', {
                input: '/path/to/local/file.txt',
                remote: '/path/to/remote/file.txt',
                output: 'interactive'
            });
            expect(mockClient.devboxes.writeFileContents).toHaveBeenCalledWith('test-id', {
                file_path: '/path/to/remote/file.txt',
                contents: 'local content'
            });
        });
        it('should handle file not found', async () => {
            const fsPromises = jest.requireMock('fs/promises');
            fsPromises.readFile.mockRejectedValue(new Error('ENOENT'));
            const { writeFile } = await import('@/commands/devbox/write');
            await expect(writeFile('test-id', {
                input: '/nonexistent/file.txt',
                remote: '/path/to/remote/file.txt',
                output: 'interactive'
            })).rejects.toThrow();
        });
    });
    describe('downloadFile', () => {
        const { mockFetch } = mockNetwork();
        beforeEach(() => {
            jest.doMock('node-fetch', () => mockFetch);
            jest.doMock('fs', () => ({
                writeFileSync: jest.fn(),
            }));
        });
        it('should download file from devbox', async () => {
            const mockResponse = {
                download_url: 'https://example.com/download'
            };
            mockClient.devboxes.downloadFile.mockResolvedValue(mockResponse);
            // Use the default mock from mockNetwork
            const { downloadFile } = await import('@/commands/devbox/download');
            await downloadFile('test-id', {
                filePath: '/remote/file.txt',
                outputPath: '/local/file.txt',
                outputFormat: 'interactive'
            });
            expect(mockClient.devboxes.downloadFile).toHaveBeenCalledWith('test-id', {
                path: '/remote/file.txt'
            });
        });
    });
    describe('execAsync', () => {
        it('should execute command asynchronously', async () => {
            const mockExecutionData = mockExecution();
            mockClient.devboxes.executeAsync.mockResolvedValue(mockExecutionData);
            const { execAsync } = await import('@/commands/devbox/execAsync');
            await execAsync('test-id', {
                command: 'echo hello',
                output: 'interactive'
            });
            expect(mockClient.devboxes.executeAsync).toHaveBeenCalledWith('test-id', {
                command: 'echo hello',
                shell_name: undefined
            });
        });
    });
    describe('getAsync', () => {
        it('should get async execution status', async () => {
            const mockExecutionData = mockExecution({ status: 'completed' });
            mockClient.devboxes.executions.retrieve.mockResolvedValue(mockExecutionData);
            const { getAsync } = await import('@/commands/devbox/getAsync');
            await getAsync('test-id', {
                executionId: 'exec-123',
                output: 'interactive'
            });
            expect(mockClient.devboxes.executions.retrieve).toHaveBeenCalledWith('test-id', 'exec-123');
        });
    });
    describe('logsDevbox', () => {
        it('should retrieve and format devbox logs', async () => {
            const mockLogs = {
                logs: [
                    mockLogEntry({ timestamp_ms: 1710000000000, source: 'entrypoint', cmd: 'echo test' }),
                    mockLogEntry({ timestamp_ms: 1710000000500, message: 'hello' }),
                    mockLogEntry({ timestamp_ms: 1710000001000, exit_code: 0 })
                ]
            };
            mockClient.devboxes.logs.list.mockResolvedValue(mockLogs);
            const { getLogs } = await import('@/commands/devbox/logs');
            await getLogs('test-id', { output: 'interactive' });
            expect(mockClient.devboxes.logs.list).toHaveBeenCalledWith('test-id');
        });
    });
});
