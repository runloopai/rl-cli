import { jest } from '@jest/globals';

export const mockDevbox = (overrides = {}) => ({
  id: 'test-id',
  status: 'running',
  created_at: '2024-01-01T00:00:00Z',
  launch_parameters: {
    user_parameters: {
      username: 'test-user'
    }
  },
  model_dump_json: jest.fn().mockReturnValue(JSON.stringify({
    id: 'test-id',
    status: 'running',
    created_at: '2024-01-01T00:00:00Z'
  })),
  ...overrides
});

export const mockBlueprint = (overrides = {}) => ({
  id: 'bp-test-id',
  name: 'test-blueprint',
  status: 'ready',
  created_at: '2024-01-01T00:00:00Z',
  model_dump_json: jest.fn().mockReturnValue(JSON.stringify({
    id: 'bp-test-id',
    name: 'test-blueprint',
    status: 'ready'
  })),
  ...overrides
});

export const mockObject = (overrides = {}) => ({
  id: 'obj-test-id',
  name: 'test-object',
  content_type: 'text',
  state: 'READ_ONLY',
  size_bytes: 1024,
  created_at: '2024-01-01T00:00:00Z',
  model_dump_json: jest.fn().mockReturnValue(JSON.stringify({
    id: 'obj-test-id',
    name: 'test-object',
    content_type: 'text',
    state: 'READ_ONLY'
  })),
  ...overrides
});

export const mockSnapshot = (overrides = {}) => ({
  id: 'snap-test-id',
  devbox_id: 'test-id',
  status: 'completed',
  created_at: '2024-01-01T00:00:00Z',
  model_dump_json: jest.fn().mockReturnValue(JSON.stringify({
    id: 'snap-test-id',
    devbox_id: 'test-id',
    status: 'completed'
  })),
  ...overrides
});

export const mockAPIClient = () => ({
  devboxes: {
    create: jest.fn(),
    list: jest.fn(),
    retrieve: jest.fn(),
    suspend: jest.fn(),
    resume: jest.fn(),
    shutdown: jest.fn(),
    execute: jest.fn(),
    executeAsync: jest.fn(),
    executions: {
      retrieve: jest.fn()
    },
    logs: {
      list: jest.fn()
    },
    readFileContents: jest.fn(),
    writeFileContents: jest.fn(),
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    createSSHKey: jest.fn(),
    snapshotDiskAsync: jest.fn(),
    diskSnapshots: {
      queryStatus: jest.fn(),
      list: jest.fn()
    }
  },
  blueprints: {
    create: jest.fn(),
    list: jest.fn(),
    retrieve: jest.fn(),
    preview: jest.fn(),
    logs: jest.fn()
  },
  objects: {
    create: jest.fn(),
    list: jest.fn(),
    retrieve: jest.fn(),
    download: jest.fn(),
    upload: jest.fn(),
    delete: jest.fn(),
    complete: jest.fn()
  }
});

export const mockSSHKey = () => ({
  ssh_private_key: '-----BEGIN PRIVATE KEY-----\ntest-key-content\n-----END PRIVATE KEY-----',
  url: 'test-host.example.com'
});

export const mockLogEntry = (overrides = {}) => ({
  timestamp_ms: 1710000000000,
  source: 'entrypoint',
  cmd: 'echo test',
  message: 'test message',
  exit_code: 0,
  ...overrides
});

export const mockExecution = (overrides = {}) => ({
  id: 'exec-test-id',
  status: 'completed',
  command: 'echo hello',
  created_at: '2024-01-01T00:00:00Z',
  model_dump_json: jest.fn().mockReturnValue(JSON.stringify({
    id: 'exec-test-id',
    status: 'completed',
    command: 'echo hello'
  })),
  ...overrides
});


