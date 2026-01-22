/**
 * Unit tests for backend-request-handler.ts
 */
import { jest } from '@jest/globals';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockCds = {
  log: jest.fn(() => mockLogger),
  tx: jest.fn((_req: any) => ({ run: jest.fn() })),
};

jest.mock('@sap/cds', () => ({
  default: mockCds,
  ...mockCds,
}));

// Import after mocks
import { handleBackendRequest, handleRequest } from '../../srv/utils/backend-request-handler';
import { BackendError } from '../../srv/utils/errors';

describe('Backend Request Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBackendRequest', () => {
    it('should execute function and return result', async () => {
      const mockFn = jest.fn(async () => 'success');

      const result = await handleBackendRequest(mockFn, 'TestBackend');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should normalize errors from backend', async () => {
      const mockFn = jest.fn(async () => {
        throw new Error('Backend failure');
      });

      await expect(
        handleBackendRequest(mockFn, 'TestBackend')
      ).rejects.toThrow();
    });

    it('should preserve BackendError instances', async () => {
      const backendError = new BackendError(
        'Custom error',
        404,
        'WATCHER_NOT_FOUND',
        'TestBackend'
      );
      const mockFn = jest.fn(async () => {
        throw backendError;
      });

      await expect(
        handleBackendRequest(mockFn, 'TestBackend')
      ).rejects.toThrow(BackendError);
    });
  });

  describe('handleRequest', () => {
    let mockReq: any;
    let mockDb: any;

    beforeEach(() => {
      mockDb = { run: jest.fn() };
      mockCds.tx.mockReturnValue(mockDb);
      
      mockReq = {
        target: { name: 'TestAction' },
        event: 'testEvent',
        reject: jest.fn(),
      };
    });

    it('should execute handler and return result', async () => {
      const handler = jest.fn(async (_db: any) => ({ success: true }));

      const result = await handleRequest(mockReq, handler);

      expect(result).toEqual({ success: true });
      expect(handler).toHaveBeenCalledWith(mockDb);
    });

    it('should handle BackendError and map to request rejection', async () => {
      const backendError = new BackendError(
        'Resource not found',
        404,
        'WATCHER_NOT_FOUND',
        'Blockfrost',
        false,
        'address'
      );

      const handler = jest.fn(async () => {
        throw backendError;
      });

      await handleRequest(mockReq, handler);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: backendError },
        '[Service] TestAction error'
      );
      expect(mockReq.reject).toHaveBeenCalledWith(
        404,
        'WATCHER_NOT_FOUND: TestAction - Resource not found',
        'address'
      );
    });

    it('should handle unexpected errors and return 500', async () => {
      const unexpectedError = new Error('Unexpected database error');

      const handler = jest.fn(async () => {
        throw unexpectedError;
      });

      await handleRequest(mockReq, handler);

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: unexpectedError },
        '[Service] TestAction error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: unexpectedError },
        'Unexpected error in TestAction'
      );
      expect(mockReq.reject).toHaveBeenCalledWith(
        500,
        'Internal error: Unexpected database error'
      );
    });

    it('should use event name if target name is not available', async () => {
      mockReq.target = null;
      const handler = jest.fn(async () => {
        throw new Error('Test error');
      });

      await handleRequest(mockReq, handler);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        '[Service] testEvent error'
      );
    });
  });
});
