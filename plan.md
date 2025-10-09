<!-- e07981e3-8e32-41a8-b4a5-c358d373091c 20ebaf64-0860-44a1-a532-b692b2209855 -->
# Port Python CLI Commands to Node.js

## Overview

Port all command functionality from the Python CLI (`rl-cli`) to the Node.js CLI (`rl-cli-node`), implementing missing commands while preserving the existing Node.js architecture with interactive React/Ink UIs and multiple output format support. Also implement a comprehensive Jest testing strategy that mirrors the Python CLI's pytest-based testing approach.

## Command Gaps Analysis

### Devbox Commands (Missing 15 commands)

**Currently has**: create, list, delete, exec, upload

**Missing**: get, suspend, resume, shutdown, ssh, scp, rsync, tunnel, read, write, upload_file, download_file, exec_async, get_async, logs

### Blueprint Commands (Missing 3 commands)  

**Currently has**: list

**Missing**: create, preview, get, logs

### Object Commands (Missing entirely - 5 commands)

**Need to add**: list, get, download, upload, delete

### Snapshot Commands (Missing 1 command)

**Currently has**: list, create, delete

**Missing**: status (get snapshot status)

## Implementation Strategy

All new commands will follow the existing Node.js pattern:

1. TypeScript implementation in `src/commands/`
2. Interactive UI using React/Ink components
3. Support for output formats: interactive (default), text, json, yaml
4. Use `CommandExecutor` utility for consistent behavior
5. Register commands in `src/cli.ts`

## Files to Create/Modify

### 1. Devbox Commands

- `src/commands/devbox/get.tsx` - Get devbox details
- `src/commands/devbox/suspend.tsx` - Suspend a devbox
- `src/commands/devbox/resume.tsx` - Resume a suspended devbox
- `src/commands/devbox/shutdown.tsx` - Shutdown a devbox (different from delete)
- `src/commands/devbox/ssh.tsx` - SSH into devbox with key management
- `src/commands/devbox/scp.tsx` - Copy files using scp
- `src/commands/devbox/rsync.tsx` - Sync files using rsync
- `src/commands/devbox/tunnel.tsx` - Create SSH tunnel for port forwarding
- `src/commands/devbox/read.tsx` - Read file from devbox via API
- `src/commands/devbox/write.tsx` - Write file to devbox via API
- `src/commands/devbox/download.tsx` - Download file from devbox
- `src/commands/devbox/execAsync.tsx` - Execute command asynchronously
- `src/commands/devbox/getAsync.tsx` - Get async execution status
- `src/commands/devbox/logs.tsx` - View devbox logs

### 2. Blueprint Commands

- `src/commands/blueprint/create.tsx` - Create blueprint
- `src/commands/blueprint/preview.tsx` - Preview blueprint before creation
- `src/commands/blueprint/get.tsx` - Get blueprint details
- `src/commands/blueprint/logs.tsx` - Get blueprint build logs

### 3. Object Commands (New)

- `src/commands/object/list.tsx` - List objects with filtering
- `src/commands/object/get.tsx` - Get object details
- `src/commands/object/download.tsx` - Download object with optional extraction
- `src/commands/object/upload.tsx` - Upload file as object
- `src/commands/object/delete.tsx` - Delete object

### 4. Snapshot Commands

- `src/commands/snapshot/status.tsx` - Get snapshot operation status

### 5. Utilities

- `src/utils/ssh.ts` - SSH key management and connection utilities
- `src/utils/sshSession.ts` - Already exists, may need updates
- Update `src/utils/client.ts` if needed for new API methods

### 6. CLI Registration

- Update `src/cli.ts` - Register all new commands with proper options and aliases

## Key Implementation Details

### SSH-related Commands (ssh, scp, rsync, tunnel)

- Store SSH keys in `~/.runloop/ssh_keys/{devbox_id}.pem`
- Generate keys via API: `client.devboxes.createSshKey()`
- Use ProxyCommand with openssl for SSH over HTTPS
- Support wait-for-ready functionality with timeout and polling
- Commands: `ssh --config-only`, `ssh --no-wait`, `scp`, `rsync`, `tunnel local:remote`

### File Operations

