import { jest } from '@jest/globals';
import { mockObject, mockAPIClient } from '../../../fixtures/mocks';
import { createMockCommandOptions } from '../../../helpers';

// Mock the client and executor
jest.mock('../../../../../src/utils/client', () => ({
  getClient: jest.fn()
}));

jest.mock('../../../../../src/utils/CommandExecutor', () => ({
  createExecutor: jest.fn()
}));

describe('Object Commands', () => {
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

  describe('listObjects', () => {
    it('should list objects with default parameters', async () => {
      const mockObjects = {
        objects: [
          mockObject({ id: 'obj-1', name: 'file1.txt' }),
          mockObject({ id: 'obj-2', name: 'file2.txt' })
        ]
      };
      mockClient.objects.list.mockResolvedValue(mockObjects);

      const { listObjects } = await import('../../../../../src/commands/object/list');
      
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

      const { listObjects } = await import('../../../../../src/commands/object/list');
      
      await listObjects({
        ...createMockCommandOptions(),
        limit: 10,
        name: 'test',
        contentType: 'text/plain',
        state: 'READ_ONLY',
        search: 'test query',
        public: true
      });

      expect(mockClient.objects.list).toHaveBeenCalledWith({
        limit: 10,
        name: 'test',
        content_type: 'text/plain',
        state: 'READ_ONLY',
        search: 'test query',
        public: true
      });
    });
  });

  describe('getObject', () => {
    it('should retrieve object details', async () => {
      const mockObjectData = mockObject();
      mockClient.objects.retrieve.mockResolvedValue(mockObjectData);

      const { getObject } = await import('../../../../../src/commands/object/get');
      
      await getObject('obj-test-id', createMockCommandOptions());

      expect(mockClient.objects.retrieve).toHaveBeenCalledWith('obj-test-id');
      expect(mockExecutor.executeAction).toHaveBeenCalled();
    });

    it('should handle object not found', async () => {
      mockClient.objects.retrieve.mockRejectedValue(new Error('Object not found'));

      const { getObject } = await import('../../../../../src/commands/object/get');
      
      await expect(getObject('nonexistent-id', createMockCommandOptions()))
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

      const { downloadObject } = await import('../../../../../src/commands/object/download');
      
      await downloadObject('obj-test-id', {
        ...createMockCommandOptions(),
        outputPath: '/path/to/output.txt',
        durationSeconds: 3600
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
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
      });

      const { downloadObject } = await import('../../../../../src/commands/object/download');
      
      await downloadObject('obj-test-id', {
        ...createMockCommandOptions(),
        outputPath: '/path/to/output.txt'
      });

      expect(mockClient.objects.download).toHaveBeenCalledWith('obj-test-id', {
        duration_seconds: 3600
      });
    });

    it('should handle download failure', async () => {
      mockClient.objects.download.mockRejectedValue(new Error('Download failed'));

      const { downloadObject } = await import('../../../../../src/commands/object/download');
      
      await expect(downloadObject('obj-test-id', {
        ...createMockCommandOptions(),
        outputPath: '/path/to/output.txt'
      })).rejects.toThrow('Download failed');
    });
  });

  describe('uploadObject', () => {
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

      const { uploadObject } = await import('../../../../../src/commands/object/upload');
      
      await uploadObject({
        ...createMockCommandOptions(),
        filePath: '/path/to/file.txt',
        name: 'test-object',
        contentType: 'text/plain',
        public: false
      });

      expect(mockClient.objects.create).toHaveBeenCalledWith({
        name: 'test-object',
        content_type: 'text/plain',
        public: false
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

      const { uploadObject } = await import('../../../../../src/commands/object/upload');
      
      await uploadObject({
        ...createMockCommandOptions(),
        filePath: '/path/to/file.json',
        name: 'test-object'
      });

      expect(mockClient.objects.create).toHaveBeenCalledWith({
        name: 'test-object',
        content_type: 'application/json',
        public: false
      });
    });

    it('should handle file not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { uploadObject } = await import('../../../../../src/commands/object/upload');
      
      await expect(uploadObject({
        ...createMockCommandOptions(),
        filePath: '/nonexistent/file.txt',
        name: 'test-object'
      })).rejects.toThrow('File /nonexistent/file.txt does not exist');
    });

    it('should handle upload failure', async () => {
      mockClient.objects.create.mockRejectedValue(new Error('Upload failed'));

      const { uploadObject } = await import('../../../../../src/commands/object/upload');
      
      await expect(uploadObject({
        ...createMockCommandOptions(),
        filePath: '/path/to/file.txt',
        name: 'test-object'
      })).rejects.toThrow('Upload failed');
    });
  });

  describe('deleteObject', () => {
    it('should delete object', async () => {
      const mockDeletedObject = mockObject({ state: 'DELETED' });
      mockClient.objects.delete.mockResolvedValue(mockDeletedObject);

      const { deleteObject } = await import('../../../../../src/commands/object/delete');
      
      await deleteObject({
        ...createMockCommandOptions(),
        id: 'obj-test-id'
      });

      expect(mockClient.objects.delete).toHaveBeenCalledWith('obj-test-id');
    });

    it('should handle delete failure', async () => {
      mockClient.objects.delete.mockRejectedValue(new Error('Delete failed'));

      const { deleteObject } = await import('../../../../../src/commands/object/delete');
      
      await expect(deleteObject({
        ...createMockCommandOptions(),
        id: 'obj-test-id'
      })).rejects.toThrow('Delete failed');
    });
  });

  describe('Content Type Detection', () => {
    it('should detect common content types', async () => {
      const testCases = [
        { file: 'test.txt', expected: 'text/plain' },
        { file: 'test.json', expected: 'application/json' },
        { file: 'test.html', expected: 'text/html' },
        { file: 'test.css', expected: 'text/css' },
        { file: 'test.js', expected: 'application/javascript' },
        { file: 'test.png', expected: 'image/png' },
        { file: 'test.jpg', expected: 'image/jpeg' },
        { file: 'test.pdf', expected: 'application/pdf' },
        { file: 'test.zip', expected: 'application/zip' },
        { file: 'test.tar.gz', expected: 'application/gzip' }
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

        const { uploadObject } = await import('../../../../../src/commands/object/upload');
        
        await uploadObject({
          ...createMockCommandOptions(),
          filePath: `/path/to/${testCase.file}`,
          name: 'test-object'
        });

        expect(mockClient.objects.create).toHaveBeenCalledWith({
          name: 'test-object',
          content_type: testCase.expected,
          public: false
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

        const { getObject } = await import('../../../../../src/commands/object/get');
        
        await getObject('obj-test-id', createMockCommandOptions());

        expect(mockClient.objects.retrieve).toHaveBeenCalledWith('obj-test-id');
      }
    });
  });
});


