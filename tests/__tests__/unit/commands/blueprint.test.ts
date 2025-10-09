import { jest } from '@jest/globals';
import { mockBlueprint, mockAPIClient } from '../../../fixtures/mocks';
import { createMockCommandOptions } from '../../../helpers';

// Mock the client and executor
jest.mock('../../../../../src/utils/client', () => ({
  getClient: jest.fn()
}));

jest.mock('../../../../../src/utils/CommandExecutor', () => ({
  createExecutor: jest.fn()
}));

describe('Blueprint Commands', () => {
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

  describe('createBlueprint', () => {
    const mockFs = {
      existsSync: jest.fn(),
      readFileSync: jest.fn()
    };

    beforeEach(() => {
      jest.doMock('fs', () => mockFs);
    });

    it('should create blueprint with inline dockerfile', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        systemSetupCommands: ['apt update', 'apt install -y git'],
        resources: 'SMALL',
        architecture: 'arm64',
        availablePorts: [3000, 8080]
      });

      expect(mockClient.blueprints.create).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: ['apt update', 'apt install -y git'],
        launch_parameters: {
          resource_size_request: 'SMALL',
          architecture: 'arm64',
          available_ports: [3000, 8080],
          user_parameters: undefined
        }
      });
    });

    it('should create blueprint with dockerfile file', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('FROM ubuntu:20.04\nRUN apt update');

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfilePath: '/path/to/Dockerfile',
        systemSetupCommands: ['apt update'],
        resources: 'MEDIUM'
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/Dockerfile', 'utf-8');
      expect(mockClient.blueprints.create).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04\nRUN apt update',
        system_setup_commands: ['apt update'],
        launch_parameters: {
          resource_size_request: 'MEDIUM',
          architecture: undefined,
          available_ports: undefined,
          user_parameters: undefined
        }
      });
    });

    it('should handle dockerfile file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await expect(createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfilePath: '/nonexistent/Dockerfile'
      })).rejects.toThrow('Dockerfile file /nonexistent/Dockerfile does not exist');
    });

    it('should create blueprint with user parameters', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        user: 'testuser:1000',
        resources: 'LARGE'
      });

      expect(mockClient.blueprints.create).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: undefined,
        launch_parameters: {
          resource_size_request: 'LARGE',
          architecture: undefined,
          available_ports: undefined,
          user_parameters: {
            username: 'testuser',
            uid: 1000
          }
        }
      });
    });
  });

  describe('previewBlueprint', () => {
    it('should preview blueprint without creating', async () => {
      const mockPreview = {
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: ['apt update'],
        launch_parameters: {
          resource_size_request: 'SMALL',
          architecture: 'arm64'
        }
      };
      mockClient.blueprints.preview.mockResolvedValue(mockPreview);

      const { previewBlueprint } = await import('../../../../../src/commands/blueprint/preview');
      
      await previewBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        systemSetupCommands: ['apt update'],
        resources: 'SMALL',
        architecture: 'arm64'
      });

      expect(mockClient.blueprints.preview).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: ['apt update'],
        launch_parameters: {
          resource_size_request: 'SMALL',
          architecture: 'arm64',
          available_ports: undefined,
          user_parameters: undefined
        }
      });
    });
  });

  describe('getBlueprint', () => {
    it('should retrieve blueprint details', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.retrieve.mockResolvedValue(mockBlueprintData);

      const { getBlueprint } = await import('../../../../../src/commands/blueprint/get');
      
      await getBlueprint('bp-test-id', createMockCommandOptions());

      expect(mockClient.blueprints.retrieve).toHaveBeenCalledWith('bp-test-id');
      expect(mockExecutor.executeAction).toHaveBeenCalled();
    });

    it('should handle blueprint not found', async () => {
      mockClient.blueprints.retrieve.mockRejectedValue(new Error('Blueprint not found'));

      const { getBlueprint } = await import('../../../../../src/commands/blueprint/get');
      
      await expect(getBlueprint('nonexistent-id', createMockCommandOptions()))
        .rejects.toThrow('Blueprint not found');
    });
  });

  describe('logsBlueprint', () => {
    it('should retrieve blueprint build logs', async () => {
      const mockLogs = {
        logs: [
          {
            timestamp_ms: 1710000000000,
            message: 'Building blueprint...',
            level: 'info'
          },
          {
            timestamp_ms: 1710000001000,
            message: 'Build completed successfully',
            level: 'info'
          }
        ]
      };
      mockClient.blueprints.logs.mockResolvedValue(mockLogs);

      const { logsBlueprint } = await import('../../../../../src/commands/blueprint/logs');
      
      await logsBlueprint('bp-test-id', createMockCommandOptions());

      expect(mockClient.blueprints.logs).toHaveBeenCalledWith('bp-test-id');
    });

    it('should handle blueprint logs not found', async () => {
      mockClient.blueprints.logs.mockRejectedValue(new Error('Logs not found'));

      const { logsBlueprint } = await import('../../../../../src/commands/blueprint/logs');
      
      await expect(logsBlueprint('nonexistent-id', createMockCommandOptions()))
        .rejects.toThrow('Logs not found');
    });
  });

  describe('Blueprint Creation Edge Cases', () => {
    it('should handle empty system setup commands', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        systemSetupCommands: [],
        resources: 'SMALL'
      });

      expect(mockClient.blueprints.create).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: [],
        launch_parameters: {
          resource_size_request: 'SMALL',
          architecture: undefined,
          available_ports: undefined,
          user_parameters: undefined
        }
      });
    });

    it('should handle multiple available ports', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        availablePorts: [3000, 8080, 9000],
        resources: 'SMALL'
      });

      expect(mockClient.blueprints.create).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: undefined,
        launch_parameters: {
          resource_size_request: 'SMALL',
          architecture: undefined,
          available_ports: [3000, 8080, 9000],
          user_parameters: undefined
        }
      });
    });

    it('should handle root user parameter', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      const { createBlueprint } = await import('../../../../../src/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        root: true,
        resources: 'SMALL'
      });

      expect(mockClient.blueprints.create).toHaveBeenCalledWith({
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        system_setup_commands: undefined,
        launch_parameters: {
          resource_size_request: 'SMALL',
          architecture: undefined,
          available_ports: undefined,
          user_parameters: {
            username: 'root',
            uid: 0
          }
        }
      });
    });
  });
});


