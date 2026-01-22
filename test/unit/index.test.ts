/**
 * Unit tests for index.ts (exported API functions)
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
  env: {
    requires: {
      watch: {
        blockfrostApiKey: 'test-key',
        network: 'preprod',
      },
    },
  },
};

jest.mock('@sap/cds', () => ({
  default: mockCds,
  ...mockCds,
}));

const mockConfig = {
  get: jest.fn<any>(),
  initialize: jest.fn<any>(),
};

const mockWatcher = {
  setup: jest.fn<any>(),
  start: jest.fn<any>(),
  stop: jest.fn<any>(),
  startAddressPolling: jest.fn<any>(),
  startTransactionPolling: jest.fn<any>(),
  stopAddressPolling: jest.fn<any>(),
  stopTransactionPolling: jest.fn<any>(),
  getStatus: jest.fn<any>(),
};

jest.mock('../../src/config', () => mockConfig);
jest.mock('../../src/watcher', () => mockWatcher);

import * as indexModule from '../../src/index';

describe('Index Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig.get.mockReturnValue({
      blockfrostApiKey: 'test-key',
      network: 'preprod',
      autoStart: false,
    });

    mockWatcher.setup.mockResolvedValue(true);
    mockWatcher.start.mockResolvedValue(undefined);
    mockWatcher.stop.mockResolvedValue(undefined);
    mockWatcher.getStatus.mockReturnValue({
      isRunning: false,
      addressPolling: false,
      transactionPolling: false,
      config: mockConfig.get(),
    });
  });

  describe('initialize()', () => {
    it('should initialize the plugin successfully', async () => {
      await indexModule.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing Cardano Watcher')
      );
      expect(mockConfig.initialize).toHaveBeenCalled();
      expect(mockWatcher.setup).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await indexModule.initialize();
      jest.clearAllMocks();

      await indexModule.initialize();

      expect(mockConfig.initialize).not.toHaveBeenCalled();
      expect(mockWatcher.setup).not.toHaveBeenCalled();
    });
  });

  describe('watcher control methods', () => {
    beforeEach(async () => {
      await indexModule.initialize();
      jest.clearAllMocks();
    });

    it('should delegate start/stop to watcher', async () => {
      await indexModule.start();
      expect(mockWatcher.start).toHaveBeenCalled();

      await indexModule.stop();
      expect(mockWatcher.stop).toHaveBeenCalled();
    });

    it('should delegate polling control to watcher', async () => {
      await indexModule.startAddressPolling();
      expect(mockWatcher.startAddressPolling).toHaveBeenCalled();

      await indexModule.startTransactionPolling();
      expect(mockWatcher.startTransactionPolling).toHaveBeenCalled();

      await indexModule.stopAddressPolling();
      expect(mockWatcher.stopAddressPolling).toHaveBeenCalled();

      await indexModule.stopTransactionPolling();
      expect(mockWatcher.stopTransactionPolling).toHaveBeenCalled();
    });

    it('should propagate errors from watcher', async () => {
      mockWatcher.start.mockRejectedValueOnce(new Error('Start failed'));
      await expect(indexModule.start()).rejects.toThrow('Start failed');

      mockWatcher.stop.mockRejectedValueOnce(new Error('Stop failed'));
      await expect(indexModule.stop()).rejects.toThrow('Stop failed');
    });
  });

  describe('getStatus()', () => {
    beforeEach(async () => {
      await indexModule.initialize();
      jest.clearAllMocks();
    });

    it('should return status from watcher', () => {
      const status = indexModule.getStatus();

      expect(mockWatcher.getStatus).toHaveBeenCalled();
      expect(status).toEqual({
        isRunning: false,
        addressPolling: false,
        transactionPolling: false,
        config: expect.any(Object),
      });
    });

    it('should reflect running state', () => {
      mockWatcher.getStatus.mockReturnValue({
        isRunning: true,
        addressPolling: true,
        transactionPolling: true,
        config: mockConfig.get(),
      });

      const status = indexModule.getStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe('getConfig()', () => {
    beforeEach(async () => {
      await indexModule.initialize();
      jest.clearAllMocks();
    });

    it('should return current configuration', () => {
      const config = indexModule.getConfig();

      expect(mockConfig.get).toHaveBeenCalled();
      expect(config).toEqual(
        expect.objectContaining({
          blockfrostApiKey: 'test-key',
          network: 'preprod',
        })
      );
    });
  });

  describe('default export', () => {
    it('should export all functions', () => {
      expect(indexModule.default.initialize).toBeDefined();
      expect(indexModule.default.start).toBeDefined();
      expect(indexModule.default.stop).toBeDefined();
      expect(indexModule.default.getStatus).toBeDefined();
      expect(indexModule.default.config).toBeDefined();
    });
  });
});
