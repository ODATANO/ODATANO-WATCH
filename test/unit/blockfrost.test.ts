import { jest } from '@jest/globals';

// Mock the logger
const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

jest.mock('@sap/cds', () => ({
  log: jest.fn(() => mockLogger),
}));

// Mock BlockFrost API
const mockBlockfrostMethods = {
  addressesTransactions: jest.fn<any>(),
  blocksLatest: jest.fn<any>(),
  txs: jest.fn<any>(),
  txsUtxos: jest.fn<any>(),
  addresses: jest.fn<any>(),
};

jest.mock('@blockfrost/blockfrost-js', () => ({
  BlockFrostAPI: jest.fn().mockImplementation(() => mockBlockfrostMethods),
}));

// Import after mocks are set up
import * as blockfrost from '../../src/blockfrost';

describe('Blockfrost Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeClient', () => {
    it('should initialize client with valid config', () => {
      const config = {
        blockfrostApiKey: 'test-api-key-123',
        network: 'preview',
      };

      const client = blockfrost.initializeClient(config);

      expect(client).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should return same client on subsequent calls', () => {
      const config = {
        blockfrostApiKey: 'test-key',
        network: 'mainnet',
      };

      const client1 = blockfrost.initializeClient(config);
      const client2 = blockfrost.initializeClient(config);

      expect(client1).toBe(client2);
    });
  });

  describe('fetchAddressTransactions', () => {
    beforeEach(() => {
      blockfrost.initializeClient({
        blockfrostApiKey: 'test-key',
        network: 'preview',
      });
    });

    it('should return null when no transactions found', async () => {
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([]);

      const result = await blockfrost.fetchAddressTransactions('addr_test1...');

      expect(result).toBeNull();
    });

    it('should fetch and parse transactions successfully', async () => {
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([
        { tx_hash: 'hash1' },
      ]);
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({ height: 1100 });
      mockBlockfrostMethods.txs.mockResolvedValue({
        hash: 'hash1',
        block: 'block-hash',
        block_height: 1000,
        block_time: 1640000000,
        fees: '170000',
        output_amount: [{ unit: 'lovelace', quantity: '5000000' }],
      });
      mockBlockfrostMethods.txsUtxos.mockResolvedValue({
        outputs: [{
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
        }],
      });

      const result = await blockfrost.fetchAddressTransactions('addr_test1...');

      expect(result).toHaveLength(1);
      expect(result![0].txHash).toBe('hash1');
      expect(result![0].amount).toBe(5);
      expect(result![0].fee).toBe(0.17);
      expect(result![0].confirmations).toBe(100);
    });

    it('should filter by fromBlock parameter', async () => {
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([
        { tx_hash: 'hash1' },
        { tx_hash: 'hash2' },
      ]);
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({ height: 1200 });
      mockBlockfrostMethods.txs
        .mockResolvedValueOnce({
          block_height: 900,
          block: 'block1',
          fees: '170000',
          block_time: 1640000000,
        })
        .mockResolvedValueOnce({
          block_height: 1100,
          block: 'block2',
          fees: '170000',
          block_time: 1640001000,
        });
      mockBlockfrostMethods.txsUtxos.mockResolvedValue({
        outputs: [{ amount: [{ unit: 'lovelace', quantity: '1000000' }] }],
      });

      const result = await blockfrost.fetchAddressTransactions('addr_test1...', 1000);

      expect(result).toHaveLength(1);
      expect(result![0].blockHeight).toBe(1100);
    });

    it('should handle individual tx fetch errors gracefully', async () => {
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([
        { tx_hash: 'hash1' },
        { tx_hash: 'hash2' },
      ]);
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({ height: 1000 });
      mockBlockfrostMethods.txs
        .mockRejectedValueOnce(new Error('TX not found'))
        .mockResolvedValueOnce({
          block_height: 950,
          block: 'block2',
          fees: '170000',
          block_time: 1640000000,
        });
      mockBlockfrostMethods.txsUtxos.mockResolvedValue({
        outputs: [{ amount: [{ unit: 'lovelace', quantity: '1000000' }] }],
      });

      const result = await blockfrost.fetchAddressTransactions('addr_test1...');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should handle missing lovelace in amount', async () => {
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([
        { tx_hash: 'hash1' },
      ]);
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({ height: 1100 });
      mockBlockfrostMethods.txs.mockResolvedValue({
        block_height: 1000,
        block: 'block1',
        fees: '170000',
        block_time: 1640000000,
      });
      mockBlockfrostMethods.txsUtxos.mockResolvedValue({
        outputs: [{
          amount: [{ unit: 'other-token', quantity: '100' }],
        }],
      });

      const result = await blockfrost.fetchAddressTransactions('addr_test1...');

      expect(result![0].amount).toBe(0);
    });

    it('should throw error on API failure', async () => {
      mockBlockfrostMethods.addressesTransactions.mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        blockfrost.fetchAddressTransactions('addr_test1...')
      ).rejects.toThrow();
    });
  });

  describe('getLatestBlock', () => {
    beforeEach(() => {
      blockfrost.initializeClient({
        blockfrostApiKey: 'test-key',
        network: 'preview',
      });
    });

    it('should fetch latest block successfully', async () => {
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({
        height: 1000,
        hash: 'block-hash-123',
        time: 1640000000,
        slot: 12345,
      });

      const result = await blockfrost.getLatestBlock();

      expect(result).toEqual({
        height: 1000,
        hash: 'block-hash-123',
        time: 1640000000,
        slot: 12345,
      });
    });

    it('should handle null values in response', async () => {
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({
        height: null,
        hash: 'block-hash',
        time: null,
        slot: null,
      });

      const result = await blockfrost.getLatestBlock();

      expect(result).toEqual({
        height: 0,
        hash: 'block-hash',
        time: 0,
        slot: 0,
      });
    });

    it('should throw error on API failure', async () => {
      mockBlockfrostMethods.blocksLatest.mockRejectedValue(
        new Error('Network error')
      );

      await expect(blockfrost.getLatestBlock()).rejects.toThrow();
    });
  });

  describe('getAddressInfo', () => {
    beforeEach(() => {
      blockfrost.initializeClient({
        blockfrostApiKey: 'test-key',
        network: 'preview',
      });
    });

    it('should fetch address info with transactions', async () => {
      mockBlockfrostMethods.addresses.mockResolvedValue({
        address: 'addr_test1...',
        amount: [{ unit: 'lovelace', quantity: '10000000' }],
        stake_address: 'stake_test1...',
        type: 'shelley',
      });
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([]);

      const result = await blockfrost.getAddressInfo('addr_test1...');

      expect(result).toEqual({
        address: 'addr_test1...',
        balance: 10,
        stakeAddress: 'stake_test1...',
        type: 'shelley',
        transactions: [],
      });
    });

    it('should handle missing lovelace in amount array', async () => {
      mockBlockfrostMethods.addresses.mockResolvedValue({
        address: 'addr_test1...',
        amount: [{ unit: 'other-token', quantity: '100' }],
        stake_address: null,
        type: 'byron',
      });
      mockBlockfrostMethods.addressesTransactions.mockResolvedValue([]);

      const result = await blockfrost.getAddressInfo('addr_test1...');

      expect(result!.balance).toBe(0);
    });

    it('should throw error on API failure', async () => {
      mockBlockfrostMethods.addresses.mockRejectedValue(
        new Error('Address not found')
      );

      await expect(
        blockfrost.getAddressInfo('addr_test1...')
      ).rejects.toThrow();
    });
  });

  describe('getTransaction', () => {
    beforeEach(() => {
      blockfrost.initializeClient({
        blockfrostApiKey: 'test-key',
        network: 'preview',
      });
    });

    it('should fetch transaction info successfully', async () => {
      mockBlockfrostMethods.txs.mockResolvedValue({
        hash: 'tx-hash-123',
        block: 'block-hash',
        block_height: 1000,
        block_time: 1640000000,
        fees: '170000',
        output_amount: [{ unit: 'lovelace', quantity: '5000000' }],
      });
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({ height: 1100 });

      const result = await blockfrost.getTransaction('tx-hash-123');

      expect(result).toEqual({
        txHash: 'tx-hash-123',
        blockHash: 'block-hash',
        blockHeight: 1000,
        amount: 5,
        fee: 0.17,
        confirmations: 100,
        lastSeen: 1640000000,
      });
    });

    it('should return null for transaction not found', async () => {
      mockBlockfrostMethods.txs.mockRejectedValue(new Error('Not found'));

      const result = await blockfrost.getTransaction('non-existent-tx');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle missing lovelace in output amount', async () => {
      mockBlockfrostMethods.txs.mockResolvedValue({
        hash: 'tx-hash',
        block: 'block-hash',
        block_height: 1000,
        block_time: 1640000000,
        fees: '170000',
        output_amount: [{ unit: 'other-asset', quantity: '100' }],
      });
      mockBlockfrostMethods.blocksLatest.mockResolvedValue({ height: 1100 });

      const result = await blockfrost.getTransaction('tx-hash');

      expect(result!.amount).toBe(0);
    });
  });

  describe('isAvailable', () => {
    it('should return true when client is initialized', () => {
      blockfrost.initializeClient({
        blockfrostApiKey: 'test-key',
        network: 'preview',
      });

      expect(blockfrost.isAvailable()).toBe(true);
    });
  });
});
