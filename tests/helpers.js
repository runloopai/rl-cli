import { jest } from '@jest/globals';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
export const createTempFile = (content, extension = '.txt') => {
    const tempDir = tmpdir();
    const tempFile = join(tempDir, `test-${Date.now()}${extension}`);
    writeFileSync(tempFile, content);
    return tempFile;
};
export const createTempDir = () => {
    const tempDir = join(tmpdir(), `test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    return tempDir;
};
export const mockSubprocess = () => {
    const mockRun = jest.fn();
    const mockSpawn = jest.fn();
    // Mock successful execution
    mockRun.mockResolvedValue({
        stdout: 'success',
        stderr: '',
        exitCode: 0
    });
    mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
    });
    return { mockRun, mockSpawn };
};
export const mockFileSystem = () => {
    const mockExists = jest.fn();
    const mockMkdir = jest.fn();
    const mockChmod = jest.fn();
    const mockFsync = jest.fn();
    mockExists.mockReturnValue(true);
    mockMkdir.mockImplementation(() => { });
    mockChmod.mockImplementation(() => { });
    mockFsync.mockImplementation(() => { });
    return { mockExists, mockMkdir, mockChmod, mockFsync };
};
export const mockNetwork = () => {
    const mockFetch = jest.fn();
    // Set up default mock response - using any to avoid typing issues
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn(),
        text: jest.fn(),
        arrayBuffer: jest.fn()
    });
    return { mockFetch };
};
export const waitFor = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
export const expectToHaveBeenCalledWithAPI = (mockFn, expectedCall) => {
    expect(mockFn).toHaveBeenCalledWith(expect.objectContaining(expectedCall));
};
export const createMockCommandOptions = (overrides = {}) => ({
    output: 'interactive',
    ...overrides
});
