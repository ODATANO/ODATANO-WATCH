/**
 * Unit tests for backfill.ts (Phase 2 Ogmios backfill orchestration)
 *
 * The backfill module is pure orchestration — DB I/O via cds.db.run / cds.db.tx,
 * blockchain reads via blockfrost/koios, no own state. Everything is mocked.
 */
import { jest } from '@jest/globals';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockTx = {
  run: jest.fn<any>(),
};

const mockDb = {
  run: jest.fn<any>(),
  tx: jest.fn<any>(async (callback: (tx: any) => Promise<any>) => await callback(mockTx)),
};

// Chainable SELECT/INSERT/UPDATE builders — every method returns the same
// object, so the call chain in backfill.ts (`SELECT.one.from(X).where(...)`)
// just resolves to whatever cds.db.run(...) is configured to return.
const chainable: any = {};
chainable.from = jest.fn(() => chainable);
chainable.where = jest.fn(() => chainable);
chainable.into = jest.fn(() => chainable);
chainable.entries = jest.fn(() => chainable);
chainable.entity = jest.fn(() => chainable);
chainable.set = jest.fn(() => chainable);
chainable.orderBy = jest.fn(() => chainable);
chainable.limit = jest.fn(() => chainable);
// `.one` is accessed as a property in `SELECT.one.from(...)`.
Object.defineProperty(chainable, 'one', { get: () => chainable });

const mockCds: any = {
  log: jest.fn(() => mockLogger),
  ql: {
    SELECT: chainable,
    INSERT: chainable,
    UPDATE: chainable,
  },
  db: mockDb,
  emit: jest.fn<any>(),
};

jest.mock('@sap/cds', () => ({
  default: mockCds,
  ...mockCds,
}));

const mockConfig = {
  get: jest.fn<any>(),
};
jest.mock('../../src/config', () => mockConfig);

const mockBlockfrost = {
  isAvailable: jest.fn<any>(),
  getLatestBlock: jest.fn<any>(),
  fetchAddressTransactions: jest.fn<any>(),
  fetchTxUtxos: jest.fn<any>(),
  fetchPolicyAssetEvents: jest.fn<any>(),
  parseAssetFilter: jest.fn<any>(),
  matchesAssetFilter: jest.fn<any>(),
};
jest.mock('../../src/blockfrost', () => mockBlockfrost);

const mockKoios = {
  isAvailable: jest.fn<any>(),
  getAddressesByCredential: jest.fn<any>(),
  getCredentialTxsSince: jest.fn<any>(),
};
jest.mock('../../src/koios', () => mockKoios);

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

// Import AFTER mocks so the module captures the mocked logger / ql.
import * as backfill from '../../src/backfill';

