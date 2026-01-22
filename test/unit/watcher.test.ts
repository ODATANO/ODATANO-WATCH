/**
 * Unit tests for watcher.ts (blockchain watcher functionality)
 */
import { jest } from '@jest/globals';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock transaction operations
const mockTx = {
  run: jest.fn<any>(),
};

const mockDb = {
  tx: jest.fn<any>(async (callback: (tx: any) => Promise<any>) => await callback(mockTx)),
};

const mockCds = {
  log: jest.fn(() => mockLogger),
  ql: {
    SELECT: {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    },
    INSERT: {
      into: jest.fn().mockReturnThis(),
      entries: jest.fn().mockReturnThis(),
    },
    UPDATE: {
      entity: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    },
  },
  db: mockDb,
  emit: jest.fn<any>(),
};

jest.mock('@sap/cds', () => ({
  default: mockCds,
  ...mockCds,
}));

// Mock config module
const mockConfig = {
  get: jest.fn<any>(),
};

jest.mock('../../src/config', () => mockConfig);

// Mock blockfrost module
const mockBlockfrost = {
  initializeClient: jest.fn<any>(),
  isAvailable: jest.fn<any>(),
  fetchAddressTransactions: jest.fn<any>(),
  getTransaction: jest.fn<any>(),
};

jest.mock('../../src/blockfrost', () => mockBlockfrost);

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
}));

// Import after mocks
import * as watcher from '../../src/watcher';

