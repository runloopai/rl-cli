import { jest } from '@jest/globals';
import { join } from 'path';
import { homedir } from 'os';

// Mock the client module
jest.mock('../../../../src/utils/client', () => ({
  getClient: jest.fn()
}));

// Mock environment variables
const originalEnv = process.env;

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Base URL Resolution', () => {
    it('should return dev URL when RUNLOOP_ENV is dev', () => {
      process.env.RUNLOOP_ENV = 'dev';
      
      // Import after setting env
      const { baseUrl } = require('../../../../src/utils/config');
      expect(baseUrl()).toBe('https://api.runloop.pro');
    });

    it('should return prod URL when RUNLOOP_ENV is not set', () => {
      delete process.env.RUNLOOP_ENV;
      
      const { baseUrl } = require('../../../../src/utils/config');
      expect(baseUrl()).toBe('https://api.runloop.ai');
    });

    it('should return prod URL when RUNLOOP_ENV is prod', () => {
      process.env.RUNLOOP_ENV = 'prod';
      
      const { baseUrl } = require('../../../../src/utils/config');
      expect(baseUrl()).toBe('https://api.runloop.ai');
    });
  });

  describe('SSH URL Resolution', () => {
    it('should return dev SSH URL when RUNLOOP_ENV is dev', () => {
      process.env.RUNLOOP_ENV = 'dev';
      
      const { sshUrl } = require('../../../../src/utils/config');
      expect(sshUrl()).toBe('ssh.runloop.pro:443');
    });

    it('should return prod SSH URL when RUNLOOP_ENV is not set', () => {
      delete process.env.RUNLOOP_ENV;
      
      const { sshUrl } = require('../../../../src/utils/config');
      expect(sshUrl()).toBe('ssh.runloop.ai:443');
    });
  });

  describe('Cache Directory Management', () => {
    it('should return correct cache directory path', () => {
      const { getCacheDir } = require('../../../../src/utils/config');
      const expected = join(homedir(), '.cache', 'rl-cli');
      expect(getCacheDir()).toBe(expected);
    });
  });

  describe('Update Checking Logic', () => {
    const mockFs = {
      existsSync: jest.fn(),
      statSync: jest.fn(),
      utimesSync: jest.fn()
    };

    beforeEach(() => {
      jest.doMock('fs', () => mockFs);
    });

    it('should return true when no cache exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const { shouldCheckForUpdates } = require('../../../../src/utils/config');
      expect(shouldCheckForUpdates()).toBe(true);
    });

    it('should return false for recent cache', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        mtime: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      });
      
      const { shouldCheckForUpdates } = require('../../../../src/utils/config');
      expect(shouldCheckForUpdates()).toBe(false);
    });

    it('should return true for old cache', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        mtime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2 days ago
      });
      
      const { shouldCheckForUpdates } = require('../../../../src/utils/config');
      expect(shouldCheckForUpdates()).toBe(true);
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing API key gracefully', () => {
      delete process.env.RUNLOOP_API_KEY;
      
      const { getClient } = require('../../../../src/utils/client');
      expect(() => getClient()).not.toThrow();
    });

    it('should use provided API key', () => {
      process.env.RUNLOOP_API_KEY = 'test-key';
      
      const { getClient } = require('../../../../src/utils/client');
      const client = getClient();
      expect(client).toBeDefined();
    });
  });

  describe('URL Utilities', () => {
    it('should construct SSH config correctly', () => {
      const { constructSSHConfig } = require('../../../../src/utils/ssh');
      
      const config = constructSSHConfig({
        hostname: 'test-host',
        username: 'test-user',
        keyPath: '/path/to/key',
        port: 443
      });
      
      expect(config).toContain('Host test-host');
      expect(config).toContain('User test-user');
      expect(config).toContain('IdentityFile /path/to/key');
      expect(config).toContain('Port 443');
    });
  });

  describe('SSH Key Management', () => {
    const mockFs = {
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      chmodSync: jest.fn(),
      fsyncSync: jest.fn()
    };

    beforeEach(() => {
      jest.doMock('fs', () => mockFs);
    });

    it('should create SSH key file with correct permissions', async () => {
      const mockClient = {
        devboxes: {
          createSSHKey: jest.fn().mockResolvedValue({
            ssh_private_key: 'test-key',
            url: 'test-host'
          })
        }
      };

      jest.doMock('../../../../src/utils/client', () => ({
        getClient: () => mockClient
      }));

      const { getSSHKey } = require('../../../../src/utils/ssh');
      
      const result = await getSSHKey('test-devbox-id');
      
      expect(result).toBeDefined();
      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(mockFs.chmodSync).toHaveBeenCalledWith(expect.any(String), 0o600);
    });

    it('should handle SSH key creation failure', async () => {
      const mockClient = {
        devboxes: {
          createSSHKey: jest.fn().mockResolvedValue(null)
        }
      };

      jest.doMock('../../../../src/utils/client', () => ({
        getClient: () => mockClient
      }));

      const { getSSHKey } = require('../../../../src/utils/ssh');
      
      const result = await getSSHKey('test-devbox-id');
      
      expect(result).toBeNull();
    });
  });

  describe('Command Executor', () => {
    it('should create executor with correct options', () => {
      const { createExecutor } = require('../../../../src/utils/CommandExecutor');
      
      const executor = createExecutor({ output: 'json' });
      expect(executor).toBeDefined();
      expect(executor.getClient).toBeDefined();
      expect(executor.executeAction).toBeDefined();
    });

    it('should handle different output formats', () => {
      const { createExecutor } = require('../../../../src/utils/CommandExecutor');
      
      const jsonExecutor = createExecutor({ output: 'json' });
      const yamlExecutor = createExecutor({ output: 'yaml' });
      const textExecutor = createExecutor({ output: 'text' });
      
      expect(jsonExecutor).toBeDefined();
      expect(yamlExecutor).toBeDefined();
      expect(textExecutor).toBeDefined();
    });
  });
});