describe('Backfill Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig.get.mockReturnValue({
      network: 'preview',
      policyAssetCap: 100,
    });

    mockBlockfrost.getLatestBlock.mockResolvedValue({ height: 1000 });
    mockBlockfrost.fetchAddressTransactions.mockResolvedValue([]);
    mockBlockfrost.fetchTxUtxos.mockResolvedValue(null);
    mockBlockfrost.fetchPolicyAssetEvents.mockResolvedValue([]);
    mockBlockfrost.parseAssetFilter.mockReturnValue(null);
    mockBlockfrost.matchesAssetFilter.mockReturnValue(true);

    mockKoios.isAvailable.mockReturnValue(true);
    mockKoios.getAddressesByCredential.mockResolvedValue([]);
    mockKoios.getCredentialTxsSince.mockResolvedValue([]);

    mockDb.run.mockResolvedValue(undefined);
    mockTx.run.mockResolvedValue(undefined);
    mockCds.emit.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // backfillAddress
  // -------------------------------------------------------------------------
  describe('backfillAddress', () => {
    const ADDR = 'addr_test1qq';

    it('skips when no chainSync cursor row exists', async () => {
      // cursor SELECT → null
      mockDb.run.mockResolvedValueOnce(null);

      await backfill.backfillAddress(ADDR);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no chainSync cursor yet'),
      );
      expect(mockBlockfrost.fetchAddressTransactions).not.toHaveBeenCalled();
    });

    it('skips when blockfrost tip is unavailable', async () => {
      // cursor SELECT → row with slot
      mockDb.run.mockResolvedValueOnce({ slot: 42 });
      mockBlockfrost.getLatestBlock.mockResolvedValueOnce(null);

      await backfill.backfillAddress(ADDR);

      expect(mockBlockfrost.fetchAddressTransactions).not.toHaveBeenCalled();
    });

    it('aborts when watch row disappears mid-flight', async () => {
      // cursor → ok; tip 1000; then watch lookup → null
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce(null);

      await backfill.backfillAddress(ADDR);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no longer watched'),
      );
      expect(mockBlockfrost.fetchAddressTransactions).not.toHaveBeenCalled();
    });

    it('breaks early when lastCheckedBlock already past cap', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: 9999, includesAssetsJson: null });

      await backfill.backfillAddress(ADDR);

      expect(mockBlockfrost.fetchAddressTransactions).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/complete.*0 matching/),
      );
    });

    it('breaks when fetchAddressTransactions returns empty', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, includesAssetsJson: null });
      mockBlockfrost.fetchAddressTransactions.mockResolvedValueOnce([]);

      await backfill.backfillAddress(ADDR);

      expect(mockBlockfrost.fetchAddressTransactions).toHaveBeenCalledTimes(1);
    });

    it('persists matching txs and emits when no filter is set', async () => {
      const txs = [
        { txHash: 'a1', blockHeight: 100, blockHash: 'bh1', utxosCreated: [], utxosSpent: [] },
        { txHash: 'a2', blockHeight: 200, blockHash: 'bh2', utxosCreated: [], utxosSpent: [] },
      ];
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, includesAssetsJson: null, tag: 'pool' });
      mockBlockfrost.fetchAddressTransactions
        .mockResolvedValueOnce(txs)
        // Second page: empty → break.
        .mockResolvedValueOnce([]);
      // Third iteration needs a watch lookup; just return one already past cap.
      mockDb.run.mockResolvedValueOnce({ lastCheckedBlock: 200, includesAssetsJson: null });

      await backfill.backfillAddress(ADDR);

      expect(mockDb.tx).toHaveBeenCalled();
      // 2 INSERTs + 1 UPDATE inside the tx
      expect(mockTx.run).toHaveBeenCalledTimes(3);
      expect(mockCds.emit).toHaveBeenCalledWith(
        'cardano.newTransactions',
        expect.objectContaining({ address: ADDR, count: 2, tag: 'pool' }),
      );
    });

    it('applies asset filter and skips non-matching txs', async () => {
      const txs = [
        { txHash: 'a1', blockHeight: 100, blockHash: 'bh1', utxosCreated: [], utxosSpent: [] },
        { txHash: 'a2', blockHeight: 200, blockHash: 'bh2', utxosCreated: [], utxosSpent: [] },
      ];
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({
          lastCheckedBlock: null,
          includesAssetsJson: '[{"policyId":"p","assetNameHex":"a"}]',
          tag: null,
        });
      mockBlockfrost.fetchAddressTransactions
        .mockResolvedValueOnce(txs)
        .mockResolvedValueOnce([]);
      mockBlockfrost.parseAssetFilter.mockReturnValueOnce([{ policyId: 'p', assetNameHex: 'a' }]);
      // Only the first tx matches.
      mockBlockfrost.matchesAssetFilter.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockDb.run.mockResolvedValueOnce({ lastCheckedBlock: 200, includesAssetsJson: 'x' });

      await backfill.backfillAddress(ADDR);

      // 1 INSERT (one match) + 1 UPDATE
      expect(mockTx.run).toHaveBeenCalledTimes(2);
      expect(mockCds.emit).toHaveBeenCalledWith(
        'cardano.newTransactions',
        expect.objectContaining({ count: 1 }),
      );
    });

    it('does not emit when filter matches nothing but still updates cursor', async () => {
      const txs = [
        { txHash: 'a1', blockHeight: 100, blockHash: 'bh1', utxosCreated: [], utxosSpent: [] },
      ];
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({
          lastCheckedBlock: null,
          includesAssetsJson: '[]',
          tag: null,
        });
      mockBlockfrost.fetchAddressTransactions
        .mockResolvedValueOnce(txs)
        .mockResolvedValueOnce([]);
      mockBlockfrost.parseAssetFilter.mockReturnValueOnce([{ policyId: 'p', assetNameHex: 'a' }]);
      mockBlockfrost.matchesAssetFilter.mockReturnValueOnce(false);
      mockDb.run.mockResolvedValueOnce({ lastCheckedBlock: 100, includesAssetsJson: 'x' });

      await backfill.backfillAddress(ADDR);

      // 0 INSERTs + 1 UPDATE only — no emit
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockCds.emit).not.toHaveBeenCalled();
    });

    it('swallows emit errors with a warning', async () => {
      const txs = [
        { txHash: 'a1', blockHeight: 100, blockHash: 'bh1', utxosCreated: [], utxosSpent: [] },
      ];
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, includesAssetsJson: null, tag: null });
      mockBlockfrost.fetchAddressTransactions
        .mockResolvedValueOnce(txs)
        .mockResolvedValueOnce([]);
      mockDb.run.mockResolvedValueOnce({ lastCheckedBlock: 100, includesAssetsJson: null });
      mockCds.emit.mockRejectedValueOnce(new Error('bus down'));

      await expect(backfill.backfillAddress(ADDR)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to emit'),
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // backfillCredential
  // -------------------------------------------------------------------------
  describe('backfillCredential', () => {
    const CRED = 'a'.repeat(56);

    it('skips when koios is unavailable', async () => {
      mockKoios.isAvailable.mockReturnValueOnce(false);

      await backfill.backfillCredential(CRED);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Koios not initialized'),
      );
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('skips when no chainSync cursor', async () => {
      mockDb.run.mockResolvedValueOnce(null);

      await backfill.backfillCredential(CRED);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no chainSync cursor yet'),
      );
      expect(mockKoios.getAddressesByCredential).not.toHaveBeenCalled();
    });

    it('returns silently when watch row is missing', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce(null);

      await backfill.backfillCredential(CRED);

      expect(mockKoios.getAddressesByCredential).not.toHaveBeenCalled();
    });

    it('returns when koios resolves zero addresses for the credential', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, includesAssetsJson: null });
      mockKoios.getAddressesByCredential.mockResolvedValueOnce([]);

      await backfill.backfillCredential(CRED);

      expect(mockKoios.getCredentialTxsSince).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No addresses resolved'),
      );
    });

    it('returns "nothing new" when all credential txs are past cap or already seen', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: 500, includesAssetsJson: null });
      mockKoios.getAddressesByCredential.mockResolvedValueOnce(['addr_test1q1']);
      // One tx, but blockHeight is BELOW lastCheckedBlock → filtered out.
      mockKoios.getCredentialTxsSince.mockResolvedValueOnce([
        { txHash: 't1', blockHeight: 100 },
      ]);

      await backfill.backfillCredential(CRED);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('nothing new'),
      );
      expect(mockDb.tx).not.toHaveBeenCalled();
    });

    it('persists matching credential txs and emits', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, includesAssetsJson: null, tag: 'cred-tag' });
      mockKoios.getAddressesByCredential.mockResolvedValueOnce(['addr_test1q1']);
      mockKoios.getCredentialTxsSince.mockResolvedValueOnce([
        { txHash: 't1', blockHeight: 100 },
        { txHash: 't2', blockHeight: 200 },
      ]);
      mockBlockfrost.fetchTxUtxos
        .mockResolvedValueOnce({ utxosCreated: [{ txHash: 't1' }], utxosSpent: [] })
        .mockResolvedValueOnce({ utxosCreated: [{ txHash: 't2' }], utxosSpent: [{ ref: 'r' }] });

      await backfill.backfillCredential(CRED);

      expect(mockDb.tx).toHaveBeenCalled();
      // 2 INSERTs + 1 UPDATE
      expect(mockTx.run).toHaveBeenCalledTimes(3);
      expect(mockCds.emit).toHaveBeenCalledWith(
        'cardano.credential.newTransactions',
        expect.objectContaining({
          paymentCredHex: CRED,
          tag: 'cred-tag',
          count: 2,
          blockHeight: 200,
        }),
      );
    });

    it('skips a tx when blockfrost.fetchTxUtxos returns null', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, includesAssetsJson: null });
      mockKoios.getAddressesByCredential.mockResolvedValueOnce(['addr_test1q1']);
      mockKoios.getCredentialTxsSince.mockResolvedValueOnce([
        { txHash: 't1', blockHeight: 100 },
      ]);
      mockBlockfrost.fetchTxUtxos.mockResolvedValueOnce(null);

      await backfill.backfillCredential(CRED);

      // No INSERT (skipped) + 1 UPDATE
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockCds.emit).not.toHaveBeenCalled();
    });

    it('bumps maxBlock but skips insert when asset filter rejects a tx', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({
          lastCheckedBlock: null,
          includesAssetsJson: '[{"policyId":"p","assetNameHex":"a"}]',
        });
      mockKoios.getAddressesByCredential.mockResolvedValueOnce(['addr_test1q1']);
      mockKoios.getCredentialTxsSince.mockResolvedValueOnce([
        { txHash: 't1', blockHeight: 300 },
      ]);
      mockBlockfrost.fetchTxUtxos.mockResolvedValueOnce({ utxosCreated: [], utxosSpent: [] });
      mockBlockfrost.parseAssetFilter.mockReturnValueOnce([{ policyId: 'p', assetNameHex: 'a' }]);
      mockBlockfrost.matchesAssetFilter.mockReturnValueOnce(false);

      await backfill.backfillCredential(CRED);

      // 0 INSERTs + 1 UPDATE; no emit
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      expect(mockCds.emit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // backfillPolicy
  // -------------------------------------------------------------------------
  describe('backfillPolicy', () => {
    const POLICY = 'p'.repeat(56);

    it('skips when no chainSync cursor', async () => {
      mockDb.run.mockResolvedValueOnce(null);

      await backfill.backfillPolicy(POLICY);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no chainSync cursor yet'),
      );
      expect(mockBlockfrost.fetchPolicyAssetEvents).not.toHaveBeenCalled();
    });

    it('returns silently when watch row is missing', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce(null);

      await backfill.backfillPolicy(POLICY);

      expect(mockBlockfrost.fetchPolicyAssetEvents).not.toHaveBeenCalled();
    });

    it('returns silently when asset cap was exceeded (events === null)', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null });
      mockBlockfrost.fetchPolicyAssetEvents.mockResolvedValueOnce(null);

      await backfill.backfillPolicy(POLICY);

      expect(mockDb.tx).not.toHaveBeenCalled();
      expect(mockCds.emit).not.toHaveBeenCalled();
    });

    it('logs "nothing new" when no events returned', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null });
      mockBlockfrost.fetchPolicyAssetEvents.mockResolvedValueOnce([]);

      await backfill.backfillPolicy(POLICY);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('nothing new'),
      );
    });

    it('persists mint+burn events and emits per-event', async () => {
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null, tag: 'nft' });
      mockBlockfrost.fetchPolicyAssetEvents.mockResolvedValueOnce([
        {
          action: 'minted',
          policyId: POLICY,
          assetNameHex: 'a1',
          quantity: '1',
          txHash: 'tx1',
          blockHeight: 100,
        },
        {
          action: 'burned',
          policyId: POLICY,
          assetNameHex: 'a2',
          quantity: '-1',
          txHash: 'tx2',
          blockHeight: 200,
        },
      ]);

      await backfill.backfillPolicy(POLICY);

      // 2 INSERTs + 1 UPDATE
      expect(mockTx.run).toHaveBeenCalledTimes(3);
      // Two emits, one per event, with the correct event name.
      expect(mockCds.emit).toHaveBeenCalledWith(
        'cardano.policy.assetMinted',
        expect.objectContaining({ assetNameHex: 'a1', tag: 'nft' }),
      );
      expect(mockCds.emit).toHaveBeenCalledWith(
        'cardano.policy.assetBurned',
        expect.objectContaining({ assetNameHex: 'a2', tag: 'nft' }),
      );
    });

    it('uses configured policyAssetCap when computing cap', async () => {
      mockConfig.get.mockReturnValueOnce({ network: 'preview', policyAssetCap: 25 });
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: 10 });
      mockBlockfrost.fetchPolicyAssetEvents.mockResolvedValueOnce([]);

      await backfill.backfillPolicy(POLICY);

      expect(mockBlockfrost.fetchPolicyAssetEvents).toHaveBeenCalledWith(
        POLICY,
        10,
        25,
        1000,
      );
    });

    it('falls back to default 100 when policyAssetCap is missing', async () => {
      mockConfig.get.mockReturnValueOnce({ network: 'preview' });
      mockDb.run
        .mockResolvedValueOnce({ slot: 42 })
        .mockResolvedValueOnce({ lastCheckedBlock: null });
      mockBlockfrost.fetchPolicyAssetEvents.mockResolvedValueOnce([]);

      await backfill.backfillPolicy(POLICY);

      expect(mockBlockfrost.fetchPolicyAssetEvents).toHaveBeenCalledWith(
        POLICY,
        null,
        100,
        1000,
      );
    });
  });
});
