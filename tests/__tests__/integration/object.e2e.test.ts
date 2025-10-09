import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

describe('Object E2E Tests', () => {
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

  describe('Object Lifecycle', () => {
    let objectId: string;
    let tempFilePath: string;
    let downloadPath: string;

    beforeAll(() => {
      // Create a temporary file for upload
      tempFilePath = join(tmpdir(), `test-upload-${Date.now()}.txt`);
      writeFileSync(tempFilePath, 'Hello, World! This is a test file.');
      
      downloadPath = join(tmpdir(), `test-download-${Date.now()}.txt`);
    });

    afterAll(() => {
      // Cleanup temporary files
      try {
        if (existsSync(tempFilePath)) {
          unlinkSync(tempFilePath);
        }
        if (existsSync(downloadPath)) {
          unlinkSync(downloadPath);
        }
      } catch (error) {
        console.warn('Failed to cleanup temp files:', error);
      }
    });

    it('should upload file as object', async () => {
      const { stdout } = await execAsync(`node dist/cli.js object upload ${tempFilePath} --name test-object --output json`);
      
      // Extract object ID from output
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      objectId = match![1];
      expect(objectId).toBeDefined();
    }, 60000);

    it('should list objects', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list');
      
      expect(stdout).toContain('obj_');
    }, 30000);

    it('should get object details', async () => {
      expect(objectId).toBeDefined();
      
      const { stdout } = await execAsync(`node dist/cli.js object get ${objectId}`);
      
      expect(stdout).toContain('obj_');
      expect(stdout).toContain(objectId);
    }, 30000);

    it('should download object', async () => {
      expect(objectId).toBeDefined();
      
      const { stdout } = await execAsync(`node dist/cli.js object download ${objectId} ${downloadPath}`);
      
      expect(stdout).toContain('Object downloaded successfully');
      expect(existsSync(downloadPath)).toBe(true);
    }, 30000);

    it('should delete object', async () => {
      expect(objectId).toBeDefined();
      
      const { stdout } = await execAsync(`node dist/cli.js object delete ${objectId}`);
      
      expect(stdout).toContain('obj_');
    }, 30000);
  });

  describe('Object Filtering', () => {
    let objectIds: string[] = [];

    beforeAll(async () => {
      if (!apiKey) return;
      
      // Create multiple test objects
      const tempFiles = [];
      for (let i = 0; i < 3; i++) {
        const tempFile = join(tmpdir(), `test-filter-${i}-${Date.now()}.txt`);
        writeFileSync(tempFile, `Test content ${i}`);
        tempFiles.push(tempFile);
      }

      try {
        // Upload objects
        for (let i = 0; i < tempFiles.length; i++) {
          const { stdout } = await execAsync(`node dist/cli.js object upload ${tempFiles[i]} --name test-filter-${i}`);
          const match = stdout.match(/"id":\s*"([^"]+)"/);
          if (match) {
            objectIds.push(match[1]);
          }
        }
      } finally {
        // Cleanup temp files
        tempFiles.forEach(file => {
          try {
            if (existsSync(file)) {
              unlinkSync(file);
            }
          } catch (error) {
            console.warn('Failed to cleanup temp file:', error);
          }
        });
      }
    }, 120000);

    afterAll(async () => {
      // Cleanup uploaded objects
      for (const objectId of objectIds) {
        try {
          await execAsync(`node dist/cli.js object delete ${objectId}`);
        } catch (error) {
          console.warn('Failed to cleanup object:', error);
        }
      }
    }, 60000);

    it('should filter objects by name', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --name test-filter-0');
      
      expect(stdout).toContain('obj_');
    }, 30000);

    it('should filter objects by content type', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --content-type text/plain');
      
      expect(stdout).toContain('obj_');
    }, 30000);

    it('should filter objects by state', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --state READ_ONLY');
      
      expect(stdout).toContain('obj_');
    }, 30000);

    it('should search objects', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --search test-filter');
      
      expect(stdout).toContain('obj_');
    }, 30000);

    it('should limit results', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --limit 2');
      
      expect(stdout).toContain('obj_');
    }, 30000);
  });

  describe('Object Content Types', () => {
    let objectIds: string[] = [];

    beforeAll(async () => {
      if (!apiKey) return;
      
      // Create files with different extensions
      const testFiles = [
        { path: join(tmpdir(), `test-${Date.now()}.txt`), content: 'Text file' },
        { path: join(tmpdir(), `test-${Date.now()}.json`), content: '{"test": "data"}' },
        { path: join(tmpdir(), `test-${Date.now()}.html`), content: '<html><body>Test</body></html>' }
      ];

      try {
        // Create and upload files
        for (const file of testFiles) {
          writeFileSync(file.path, file.content);
          const { stdout } = await execAsync(`node dist/cli.js object upload ${file.path}`);
          const match = stdout.match(/"id":\s*"([^"]+)"/);
          if (match) {
            objectIds.push(match[1]);
          }
        }
      } finally {
        // Cleanup temp files
        testFiles.forEach(file => {
          try {
            if (existsSync(file.path)) {
              unlinkSync(file.path);
            }
          } catch (error) {
            console.warn('Failed to cleanup temp file:', error);
          }
        });
      }
    }, 120000);

    afterAll(async () => {
      // Cleanup uploaded objects
      for (const objectId of objectIds) {
        try {
          await execAsync(`node dist/cli.js object delete ${objectId}`);
        } catch (error) {
          console.warn('Failed to cleanup object:', error);
        }
      }
    }, 60000);

    it('should auto-detect content types', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --output json');
      
      expect(stdout).toContain('obj_');
      // Should contain different content types
      expect(stdout).toMatch(/\"content_type\":\s*\"text\"/);
    }, 30000);
  });

  describe('Object Public Access', () => {
    let objectId: string;
    let tempFilePath: string;

    beforeAll(() => {
      tempFilePath = join(tmpdir(), `test-public-${Date.now()}.txt`);
      writeFileSync(tempFilePath, 'Public test content');
    });

    afterAll(async () => {
      // Cleanup
      try {
        if (existsSync(tempFilePath)) {
          unlinkSync(tempFilePath);
        }
        if (objectId) {
          await execAsync(`node dist/cli.js object delete ${objectId}`);
        }
      } catch (error) {
        console.warn('Failed to cleanup:', error);
      }
    });

    it('should upload public object', async () => {
      const { stdout } = await execAsync(`node dist/cli.js object upload ${tempFilePath} --name test-public --public --output json`);
      
      const match = stdout.match(/"id":\s*"([^"]+)"/);
      expect(match).toBeTruthy();
      objectId = match![1];
      expect(objectId).toBeDefined();
    }, 60000);

    it('should filter public objects', async () => {
      const { stdout } = await execAsync('node dist/cli.js object list --public true --output json');
      
      // Should return valid JSON (empty array if no public objects)
      expect(stdout.trim()).toMatch(/^\[.*\]$/);
    }, 30000);
  });
});
