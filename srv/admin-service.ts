import cds, { Request } from "@sap/cds";
const { SELECT, INSERT, UPDATE } = cds.ql;
import * as watcher from "../src/watcher";
import { rejectMissing, rejectInvalid } from './utils/errors';
import { isValidBech32Address, isValidNetwork, isTxHash, isNonEmptyString } from './utils/validators';
import { handleRequest } from './utils/backend-request-handler';
import logger from './utils/logger';
import type { WatchedAddress, TransactionSubmission } from '../@cds-models/CardanoWatcherAdminService';

const COMPONENT_NAME = '[CardanoWatcherAdminService]';

/**
 * Cardano Watcher Admin Service Implementation
 * Manages blockchain address monitoring and transaction tracking
 */
module.exports = (srv: cds.Service) => {
  logger.info(`${COMPONENT_NAME} Module loaded - registering handlers`);
  
  const {
    WatchedAddresses,
    TransactionSubmissions,
  } = require('#cds-models/CardanoWatcherAdminService');

  // ---------------------------------------------------------------------------
  // Watcher Control Actions
  // ---------------------------------------------------------------------------

  /**
   * Start Watcher - Start all polling paths
   */
  srv.on("startWatcher", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} startWatcher action called`);
    
    return handleRequest(req, async () => {
      await watcher.start();
      logger.info("Watcher started successfully");
      return "Watcher started successfully";
    });
  });

  /**
   * Stop Watcher - Stop all polling paths
   */
  srv.on("stopWatcher", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} stopWatcher action called`);
    
    return handleRequest(req, async () => {
      await watcher.stop();
      logger.info("Watcher stopped successfully");
      return "Watcher stopped successfully";
    });
  });

  /**
   * Start Address Polling
   */
  srv.on("startAddressPolling", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} startAddressPolling action called`);
    
    return handleRequest(req, async () => {
      await watcher.startAddressPolling();
      logger.info("Address polling started");
      return "Address polling started";
    });
  });

  /**
   * Start Transaction Polling
   */
  srv.on("startTransactionPolling", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} startTransactionPolling action called`);
    
    return handleRequest(req, async () => {
      await watcher.startTransactionPolling();
      logger.info("Transaction polling started");
      return "Transaction polling started";
    });
  });

  /**
   * Stop Address Polling
   */
  srv.on("stopAddressPolling", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} stopAddressPolling action called`);
    
    return handleRequest(req, async () => {
      await watcher.stopAddressPolling();
      logger.info("Address polling stopped");
      return "Address polling stopped";
    });
  });

  /**
   * Stop Transaction Polling
   */
  srv.on("stopTransactionPolling", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} stopTransactionPolling action called`);
    
    return handleRequest(req, async () => {
      await watcher.stopTransactionPolling();
      logger.info("Transaction polling stopped");
      return "Transaction polling stopped";
    });
  });

  /**
   * Get Watcher Status
   */
  srv.on("getWatcherStatus", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} getWatcherStatus action called`);
    
    return handleRequest(req, async (db: any) => {
      const status = watcher.getStatus();
      
      // Count active watches
      const [addressCount, submissionCount] = await Promise.all([
        db.run(SELECT.from(WatchedAddresses).where({ active: true })),
        db.run(SELECT.from(TransactionSubmissions).where({ active: true })),
      ]);

      logger.debug({ 
        addresses: Array.isArray(addressCount) ? addressCount.length : 0,
        submissions: Array.isArray(submissionCount) ? submissionCount.length : 0 
      }, "Active watch counts");

      return {
        isRunning: status.isRunning,
        addressPolling: status.addressPolling,
        transactionPolling: status.transactionPolling,
        mempoolPolling: status.mempoolPolling,
        network: status.config.network || "preview",
        pollingIntervals: {
          address: status.config.addressPolling?.interval || 30,
          transaction: status.config.transactionPolling?.interval || 60,
          mempool: status.config.mempoolPolling?.interval || 10,
        },
        watchCounts: {
          addresses: Array.isArray(addressCount) ? addressCount.length : 0,
          submissions: Array.isArray(submissionCount) ? submissionCount.length : 0,
          newTransactions: 0,
        },
      };
    });
  });

  // ---------------------------------------------------------------------------
  // Address Monitoring Actions
  // ---------------------------------------------------------------------------

  /**
   * Add Watched Address
   * Adds a new Cardano address to monitor for blockchain activity
   */
  srv.on("addWatchedAddress", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} addWatchedAddress action called`);
    const { address, description, network } = req.data;
    
    // Validate inputs
    if (!address) return rejectMissing('addWatchedAddress', 'address');
    if (!isValidBech32Address(address)) {
      return rejectInvalid('addWatchedAddress', 'Invalid Bech32 address format', 'address');
    }
    if (network && !isValidNetwork(network)) {
      return rejectInvalid('addWatchedAddress', 'Invalid network (must be mainnet, preview, or preprod)', 'network');
    }

    return handleRequest(req, async (db: any) => {
      // Check if already exists
      const existing = await db.run(SELECT.one.from(WatchedAddresses).where({ address }));
      if (existing) {
        return rejectInvalid('addWatchedAddress', `Address ${address} is already being watched`, 'address');
      }

      // Create new watch entry
      const watchedAddressEntry: WatchedAddress = {
        address,
        description: description || null,
        network: network || watcher.getStatus().config.network || 'preview',
        active: true,
        lastCheckedBlock: null,
      };

      await db.run(INSERT.into(WatchedAddresses).entries(watchedAddressEntry));

      logger.info({ address }, "Added watched address");

      return watchedAddressEntry;
    });
  });

  // ---------------------------------------------------------------------------
  // Transaction Tracking Actions
  // ---------------------------------------------------------------------------

  /**
   * Submit and Track Transaction
   * Submits a transaction hash for status tracking
   */
  srv.on("submitAndTrackTransaction", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} submitAndTrackTransaction action called`);
    const { txHash, description, network, metadata } = req.data;
    
    // Validate inputs
    if (!txHash) return rejectMissing('submitAndTrackTransaction', 'txHash');
    if (!isTxHash(txHash)) {
      return rejectInvalid('submitAndTrackTransaction', 'Invalid transaction hash format', 'txHash');
    }
    if (network && !isValidNetwork(network)) {
      return rejectInvalid('submitAndTrackTransaction', 'Invalid network', 'network');
    }

    return handleRequest(req, async (db: any) => {
      // Check if already exists
      const existing = await db.run(SELECT.one.from(TransactionSubmissions).where({ txHash }));
      if (existing) {
        return rejectInvalid('submitAndTrackTransaction', `Transaction ${txHash} is already being tracked`, 'txHash');
      }
      
      // Create new submission entry
      const submissionEntry: TransactionSubmission = {
        txHash,
        description: description || null,
        network: network || watcher.getStatus().config.network || 'preview',
        active: true,
        currentStatus: "PENDING",
        confirmations: 0,
        metadata: metadata || null,
        submittedBy: req.user?.id || "system",
      };

      await db.run(INSERT.into(TransactionSubmissions).entries(submissionEntry));
      
      logger.info({ txHash }, "Submitted and tracking transaction");
      
      return submissionEntry;
    });
  });

  /**
   * Update Transaction Status
   * Manually update the status of a tracked transaction
   */
  srv.on("updateTransactionStatus", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} updateTransactionStatus action called`);
    const { txHash, status } = req.data;

    // Validate inputs
    if (!txHash) return rejectMissing('updateTransactionStatus', 'txHash');
    if (!status) return rejectMissing('updateTransactionStatus', 'status');
    if (!isTxHash(txHash)) {
      return rejectInvalid('updateTransactionStatus', 'Invalid transaction hash format', 'txHash');
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'FAILED'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return rejectInvalid('updateTransactionStatus', `Invalid status (must be one of: ${validStatuses.join(', ')})`, 'status');
    }

    return handleRequest(req, async (db: any) => {
      const result = await db.run(
        UPDATE.entity(TransactionSubmissions)
          .set({ currentStatus: status.toUpperCase(), lastChecked: new Date().toISOString() })
          .where({ txHash })
      );
      
      if (!result || result === 0) {
        return rejectInvalid('updateTransactionStatus', `Transaction ${txHash} not found`, 'txHash');
      }

      logger.info({ txHash, status }, "Updated transaction status");
      
      // Return updated record
      return await db.run(SELECT.one.from(TransactionSubmissions).where({ txHash }));
    });
  });

  // ---------------------------------------------------------------------------
  // Watch Management Actions
  // ---------------------------------------------------------------------------

  /**
   * Remove Watch
   * Remove an address or transaction from monitoring
   */
  srv.on("removeWatch", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} removeWatch action called`);
    const { watchType, key } = req.data;

    // Validate inputs
    if (!watchType) return rejectMissing('removeWatch', 'watchType');
    if (!key) return rejectMissing('removeWatch', 'key');
    if (!isNonEmptyString(watchType)) {
      return rejectInvalid('removeWatch', 'watchType must be a non-empty string', 'watchType');
    }
    if (!isNonEmptyString(key)) {
      return rejectInvalid('removeWatch', 'key must be a non-empty string', 'key');
    }

    return handleRequest(req, async (db: any) => {
      let entity;
      let whereClause;
      
      switch (watchType.toLowerCase()) {
        case "address":
          if (!isValidBech32Address(key)) {
            return rejectInvalid('removeWatch', 'Invalid address format', 'key');
          }
          entity = WatchedAddresses;
          whereClause = { address: key };
          break;
        case "transaction":
          if (!isTxHash(key)) {
            return rejectInvalid('removeWatch', 'Invalid transaction hash format', 'key');
          }
          entity = TransactionSubmissions;
          whereClause = { txHash: key };
          break;
        default:
          return rejectInvalid('removeWatch', `Unknown watch type: ${watchType} (must be 'address' or 'transaction')`, 'watchType');
      }

      const result = await db.run(
        UPDATE.entity(entity)
          .set({ active: false })
          .where(whereClause)
      );

      if (!result || result === 0) {
        return rejectInvalid('removeWatch', `${watchType} ${key} not found`, 'key');
      }
      
      logger.info({ watchType, key }, "Removed watch");
      
      return { value: true };
    });
  });

  /**
   * Manual Poll
   * Trigger a manual polling cycle for all active watches
   */
  srv.on("manualPoll", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} manualPoll action called`);
    
    return handleRequest(req, async () => {
      // Trigger manual poll
      const eventsDetected = await watcher.manualPoll();
      
      logger.info({ eventsDetected }, "Manual poll completed");
      
      return {
        success: true,
        message: "Manual poll completed successfully",
        eventsDetected: eventsDetected || 0,
      };
    });
  });

  logger.info(`${COMPONENT_NAME} All handlers registered`);
};

