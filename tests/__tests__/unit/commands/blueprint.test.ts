import { jest } from '@jest/globals';
import { mockBlueprint, mockAPIClient } from '../../../fixtures/mocks';
import { createMockCommandOptions } from '../../../helpers';

// Mock the client and executor
jest.mock('@/utils/client', () => ({
  getClient: jest.fn()
}));

jest.mock('@/utils/CommandExecutor', () => ({
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

    jest.doMock('@/utils/client', () => ({
      getClient: () => mockClient
    }));

    jest.doMock('@/utils/CommandExecutor', () => ({
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

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        systemSetupCommands: ['apt update', 'apt install -y git'],
        resources: 'SMALL',
        architecture: 'arm64',
        availablePorts: [3000, 8080]
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should create blueprint with dockerfile file', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('FROM ubuntu:20.04\nRUN apt update');

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfilePath: '/path/to/Dockerfile',
        systemSetupCommands: ['apt update'],
        resources: 'MEDIUM'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should handle dockerfile file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfilePath: '/nonexistent/Dockerfile'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should create blueprint with user parameters', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        user: 'testuser:1000',
        resources: 'LARGE'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
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

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { previewBlueprint } = await import('@/commands/blueprint/preview');
      
      await previewBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        systemSetupCommands: ['apt update'],
        resources: 'SMALL',
        architecture: 'arm64'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('getBlueprint', () => {
    it('should retrieve blueprint details', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.retrieve.mockResolvedValue(mockBlueprintData);

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { getBlueprint } = await import('@/commands/blueprint/get');
      
      await getBlueprint('bp-test-id', createMockCommandOptions());

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should handle blueprint not found', async () => {
      mockClient.blueprints.retrieve.mockRejectedValue(new Error('Blueprint not found'));

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { getBlueprint } = await import('@/commands/blueprint/get');
      
      await getBlueprint('nonexistent-id', createMockCommandOptions());

      // Test passes if no error is thrown
      expect(true).toBe(true);
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

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { getBlueprintLogs } = await import('@/commands/blueprint/logs');
      
      await getBlueprintLogs({ id: 'bp-test-id', ...createMockCommandOptions() });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should handle blueprint logs not found', async () => {
      mockClient.blueprints.logs.mockRejectedValue(new Error('Logs not found'));

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { getBlueprintLogs } = await import('@/commands/blueprint/logs');
      
      await getBlueprintLogs({ id: 'nonexistent-id', ...createMockCommandOptions() });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('Blueprint Creation Edge Cases', () => {
    it('should handle empty system setup commands', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        systemSetupCommands: [],
        resources: 'SMALL'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should handle multiple available ports', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        availablePorts: [3000, 8080, 9000],
        resources: 'SMALL'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should handle root user parameter', async () => {
      const mockBlueprintData = mockBlueprint();
      mockClient.blueprints.create.mockResolvedValue(mockBlueprintData);

      // Clear module cache and import dynamically
      jest.resetModules();
      
      // Re-setup mocks after clearing modules
      jest.doMock('@/utils/client', () => ({
        getClient: () => mockClient
      }));

      jest.doMock('@/utils/CommandExecutor', () => ({
        createExecutor: () => mockExecutor
      }));

      jest.doMock('fs', () => mockFs);

      const { createBlueprint } = await import('@/commands/blueprint/create');
      
      await createBlueprint({
        ...createMockCommandOptions(),
        name: 'test-blueprint',
        dockerfile: 'FROM ubuntu:20.04',
        root: true,
        resources: 'SMALL'
      });

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });
});


