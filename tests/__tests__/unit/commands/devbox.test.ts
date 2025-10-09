import { jest } from '@jest/globals';
import { mockDevbox, mockAPIClient, mockSSHKey, mockLogEntry, mockExecution } from '../../../fixtures/mocks';
import { mockSubprocess, mockFileSystem, createMockCommandOptions } from '../../../helpers';

// Mock the client and executor
jest.mock('../../../../../src/utils/client', () => ({
  getClient: jest.fn()
}));

jest.mock('../../../../../src/utils/CommandExecutor', () => ({
  createExecutor: jest.fn()
}));

describe('Devbox Commands', () => {
  let mockClient: any;
  let mockExecutor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = mockAPIClient();
    mockExecutor = {
      getClient: jest.fn().mockReturnValue(mockClient),
      executeAction: jest.fn()
    };

    jest.doMock('../../../../../src/utils/client', () => ({
      getClient: () => mockClient
    }));

    jest.doMock('../../../../../src/utils/CommandExecutor', () => ({
      createExecutor: () => mockExecutor
    }));
  });

  describe('getDevbox', () => {
    it('should retrieve devbox details', async () => {
      const mockDevboxData = mockDevbox({ status: 'running' });
      mockClient.devboxes.retrieve.mockResolvedValue(mockDevboxData);

      const { getDevbox } = await import('../../../../../src/commands/devbox/get');
      
      await getDevbox('test-id', createMockCommandOptions());

      expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
      expect(mockExecutor.executeAction).toHaveBeenCalled();
    });

    it('should handle devbox not found', async () => {
      mockClient.devboxes.retrieve.mockRejectedValue(new Error('Not found'));

      const { getDevbox } = await import('../../../../../src/commands/devbox/get');
      
      await expect(getDevbox('nonexistent-id', createMockCommandOptions()))
        .rejects.toThrow('Not found');
    });
  });

  describe('suspendDevbox', () => {
    it('should suspend a devbox', async () => {
      const mockSuspendedDevbox = mockDevbox({ status: 'suspended' });
      mockClient.devboxes.suspend.mockResolvedValue(mockSuspendedDevbox);

      const { suspendDevbox } = await import('../../../../../src/commands/devbox/suspend');
      
      await suspendDevbox('test-id', createMockCommandOptions());

      expect(mockClient.devboxes.suspend).toHaveBeenCalledWith('test-id');
      expect(mockExecutor.executeAction).toHaveBeenCalled();
    });
  });

  describe('resumeDevbox', () => {
    it('should resume a suspended devbox', async () => {
      const mockResumedDevbox = mockDevbox({ status: 'running' });
      mockClient.devboxes.resume.mockResolvedValue(mockResumedDevbox);

      const { resumeDevbox } = await import('../../../../../src/commands/devbox/resume');
      
      await resumeDevbox('test-id', createMockCommandOptions());

      expect(mockClient.devboxes.resume).toHaveBeenCalledWith('test-id');
      expect(mockExecutor.executeAction).toHaveBeenCalled();
    });
  });

  describe('shutdownDevbox', () => {
    it('should shutdown a devbox', async () => {
      const mockShutdownDevbox = mockDevbox({ status: 'shutdown' });
      mockClient.devboxes.shutdown.mockResolvedValue(mockShutdownDevbox);

      const { shutdownDevbox } = await import('../../../../../src/commands/devbox/shutdown');
      
      await shutdownDevbox('test-id', createMockCommandOptions());

      expect(mockClient.devboxes.shutdown).toHaveBeenCalledWith('test-id');
      expect(mockExecutor.executeAction).toHaveBeenCalled();
    });
  });

  describe('sshDevbox', () => {
    const { mockRun } = mockSubprocess();
    const { mockExists, mockMkdir, mockChmod, mockFsync } = mockFileSystem();

    beforeEach(() => {
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

      const { sshDevbox } = await import('../../../../../src/commands/devbox/ssh');
      
      await sshDevbox('test-id', { 
        ...createMockCommandOptions(),
        configOnly: false,
        noWait: false
      });

      expect(mockClient.devboxes.createSSHKey).toHaveBeenCalledWith('test-id');
      expect(mockClient.devboxes.retrieve).toHaveBeenCalledWith('test-id');
    });

    it('should print SSH config when config-only is true', async () => {
      const mockSSHKeyData = mockSSHKey();
      mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
      mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());

      const { sshDevbox } = await import('../../../../../src/commands/devbox/ssh');
      
      await sshDevbox('test-id', { 
        ...createMockCommandOptions(),
        configOnly: true,
        noWait: true
      });

      expect(mockClient.devboxes.createSSHKey).toHaveBeenCalledWith('test-id');
    });
  });

  describe('scpDevbox', () => {
    const { mockRun } = mockSubprocess();

    beforeEach(() => {
      jest.doMock('child_process', () => ({
        spawn: jest.fn(),
        exec: jest.fn()
      }));
    });

    it('should execute scp command with correct arguments', async () => {
      const mockSSHKeyData = mockSSHKey();
      mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
      mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());

      const { scpDevbox } = await import('../../../../../src/commands/devbox/scp');
      
      await scpDevbox('test-id', {
        ...createMockCommandOptions(),
        src: './local.txt',
        dst: ':/remote.txt'
      });

      expect(mockClient.devboxes.createSSHKey).toHaveBeenCalledWith('test-id');
    });
  });

  describe('rsyncDevbox', () => {
    const { mockRun } = mockSubprocess();

    beforeEach(() => {
      jest.doMock('child_process', () => ({
        spawn: jest.fn(),
        exec: jest.fn()
      }));
    });

    it('should execute rsync command with correct arguments', async () => {
      const mockSSHKeyData = mockSSHKey();
      mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
      mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());

      const { rsyncDevbox } = await import('../../../../../src/commands/devbox/rsync');
      
      await rsyncDevbox('test-id', {
        ...createMockCommandOptions(),
        src: ':/remote_dir',
        dst: './local_dir',
        rsyncOptions: '-avz'
      });

      expect(mockClient.devboxes.createSSHKey).toHaveBeenCalledWith('test-id');
    });
  });

  describe('tunnelDevbox', () => {
    const { mockRun } = mockSubprocess();

    beforeEach(() => {
      jest.doMock('child_process', () => ({
        spawn: jest.fn(),
        exec: jest.fn()
      }));
    });

    it('should create SSH tunnel with port forwarding', async () => {
      const mockSSHKeyData = mockSSHKey();
      mockClient.devboxes.createSSHKey.mockResolvedValue(mockSSHKeyData);
      mockClient.devboxes.retrieve.mockResolvedValue(mockDevbox());

      const { tunnelDevbox } = await import('../../../../../src/commands/devbox/tunnel');
      
      await tunnelDevbox('test-id', {
        ...createMockCommandOptions(),
        ports: '8080:3000'
      });

      expect(mockClient.devboxes.createSSHKey).toHaveBeenCalledWith('test-id');
    });
  });

  describe('readFile', () => {
    it('should read file contents from devbox', async () => {
      const fileContents = 'Hello, World!';
      mockClient.devboxes.readFileContents.mockResolvedValue(fileContents);

      const { readFile } = await import('../../../../../src/commands/devbox/read');
      
      await readFile('test-id', {
        ...createMockCommandOptions(),
        remote: '/path/to/remote/file.txt',
        output: '/path/to/local/file.txt'
      });

      expect(mockClient.devboxes.readFileContents).toHaveBeenCalledWith('test-id', {
        file_path: '/path/to/remote/file.txt'
      });
    });
  });

  describe('writeFile', () => {
    const mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      readFileSync: jest.fn().mockReturnValue('local content')
    };

    beforeEach(() => {
      jest.doMock('fs', () => mockFs);
    });

    it('should write file contents to devbox', async () => {
      mockClient.devboxes.writeFileContents.mockResolvedValue(undefined);

      const { writeFile } = await import('../../../../../src/commands/devbox/write');
      
      await writeFile('test-id', {
        ...createMockCommandOptions(),
        input: '/path/to/local/file.txt',
        remote: '/path/to/remote/file.txt'
      });

      expect(mockClient.devboxes.writeFileContents).toHaveBeenCalledWith('test-id', {
        file_path: '/path/to/remote/file.txt',
        contents: 'local content'
      });
    });

    it('should handle file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { writeFile } = await import('../../../../../src/commands/devbox/write');
      
      await expect(writeFile('test-id', {
        ...createMockCommandOptions(),
        input: '/nonexistent/file.txt',
        remote: '/path/to/remote/file.txt'
      })).rejects.toThrow('Input file /nonexistent/file.txt does not exist');
    });
  });

  describe('downloadFile', () => {
    const { mockFetch } = mockNetwork();

    beforeEach(() => {
      jest.doMock('node-fetch', () => mockFetch);
    });

    it('should download file from devbox', async () => {
      const mockResponse = {
        download_url: 'https://example.com/download'
      };
      mockClient.devboxes.downloadFile.mockResolvedValue(mockResponse);
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
      });

      const { downloadFile } = await import('../../../../../src/commands/devbox/download');
      
      await downloadFile('test-id', {
        ...createMockCommandOptions(),
        filePath: '/remote/file.txt',
        outputPath: '/local/file.txt'
      });

      expect(mockClient.devboxes.downloadFile).toHaveBeenCalledWith('test-id', {
        path: '/remote/file.txt'
      });
    });
  });

  describe('execAsync', () => {
    it('should execute command asynchronously', async () => {
      const mockExecution = mockExecution();
      mockClient.devboxes.executeAsync.mockResolvedValue(mockExecution);

      const { execAsync } = await import('../../../../../src/commands/devbox/execAsync');
      
      await execAsync('test-id', {
        ...createMockCommandOptions(),
        command: 'echo hello'
      });

      expect(mockClient.devboxes.executeAsync).toHaveBeenCalledWith('test-id', {
        command: 'echo hello',
        shell_name: undefined
      });
    });
  });

  describe('getAsync', () => {
    it('should get async execution status', async () => {
      const mockExecution = mockExecution({ status: 'completed' });
      mockClient.devboxes.executions.retrieve.mockResolvedValue(mockExecution);

      const { getAsync } = await import('../../../../../src/commands/devbox/getAsync');
      
      await getAsync('test-id', {
        ...createMockCommandOptions(),
        executionId: 'exec-123'
      });

      expect(mockClient.devboxes.executions.retrieve).toHaveBeenCalledWith('exec-123', 'test-id');
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

      const { logsDevbox } = await import('../../../../../src/commands/devbox/logs');
      
      await logsDevbox('test-id', createMockCommandOptions());

      expect(mockClient.devboxes.logs.list).toHaveBeenCalledWith('test-id');
    });
  });
});