describe('Watcher Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default config
    mockConfig.get.mockReturnValue({
      blockfrostApiKey: 'test-api-key',
      network: 'preview',
      autoStart: false,
      addressPolling: { enabled: true, interval: 30 },
      transactionPolling: { enabled: true, interval: 60 },
    });

    mockBlockfrost.isAvailable.mockReturnValue(true);
    mockBlockfrost.initializeClient.mockReturnValue({});
    mockBlockfrost.fetchAddressTransactions.mockResolvedValue(null);
    mockBlockfrost.getTransaction.mockResolvedValue(null);
    mockTx.run.mockResolvedValue([]);
    mockCds.emit.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    jest.useRealTimers();
    // Ensure watcher is stopped between tests
    await watcher.stop();
    // Also stop individual polling in case they were started directly
    await watcher.stopAddressPolling();
    await watcher.stopTransactionPolling();
  });

  describe('setup()', () => {
    it('should initialize Blockfrost client when API key is present', async () => {
      const result = await watcher.setup();

      expect(result).toBe(true);
      expect(mockBlockfrost.initializeClient).toHaveBeenCalledWith(
        expect.objectContaining({
          blockfrostApiKey: 'test-api-key',
          network: 'preview',
        })
      );
    });

    it('should return false when no API key is configured', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: null,
        network: 'preview',
        autoStart: false,
      });

      const result = await watcher.setup();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No Blockfrost API key found in configuration'
      );
    });

    it('should return false when Blockfrost initialization fails', async () => {
      mockBlockfrost.initializeClient.mockImplementation(() => {
        throw new Error('Init failed');
      });

      const result = await watcher.setup();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize Blockfrost:',
        expect.any(Error)
      );
    });

    it('should auto-start when autoStart is true', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        autoStart: true,
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.setup();

      expect(mockLogger.info).toHaveBeenCalledWith('Auto-starting Cardano Watcher...');
    });
  });

  describe('start()', () => {
    beforeEach(async () => {
      await watcher.setup();
    });

    it('should start the watcher', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting Cardano Watcher')
      );
    });

    it('should warn if already running', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.start();
      await watcher.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('Watcher is already running');
    });

    it('should start address polling when enabled', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: true, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.start();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting address polling')
      );
    });

    it('should start transaction polling when enabled', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: true, interval: 60 },
      });

      await watcher.start();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting transaction polling')
      );
    });
  });

  describe('stop()', () => {
    it('should stop the watcher', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.setup();
      await watcher.start();
      await watcher.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Cardano Watcher stopped');
    });

    it('should do nothing if not running', async () => {
      await watcher.stop();

      // No error should be thrown, and stop log should not appear
      // (since it was never started)
    });
  });

  describe('startAddressPolling()', () => {
    beforeEach(async () => {
      await watcher.setup();
    });

    it('should start polling with configured interval', async () => {
      await watcher.startAddressPolling();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting address polling')
      );
    });

    it('should not start if already active', async () => {
      await watcher.startAddressPolling();
      jest.clearAllMocks();
      await watcher.startAddressPolling();

      // Should not log "Starting" again
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Starting address polling')
      );
    });

    it('should run initial poll immediately', async () => {
      mockTx.run.mockResolvedValue([]);

      await watcher.startAddressPolling();

      // Database should be queried for watched addresses
      expect(mockTx.run).toHaveBeenCalled();
    });
  });

  describe('stopAddressPolling()', () => {
    it('should stop address polling', async () => {
      await watcher.setup();
      await watcher.startAddressPolling();
      await watcher.stopAddressPolling();

      expect(mockLogger.debug).toHaveBeenCalledWith('Stopping address polling...');
    });

    it('should do nothing if not active', async () => {
      await watcher.stopAddressPolling();

      // No error should occur
    });
  });

  describe('startTransactionPolling()', () => {
    beforeEach(async () => {
      await watcher.setup();
    });

    it('should start polling with configured interval', async () => {
      await watcher.startTransactionPolling();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting transaction polling')
      );
    });

    it('should not start if already active', async () => {
      await watcher.startTransactionPolling();
      jest.clearAllMocks();
      await watcher.startTransactionPolling();

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Starting transaction polling')
      );
    });
  });

  describe('stopTransactionPolling()', () => {
    it('should stop transaction polling', async () => {
      await watcher.setup();
      await watcher.startTransactionPolling();
      await watcher.stopTransactionPolling();

      expect(mockLogger.debug).toHaveBeenCalledWith('Stopping transaction polling...');
    });

    it('should do nothing if not active', async () => {
      await watcher.stopTransactionPolling();

      // No error should occur
    });
  });

  describe('getStatus()', () => {
    it('should return current status', async () => {
      const status = watcher.getStatus();

      expect(status).toEqual({
        isRunning: expect.any(Boolean),
        addressPolling: expect.any(Boolean),
        transactionPolling: expect.any(Boolean),
        config: expect.any(Object),
      });
    });

    it('should reflect running state after start', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.setup();
      await watcher.start();

      const status = watcher.getStatus();

      expect(status.isRunning).toBe(true);
    });

    it('should reflect stopped state after stop', async () => {
      mockConfig.get.mockReturnValue({
        blockfrostApiKey: 'test-key',
        network: 'preview',
        addressPolling: { enabled: false, interval: 30 },
        transactionPolling: { enabled: false, interval: 60 },
      });

      await watcher.setup();
      await watcher.start();
      await watcher.stop();

      const status = watcher.getStatus();

      expect(status.isRunning).toBe(false);
    });
  });

  describe('Address Polling Logic', () => {
    beforeEach(async () => {
      await watcher.setup();
    });

    it('should log when no watched addresses found', async () => {
      mockTx.run.mockResolvedValue([]);

      await watcher.startAddressPolling();

      expect(mockLogger.debug).toHaveBeenCalledWith('No active watched addresses found');
    });

    it('should process watched addresses', async () => {
      mockTx.run
        .mockResolvedValueOnce([
          { address: 'addr_test1abc', lastCheckedBlock: 1000, active: true },
        ])
        .mockResolvedValue(undefined);

      mockBlockfrost.fetchAddressTransactions.mockResolvedValue([
        {
          txHash: 'tx123',
          blockHeight: 1001,
          blockHash: 'block123',
        },
      ]);

      await watcher.startAddressPolling();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 new transactions')
      );
    });

    it('should handle address with missing fields gracefully', async () => {
      mockTx.run.mockResolvedValueOnce([
        { address: null, lastCheckedBlock: null, active: true },
      ]);

      await watcher.startAddressPolling();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Watched address has no address field'),
        expect.any(Object)
      );
    });

    it('should emit cardano.newTransactions event', async () => {
      mockTx.run
        .mockResolvedValueOnce([
          { address: 'addr_test1xyz', lastCheckedBlock: 500, active: true },
        ])
        .mockResolvedValue(undefined);

      mockBlockfrost.fetchAddressTransactions.mockResolvedValue([
        { txHash: 'tx1', blockHeight: 501, blockHash: 'bh1' },
        { txHash: 'tx2', blockHeight: 502, blockHash: 'bh2' },
      ]);

      await watcher.startAddressPolling();

      expect(mockCds.emit).toHaveBeenCalledWith('cardano.newTransactions', {
        address: 'addr_test1xyz',
        count: 2,
        transactions: ['tx1', 'tx2'],
      });
    });

    it('should handle emit failure gracefully', async () => {
      mockTx.run
        .mockResolvedValueOnce([
          { address: 'addr_test1', lastCheckedBlock: 100, active: true },
        ])
        .mockResolvedValue(undefined);

      mockBlockfrost.fetchAddressTransactions.mockResolvedValue([
        { txHash: 'tx1', blockHeight: 101, blockHash: 'bh1' },
      ]);

      mockCds.emit.mockRejectedValueOnce(new Error('Emit failed'));

      await watcher.startAddressPolling();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to emit newTransactions event:',
        expect.any(Error)
      );
    });
  });

  describe('Transaction Polling Logic', () => {
    beforeEach(async () => {
      await watcher.setup();
    });

    it('should log when no active submissions found', async () => {
      mockTx.run.mockResolvedValue([]);

      await watcher.startTransactionPolling();

      expect(mockLogger.debug).toHaveBeenCalledWith('No active transaction submissions found');
    });

    it('should process transaction submissions', async () => {
      mockTx.run
        .mockResolvedValueOnce([
          { txHash: 'submittedTx1', active: true },
        ])
        .mockResolvedValue(undefined);

      mockBlockfrost.getTransaction.mockResolvedValue({
        txHash: 'submittedTx1',
        blockHeight: 2000,
        blockHash: 'blockHash123',
      });

      await watcher.startTransactionPolling();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Transaction submittedTx1 found on chain')
      );
    });

    it('should handle submission with missing txHash', async () => {
      mockTx.run.mockResolvedValueOnce([
        { txHash: null, active: true },
      ]);

      await watcher.startTransactionPolling();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Transaction submission has no txHash'),
        expect.any(Object)
      );
    });

    it('should not create event when transaction not found', async () => {
      mockTx.run.mockResolvedValueOnce([
        { txHash: 'pendingTx', active: true },
      ]);

      mockBlockfrost.getTransaction.mockResolvedValue(null);

      await watcher.startTransactionPolling();

      // Transaction not found, so no "found on chain" log
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('found on chain')
      );
    });
  });

  describe('Blockfrost unavailable', () => {
    it('should return null when Blockfrost is not available', async () => {
      mockBlockfrost.isAvailable.mockReturnValue(false);

      mockTx.run.mockResolvedValueOnce([
        { address: 'addr_test1', lastCheckedBlock: 100, active: true },
      ]);

      await watcher.setup();
      await watcher.startAddressPolling();

      // No transactions should be fetched
      expect(mockBlockfrost.fetchAddressTransactions).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await watcher.setup();
    });

    it('should handle errors in address polling gracefully', async () => {
      mockTx.run.mockRejectedValueOnce(new Error('Database error'));

      await watcher.startAddressPolling();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in initial address poll:',
        expect.any(Error)
      );
    });

    it('should handle errors in transaction polling gracefully', async () => {
      mockTx.run.mockRejectedValueOnce(new Error('Database error'));

      await watcher.startTransactionPolling();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in initial transaction poll:',
        expect.any(Error)
      );
    });

    it('should handle Blockfrost fetch errors', async () => {
      mockTx.run.mockResolvedValueOnce([
        { address: 'addr_test1', lastCheckedBlock: 100, active: true },
      ]);

      mockBlockfrost.fetchAddressTransactions.mockRejectedValue(
        new Error('Blockfrost API error')
      );

      await watcher.startAddressPolling();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing address'),
        expect.any(Error)
      );
    });
  });
});
