import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
// Helper function to wait for devbox to be ready
async function waitForDevboxReady(devboxId, maxWaitTime = 300000) {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    while (Date.now() - startTime < maxWaitTime) {
        try {
            const { stdout } = await execAsync(`node dist/cli.js devbox get ${devboxId} --output json`);
            const devbox = JSON.parse(stdout);
            if (devbox.status === 'running') {
                console.log(`Devbox ${devboxId} is ready!`);
                return;
            }
            console.log(`Devbox ${devboxId} status: ${devbox.status}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        catch (error) {
            console.log(`Error checking devbox status: ${error}`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
    throw new Error(`Devbox ${devboxId} did not become ready within ${maxWaitTime}ms`);
}
describe('Devbox E2E Tests', () => {
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
    describe('Devbox Lifecycle', () => {
        let devboxId;
        it('should create a devbox', async () => {
            const { stdout } = await execAsync('node dist/cli.js devbox create --architecture arm64 --resources SMALL --entrypoint "sleep 30" --output json');
            // Extract devbox ID from output
            const match = stdout.match(/"id":\s*"([^"]+)"/);
            expect(match).toBeTruthy();
            devboxId = match[1];
            expect(devboxId).toBeDefined();
            // Wait for devbox to be ready
            await waitForDevboxReady(devboxId);
        }, 300000); // 5 minutes timeout
        it('should get devbox details', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox get ${devboxId} --output json`);
            expect(stdout).toContain('"id":');
            expect(stdout).toContain(devboxId);
        }, 30000);
        it('should list devboxes', async () => {
            const { stdout } = await execAsync('node dist/cli.js devbox list --output json');
            expect(stdout).toContain('"id":');
        }, 30000);
        it('should execute command on devbox', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox exec ${devboxId} "echo hello" --output json`);
            expect(stdout).toContain('"result":');
        }, 60000);
        it('should suspend devbox', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox suspend ${devboxId} --output json`);
            expect(stdout).toContain('"id":');
            // Wait for suspend to complete
            await new Promise(resolve => setTimeout(resolve, 10000));
        }, 60000);
        it('should resume devbox', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox resume ${devboxId} --output json`);
            expect(stdout).toContain('"id":');
        }, 60000);
        it('should shutdown devbox', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox shutdown ${devboxId} --output json`);
            expect(stdout).toContain('"id":');
        }, 30000);
    });
    describe('Devbox File Operations', () => {
        let devboxId;
        beforeAll(async () => {
            if (!apiKey)
                return;
            // Create a devbox for file operations
            const { stdout } = await execAsync('node dist/cli.js devbox create --architecture arm64 --resources SMALL --entrypoint "sleep 60" --output json');
            const match = stdout.match(/"id":\s*"([^"]+)"/);
            if (match) {
                devboxId = match[1];
                // Wait for devbox to be ready
                await waitForDevboxReady(devboxId);
            }
        }, 60000);
        afterAll(async () => {
            if (devboxId) {
                try {
                    await execAsync(`node dist/cli.js devbox shutdown ${devboxId}`);
                }
                catch (error) {
                    console.warn('Failed to cleanup devbox:', error);
                }
            }
        });
        it('should read file from devbox', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox read ${devboxId} --remote /etc/hostname --output-path /tmp/hostname.txt --output json`);
            expect(stdout).toContain('"remotePath":');
        }, 30000);
        it('should write file to devbox', async () => {
            expect(devboxId).toBeDefined();
            // Create a temporary file
            const fs = require('fs');
            const path = require('path');
            const tempFile = path.join(require('os').tmpdir(), 'test-file.txt');
            fs.writeFileSync(tempFile, 'Hello, World!');
            try {
                const { stdout } = await execAsync(`node dist/cli.js devbox write ${devboxId} --input ${tempFile} --remote /tmp/test-file.txt --output json`);
                expect(stdout).toContain('"inputPath":');
            }
            finally {
                fs.unlinkSync(tempFile);
            }
        }, 30000);
    });
    describe('Devbox Async Operations', () => {
        let devboxId;
        let executionId;
        beforeAll(async () => {
            if (!apiKey)
                return;
            // Create a devbox for async operations
            const { stdout } = await execAsync('node dist/cli.js devbox create --architecture arm64 --resources SMALL --entrypoint "sleep 60" --output json');
            const match = stdout.match(/"id":\s*"([^"]+)"/);
            if (match) {
                devboxId = match[1];
                // Wait for devbox to be ready
                await waitForDevboxReady(devboxId);
            }
        }, 60000);
        afterAll(async () => {
            if (devboxId) {
                try {
                    await execAsync(`node dist/cli.js devbox shutdown ${devboxId}`);
                }
                catch (error) {
                    console.warn('Failed to cleanup devbox:', error);
                }
            }
        });
        it('should execute command asynchronously', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox exec-async ${devboxId} "echo hello" --output json`);
            expect(stdout).toContain('"execution_id":');
            // Extract execution ID
            const match = stdout.match(/"execution_id":\s*"([^"]+)"/);
            if (match) {
                executionId = match[1];
            }
        }, 30000);
        it('should get async execution status', async () => {
            expect(devboxId).toBeDefined();
            expect(executionId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox get-async ${devboxId} ${executionId} --output json`);
            expect(stdout).toContain('"execution_id":');
        }, 30000);
    });
    describe('Devbox Logs', () => {
        let devboxId;
        beforeAll(async () => {
            if (!apiKey)
                return;
            // Create a devbox for logs
            const { stdout } = await execAsync('node dist/cli.js devbox create --architecture arm64 --resources SMALL --entrypoint "echo test && sleep 30" --output json');
            const match = stdout.match(/"id":\s*"([^"]+)"/);
            if (match) {
                devboxId = match[1];
                // Wait for devbox to be ready
                await waitForDevboxReady(devboxId);
            }
        }, 60000);
        afterAll(async () => {
            if (devboxId) {
                try {
                    await execAsync(`node dist/cli.js devbox shutdown ${devboxId}`);
                }
                catch (error) {
                    console.warn('Failed to cleanup devbox:', error);
                }
            }
        });
        it('should retrieve devbox logs', async () => {
            expect(devboxId).toBeDefined();
            const { stdout } = await execAsync(`node dist/cli.js devbox logs ${devboxId} --output json`);
            expect(stdout).toContain('"logs":');
        }, 30000);
    });
});