- **API-based**: `read`, `write` - Use devbox file API endpoints
- **File transfer**: `upload_file`, `download_file` - Handle binary uploads/downloads
- **SSH-based**: `scp`, `rsync` - Shell out to system commands with proper SSH config

### Async Execution

- `exec_async` returns execution ID immediately
- `get_async` polls for execution status and results
- Handle pending/running/completed/failed states

### Blueprint Creation

- Support `--dockerfile` (inline) and `--dockerfile-path` (file)
- Support `--system-setup-commands` (multiple via append)
- Support `--resources`, `--architecture`, `--available-ports`
- Support `--root` or `--user username:uid` for user parameters

### Object Storage

- Auto-detect content type from file extension
- Support extraction flags for archives (.zip, .tar.gz, .tgz, .zst, .tar.zst)
- Three-step upload: create → upload to presigned URL → complete
- Filtering: by name, content_type, state, search query, public flag
- Progress indicators for large file uploads/downloads

### Devbox Lifecycle

- `suspend` - Suspend to save resources
- `resume` - Resume from suspended state
- `shutdown` - Graceful shutdown (different from delete)
- `logs` - Stream/display devbox execution logs with timestamps

## Command Registration Pattern

Each command group in `src/cli.ts`:

```typescript
// Devbox subcommands
devbox.command("get <id>").description("Get devbox details").option("-o, --output [format]", "...").action(...)
devbox.command("ssh <id>").option("--config-only", "...").option("--no-wait", "...").action(...)
// ... etc

// Object commands (new group)
const object = program.command("object").description("Manage object storage").alias("obj");
object.command("list").option("--limit <n>", "...").action(...)
// ... etc
```

## Testing Strategy (Jest)

### Test Structure

Mirror the Python CLI testing structure with Jest:

```
tests/
├── __tests__/
│   ├── unit/
│   │   ├── utils.test.ts              # Utility function tests
│   │   ├── client.test.ts             # API client tests
│   │   ├── commands/
│   │   │   ├── devbox.test.ts         # Devbox command tests
│   │   │   ├── blueprint.test.ts      # Blueprint command tests
│   │   │   └── object.test.ts         # Object command tests
│   ├── integration/
│   │   ├── devbox.e2e.test.ts         # Devbox E2E tests
│   │   ├── blueprint.e2e.test.ts      # Blueprint E2E tests
│   │   └── object.e2e.test.ts         # Object E2E tests
├── fixtures/
│   └── mocks.ts                        # Shared mock objects
├── setup.ts                            # Jest setup file
└── helpers.ts                          # Test helper functions
```

### Testing Dependencies

Add to `package.json`:
```json
"devDependencies": {
  "@types/jest": "^29.5.0",
  "jest": "^29.7.0",
  "ts-jest": "^29.1.0",
  "ts-node": "^10.9.0"
}
```

### Jest Configuration

Create `jest.config.js`:
```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
```

### Test Patterns

#### 1. Unit Tests
- **Mock API client** using Jest mocks
- Test command logic in isolation
- Test utility functions (base URL, SSH URL, cache management)
- Test argument parsing and validation
- Test error handling
- Use `jest.mock()` for external dependencies

Example:
```typescript
describe('devbox commands', () => {
  it('should create devbox with correct parameters', async () => {
    const mockClient = {
      devboxes: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' })
      }
    };
    // Test implementation
  });
});
```

#### 2. Integration Tests (E2E)
- **Require real API key** via `RUNLOOP_API_KEY` environment variable
- Create real resources and clean them up
- Test full command execution flow
- Use timeout annotations for long-running operations
- Skip if no API key is present

Example:
```typescript
describe('devbox E2E', () => {
  it('should create and retrieve real devbox', async () => {
    if (!process.env.RUNLOOP_API_KEY) {
      test.skip('RUNLOOP_API_KEY required for E2E tests');
    }
    // Test with real API calls
  }, 60000); // 60 second timeout
});
```

### Test Coverage Areas

#### Unit Tests (100+ tests minimum)
- **Utils** (15 tests):
  - Base URL resolution (dev/prod)
  - SSH URL resolution (dev/prod)
  - Cache directory management
  - Update checking logic
  - Environment variable handling

