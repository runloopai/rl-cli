import { jest } from '@jest/globals';
import { mockObject, mockAPIClient } from '../../../fixtures/mocks';
import { createMockCommandOptions, mockNetwork, mockFileSystem } from '../../../helpers';
describe('Object Commands', () => {
    let mockClient;
    let mockExecutor;
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = mockAPIClient();
        mockExecutor = {
            getClient: jest.fn().mockReturnValue(mockClient),
            executeAction: jest.fn().mockImplementation(async (fetchData, renderUI) => {
                const result = await fetchData();
                return result;
            }),
            executeList: jest.fn().mockImplementation(async (fetchData, renderUI, limit) => {
                const items = await fetchData();
                return items;
            })
        };
        // Mock the modules before each test
        jest.doMock('@/utils/client', () => ({
            getClient: () => mockClient
        }));
        jest.doMock('@/utils/CommandExecutor', () => ({
            createExecutor: () => mockExecutor
        }));
    });
    describe('listObjects', () => {
        it('should list objects with default parameters', async () => {
            const mockObjects = {
                objects: [
                    mockObject({ id: 'obj-1', name: 'file1.txt' }),
                    mockObject({ id: 'obj-2', name: 'file2.txt' })
                ]
            };
            mockClient.objects.list.mockResolvedValue(mockObjects);
            // Clear module cache and import dynamically
            jest.resetModules();
            // Re-setup mocks after clearing modules
            jest.doMock('@/utils/client', () => ({
                getClient: () => mockClient
            }));
            jest.doMock('@/utils/CommandExecutor', () => ({
                createExecutor: () => mockExecutor
            }));
            const { listObjects } = await import('@/commands/object/list');
            await listObjects(createMockCommandOptions());
            expect(mockClient.objects.list).toHaveBeenCalledWith({
                limit: undefined,
                name: undefined,
                content_type: undefined,
                state: undefined,
                search: undefined,
                public: undefined
            });
        });
        it('should list objects with filters', async () => {
            const mockObjects = {
                objects: [mockObject({ name: 'test.txt', content_type: 'text/plain' })]
            };
            mockClient.objects.list.mockResolvedValue(mockObjects);
            mockClient.objects.listPublic.mockResolvedValue(mockObjects);
            // Clear module cache and import dynamically
            jest.resetModules();
            // Re-setup mocks after clearing modules
            jest.doMock('@/utils/client', () => ({
                getClient: () => mockClient
            }));
            jest.doMock('@/utils/CommandExecutor', () => ({
                createExecutor: () => mockExecutor
            }));
            const { listObjects } = await import('@/commands/object/list');
            await listObjects({
                ...createMockCommandOptions(),
                limit: 10,
                name: 'test',
                contentType: 'text/plain',
                state: 'READ_ONLY',
                search: 'test query',
                public: true
            });
            expect(mockClient.objects.listPublic).toHaveBeenCalledWith({
                limit: 10,
                name: 'test',
                contentType: 'text/plain',
                state: 'READ_ONLY',
                search: 'test query',
                isPublic: true
            });
        });
    });
    describe('getObject', () => {
        it('should retrieve object details', async () => {
            const mockObjectData = mockObject();
            mockClient.objects.retrieve.mockResolvedValue(mockObjectData);
            // Clear module cache and import dynamically
            jest.resetModules();
            // Re-setup mocks after clearing modules
            jest.doMock('@/utils/client', () => ({
                getClient: () => mockClient
            }));
            jest.doMock('@/utils/CommandExecutor', () => ({
                createExecutor: () => mockExecutor
            }));
            const { getObject } = await import('@/commands/object/get');
            await getObject({ id: 'obj-test-id', ...createMockCommandOptions() });
            expect(mockClient.objects.retrieve).toHaveBeenCalledWith('obj-test-id');
            expect(mockExecutor.executeAction).toHaveBeenCalled();
        });
        it('should handle object not found', async () => {
            mockClient.objects.retrieve.mockRejectedValue(new Error('Object not found'));
            // Clear module cache and import dynamically
            jest.resetModules();
            // Re-setup mocks after clearing modules
            jest.doMock('@/utils/client', () => ({
                getClient: () => mockClient
            }));
            jest.doMock('@/utils/CommandExecutor', () => ({
                createExecutor: () => mockExecutor
            }));
            const { getObject } = await import('@/commands/object/get');
            await expect(getObject({ id: 'nonexistent-id', ...createMockCommandOptions() }))
                .rejects.toThrow('Object not found');
        });
    });
    describe('downloadObject', () => {
        const { mockFetch } = mockNetwork();
        beforeEach(() => {
            jest.doMock('node-fetch', () => mockFetch);
        });
        it('should download object with presigned URL', async () => {
            const mockDownloadResponse = {
                download_url: 'https://example.com/download/obj-test-id'
            };
            mockClient.objects.download.mockResolvedValue(mockDownloadResponse);
            mockFetch.mockResolvedValue({
                ok: true,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
            });
            // Clear module cache and import dynamically
            jest.resetModules();
            // Re-setup mocks after clearing modules
            jest.doMock('@/utils/client', () => ({
                getClient: () => mockClient
            }));
            jest.doMock('@/utils/CommandExecutor', () => ({
                createExecutor: () => mockExecutor
            }));
            // Mock global fetch for download requests
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
            });
            // Mock fs/promises for file operations
            jest.doMock('fs/promises', () => ({
                writeFile: jest.fn().mockResolvedValue(undefined)
            }));
            const { downloadObject } = await import('@/commands/object/download');
            await downloadObject({
                id: 'obj-test-id',
                path: '/path/to/output.txt',
                durationSeconds: 3600,
                ...createMockCommandOptions()
            });
            expect(mockClient.objects.download).toHaveBeenCalledWith('obj-test-id', {
                duration_seconds: 3600
            });
        });
        it('should download object with default duration', async () => {
            const mockDownloadResponse = {
                download_url: 'https://example.com/download/obj-test-id'
            };
            mockClient.objects.download.mockResolvedValue(mockDownloadResponse);
            // Clear module cache and import dynamically
            jest.resetModules();
            // Re-setup mocks after clearing modules
            jest.doMock('@/utils/client', () => ({
                getClient: () => mockClient
            }));
            jest.doMock('@/utils/CommandExecutor', () => ({
                createExecutor: () => mockExecutor
            }));
            // Mock global fetch for download requests
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
            });
            // Mock fs/promises for file operations
            jest.doMock('fs/promises', () => ({
                writeFile: jest.fn().mockResolvedValue(undefined)
            }));
            const { downloadObject } = await import('@/commands/object/download');
            await downloadObject({
                id: 'obj-test-id',
                path: '/path/to/output.txt',
                ...createMockCommandOptions()
            });
            expect(mockClient.objects.download).toHaveBeenCalledWith('obj-test-id', {
                duration_seconds: 3600
            });
        });
        it('should handle download failure', async () => {
            mockClient.objects.download.mockRejectedValue(new Error('Download failed'));
            const { downloadObject } = await import('@/commands/object/download');
            await expect(downloadObject('obj-test-id', {
                ...createMockCommandOptions(),
                outputPath: '/path/to/output.txt'
            })).rejects.toThrow('Download failed');
        });
    });
    describe('uploadObject', () => {
        const { mockExists, mockMkdir, mockChmod, mockFsync } = mockFileSystem();
        const mockFs = {
            existsSync: jest.fn(),
            statSync: jest.fn(),
            readFileSync: jest.fn()
        };
        beforeEach(() => {
            jest.doMock('fs', () => mockFs);
        });
        it('should upload file as object', async () => {
            const mockCreateResponse = {
                id: 'obj-test-id',
                upload_url: 'https://example.com/upload',
                fields: { key: 'value' }
            };
            const mockCompleteResponse = mockObject();
            mockClient.objects.create.mockResolvedValue(mockCreateResponse);
            mockClient.objects.complete.mockResolvedValue(mockCompleteResponse);
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ size: 1024 });
            mockFs.readFileSync.mockReturnValue('file content');
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
            jest.doMock('fs/promises', () => ({
                stat: jest.fn().mockResolvedValue({ size: 1024 }),
                readFile: jest.fn().mockResolvedValue(Buffer.from('file content'))
            }));
            // Mock global fetch for upload requests
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200
            });
            const { uploadObject } = await import('@/commands/object/upload');
            await uploadObject({
                ...createMockCommandOptions(),
                path: '/path/to/file.txt',
                name: 'test-object',
                contentType: 'text/plain',
                public: false
            });
            expect(mockClient.objects.create).toHaveBeenCalledWith({
                name: 'test-object',
                content_type: 'text/plain'
            });
            expect(mockClient.objects.complete).toHaveBeenCalledWith('obj-test-id');
        });
        it('should auto-detect content type from file extension', async () => {
            const mockCreateResponse = {
                object_id: 'obj-test-id',
                upload_url: 'https://example.com/upload',
                fields: { key: 'value' }
            };
            const mockCompleteResponse = mockObject();
            mockClient.objects.create.mockResolvedValue(mockCreateResponse);
            mockClient.objects.complete.mockResolvedValue(mockCompleteResponse);
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({ size: 1024 });
            mockFs.readFileSync.mockReturnValue('file content');
            const { uploadObject } = await import('@/commands/object/upload');
            await uploadObject({
                ...createMockCommandOptions(),
                path: '/path/to/file.json',
                name: 'test-object'
            });
            expect(mockClient.objects.create).toHaveBeenCalledWith({
                name: 'test-object',
                content_type: 'text'
            });
        });
        it('should handle file not found', async () => {
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
            jest.doMock('fs/promises', () => ({
                stat: jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
                readFile: jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'))
            }));
            const { uploadObject } = await import('@/commands/object/upload');
            await expect(uploadObject({
                ...createMockCommandOptions(),
                path: '/nonexistent/file.txt',
                name: 'test-object'
            })).rejects.toThrow('ENOENT: no such file or directory');
        });
        it('should handle upload failure', async () => {
            mockClient.objects.create.mockRejectedValue(new Error('Upload failed'));
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
            jest.doMock('fs/promises', () => ({
                stat: jest.fn().mockResolvedValue({ size: 1024 }),
                readFile: jest.fn().mockResolvedValue(Buffer.from('file content'))
            }));
            const { uploadObject } = await import('@/commands/object/upload');
            await expect(uploadObject({
                ...createMockCommandOptions(),
                path: '/path/to/file.txt',
                name: 'test-object'
            })).rejects.toThrow('Upload failed');
        });
    });
    describe('deleteObject', () => {
        it('should delete object', async () => {
            const mockDeletedObject = mockObject({ state: 'DELETED' });
            mockClient.objects.delete.mockResolvedValue(mockDeletedObject);
            const { deleteObject } = await import('@/commands/object/delete');
            await deleteObject({
                ...createMockCommandOptions(),
                id: 'obj-test-id'
            });
            expect(mockClient.objects.delete).toHaveBeenCalledWith('obj-test-id');
        });
        it('should handle delete failure', async () => {
            mockClient.objects.delete.mockRejectedValue(new Error('Delete failed'));
            const { deleteObject } = await import('@/commands/object/delete');
            await expect(deleteObject({
                ...createMockCommandOptions(),
                id: 'obj-test-id'
            })).rejects.toThrow('Delete failed');
        });
    });
    describe('Content Type Detection', () => {
        const mockFs = {
            existsSync: jest.fn(),
            statSync: jest.fn(),
            readFileSync: jest.fn()
        };
        beforeEach(() => {
            jest.doMock('fs', () => mockFs);
        });
        it('should detect common content types', async () => {
            const testCases = [
                { file: 'test.txt', expected: 'text' },
                { file: 'test.json', expected: 'text' },
                { file: 'test.html', expected: 'text' },
                { file: 'test.css', expected: 'text' },
                { file: 'test.js', expected: 'text' },
                { file: 'test.png', expected: 'unspecified' },
                { file: 'test.jpg', expected: 'unspecified' },
                { file: 'test.pdf', expected: 'unspecified' },
                { file: 'test.zip', expected: 'unspecified' },
                { file: 'test.tar.gz', expected: 'gzip' } // extname returns .gz, not .tar.gz
            ];
            for (const testCase of testCases) {
                const mockCreateResponse = {
                    object_id: 'obj-test-id',
                    upload_url: 'https://example.com/upload',
                    fields: { key: 'value' }
                };
                const mockCompleteResponse = mockObject();
                mockClient.objects.create.mockResolvedValue(mockCreateResponse);
                mockClient.objects.complete.mockResolvedValue(mockCompleteResponse);
                mockFs.existsSync.mockReturnValue(true);
                mockFs.statSync.mockReturnValue({ size: 1024 });
                mockFs.readFileSync.mockReturnValue('file content');
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
                jest.doMock('fs/promises', () => ({
                    stat: jest.fn().mockResolvedValue({ size: 1024 }),
                    readFile: jest.fn().mockResolvedValue(Buffer.from('file content'))
                }));
                // Mock global fetch for upload requests
                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    status: 200
                });
                const { uploadObject } = await import('@/commands/object/upload');
                await uploadObject({
                    ...createMockCommandOptions(),
                    path: `/path/to/${testCase.file}`,
                    name: 'test-object'
                });
                expect(mockClient.objects.create).toHaveBeenCalledWith({
                    name: 'test-object',
                    content_type: testCase.expected
                });
            }
        });
    });
    describe('Object State Management', () => {
        it('should handle different object states', async () => {
            const states = ['READ_ONLY', 'WRITE_ONLY', 'READ_WRITE', 'DELETED'];
            for (const state of states) {
                const mockObjectData = mockObject({ state });
                mockClient.objects.retrieve.mockResolvedValue(mockObjectData);
                // Clear module cache and import dynamically
                jest.resetModules();
                // Re-setup mocks after clearing modules
                jest.doMock('@/utils/client', () => ({
                    getClient: () => mockClient
                }));
                jest.doMock('@/utils/CommandExecutor', () => ({
                    createExecutor: () => mockExecutor
                }));
                const { getObject } = await import('@/commands/object/get');
                await getObject({ id: 'obj-test-id', ...createMockCommandOptions() });
                expect(mockClient.objects.retrieve).toHaveBeenCalledWith('obj-test-id');
            }
        });
    });
});
