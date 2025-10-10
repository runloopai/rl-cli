import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Blueprint E2E Tests', () => {
  const apiKey = process.env.RUNLOOP_API_KEY;
  
  beforeAll(() => {
    if (!apiKey) {
      console.log('Skipping E2E tests: RUNLOOP_API_KEY not set');
    }
  });

  beforeEach(() => {
    if (!apiKey) {
      pending('RUNLOOP_API_KEY required for E2E tests');
    }
  });

  describe('Blueprint Lifecycle', () => {
    let blueprintId: string;

    it('should create a blueprint', async () => {
      const { stdout } = await execAsync('node dist/cli.js blueprint create test-blueprint --dockerfile "FROM ubuntu:20.04" --system-setup-commands "apt update" --resources SMALL --output json');
      
      // Extract blueprint ID from output
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      blueprintId = match![1];
      expect(blueprintId).toBeDefined();
    }, 60000);

    it('should get blueprint details', async () => {
      expect(blueprintId).toBeDefined();
      
      const { stdout } = await execAsync(`node dist/cli.js blueprint get ${blueprintId} --output json`);
      
      expect(stdout).toContain('"id":');
      expect(stdout).toContain(blueprintId);
    }, 30000);

    it('should list blueprints', async () => {
      const { stdout } = await execAsync('node dist/cli.js blueprint list --output json');
      
      expect(stdout).toContain('"id":');
    }, 30000);

    it('should preview blueprint', async () => {
      const { stdout } = await execAsync('node dist/cli.js blueprint preview test-blueprint-preview --dockerfile "FROM ubuntu:20.04" --resources SMALL --output json');
      
      expect(stdout).toContain('"dockerfile":');
    }, 30000);
  });

  describe('Blueprint with Dockerfile File', () => {
    let blueprintId: string;
    let dockerfilePath: string;

    beforeAll(async () => {
      if (!apiKey) return;
      
      // Create a temporary Dockerfile
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      dockerfilePath = path.join(os.tmpdir(), 'Dockerfile');
      fs.writeFileSync(dockerfilePath, 'FROM ubuntu:20.04\nRUN apt update\nRUN apt install -y git');
    });

    afterAll(async () => {
      if (dockerfilePath) {
        try {
          const fs = require('fs');
          fs.unlinkSync(dockerfilePath);
        } catch (error) {
          console.warn('Failed to cleanup Dockerfile:', error);
        }
      }
    });

    it('should create blueprint with dockerfile file', async () => {
      const { stdout } = await execAsync(`node dist/cli.js blueprint create test-blueprint-file --dockerfile-path ${dockerfilePath} --resources SMALL --output json`);
      
      // Extract blueprint ID from output
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      blueprintId = match![1];
      expect(blueprintId).toBeDefined();
    }, 60000);
  });

  describe('Blueprint with User Parameters', () => {
    let blueprintId: string;

    it('should create blueprint with root user', async () => {
      const { stdout } = await execAsync('node dist/cli.js blueprint create test-blueprint-root --dockerfile "FROM ubuntu:20.04" --root --resources SMALL --output json');
      
      // Extract blueprint ID from output
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      blueprintId = match![1];
      expect(blueprintId).toBeDefined();
    }, 60000);

    it('should create blueprint with custom user', async () => {
      const { stdout } = await execAsync('node dist/cli.js blueprint create test-blueprint-user --dockerfile "FROM ubuntu:20.04" --user testuser:1000 --resources SMALL --output json');
      
      // Extract blueprint ID from output
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      expect(match![1]).toBeDefined();
    }, 60000);
  });

  describe('Blueprint with Advanced Options', () => {
    let blueprintId: string;

    it('should create blueprint with architecture and ports', async () => {
      const { stdout } = await execAsync('node dist/cli.js blueprint create test-blueprint-advanced --dockerfile "FROM ubuntu:20.04" --architecture arm64 --available-ports 3000,8080 --resources MEDIUM --output json');
      
      // Extract blueprint ID from output
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      blueprintId = match![1];
      expect(blueprintId).toBeDefined();
    }, 60000);
  });

  describe('Blueprint Build Logs', () => {
    let blueprintId: string;

    beforeAll(async () => {
      if (!apiKey) return;
      
      // Create a blueprint for logs
      const { stdout } = await execAsync('node dist/cli.js blueprint create test-blueprint-logs --dockerfile "FROM ubuntu:20.04" --system-setup-commands "apt update" --resources SMALL --output json');
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      if (match) {
        blueprintId = match[1];
      }
    }, 60000);

    it('should retrieve blueprint build logs', async () => {
      if (!blueprintId) {
        pending('Blueprint not created');
      }

      const { stdout } = await execAsync(`node dist/cli.js blueprint logs ${blueprintId} --output json`);
      
      expect(stdout).toContain('"logs":');
    }, 30000);
  });
});