- **Devbox Commands** (50+ tests):
  - create, list, get, suspend, resume, shutdown
  - execute (sync/async), get async status
  - SSH: key generation, config generation, wait-for-ready
  - File operations: read, write, upload, download
  - Network: scp, rsync, tunnel
  - Logs: formatting, timestamp handling
  - Snapshots: create, list, status

- **Blueprint Commands** (15 tests):
  - create, list, get, preview, logs
  - Dockerfile handling (inline vs file)
  - Launch parameters validation

- **Object Commands** (20 tests):
  - list, get, download, upload, delete
  - Content type detection
  - Three-step upload flow
  - Filtering and pagination

#### Integration Tests (10+ tests)
- **Devbox E2E** (4 tests):
  - Create and retrieve devbox
  - List devboxes
  - Execute commands
  - Lifecycle operations (suspend/resume)

- **Blueprint E2E** (3 tests):
  - Create and retrieve blueprint
  - List blueprints
  - Get build logs

- **Object E2E** (3 tests):
  - Upload and download objects
  - List with filtering
  - Delete objects

### Test Fixtures and Mocks

Create `tests/fixtures/mocks.ts`:
```typescript
export const mockDevbox = (overrides = {}) => ({
  id: 'test-id',
  status: 'running',
  created_at: '2024-01-01T00:00:00Z',
  launch_parameters: {
    user_parameters: {
      username: 'test-user'
    }
  },
  ...overrides
});

export const mockAPIClient = () => ({
  devboxes: {
    create: jest.fn(),
    list: jest.fn(),
    retrieve: jest.fn(),
    // ... other methods
  },
  blueprints: { /* ... */ },
  objects: { /* ... */ }
});
```

### Test Setup

Create `tests/setup.ts`:
```typescript
// Set test environment variables
process.env.RUNLOOP_ENV = 'dev';
process.env.RUNLOOP_API_KEY = process.env.RUNLOOP_API_KEY || 'test-api-key';

// Mock console methods if needed
global.console = {
  ...console,
  error: jest.fn(),
  log: jest.fn(),
};
```

### NPM Scripts

Add to `package.json`:
```json
"scripts": {
  "test": "jest",
  "test:unit": "jest tests/__tests__/unit",
  "test:integration": "jest tests/__tests__/integration",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "RUN_E2E=1 jest tests/__tests__/integration"
}
```

### Key Testing Principles

1. **Unit tests should NOT make real API calls** - use mocks
2. **Integration tests REQUIRE real API key** - skip if not present
3. **Clean up resources** in integration tests (use try/finally)
4. **Test both success and error paths**
5. **Use parameterized tests** for similar test cases
6. **Mock external dependencies** (file system, subprocess, network)
7. **Test edge cases** (timeouts, failures, invalid inputs)
8. **Maintain test isolation** - clear caches, reset mocks

### Coverage Goals

- Unit tests: >80% code coverage
- All command implementations should have tests
- All utility functions should have tests
- Critical paths (API calls, file operations) must be tested
- Error handling paths must be tested

## Notes

- Maintain consistent error handling across all commands
- Use existing components: Spinner, ErrorMessage, SuccessMessage, Table
- Follow existing patterns in devbox/create.tsx and devbox/list.tsx
- Support both `--id` and positional `<id>` arguments where appropriate
- Keep command aliases consistent (e.g., `obj` for `object`, `bp` for `blueprint`)

### To-dos

- [x] Implement 14 missing devbox commands (get, suspend, resume, shutdown, ssh, scp, rsync, tunnel, read, write, download, execAsync, getAsync, logs)
- [x] Create SSH utility module for key management and connection handling
- [x] Implement 4 missing blueprint commands (create, preview, get, logs)
- [x] Implement complete object storage command group (list, get, download, upload, delete)
- [x] Add snapshot status command
- [x] Register all new commands in src/cli.ts with proper options and help text
- [ ] Set up Jest testing framework and configuration
- [ ] Create test directory structure and fixtures
- [ ] Implement unit tests for utility functions
- [ ] Implement unit tests for devbox commands
- [ ] Implement unit tests for blueprint commands
- [ ] Implement unit tests for object commands
- [ ] Implement integration/E2E tests
- [ ] Achieve >80% test coverage
- [ ] Verify all tests pass and API compatibility



