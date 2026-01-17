import cds, { Request } from "@sap/cds";
const { SELECT, INSERT, UPDATE } = cds.ql;
import * as watcher from "../src/watcher";
import * as cardanoWatcher from "../src/index";
import { rejectMissing, rejectInvalid } from './utils/errors';
import { isValidBech32Address, isValidNetwork, isTxHash } from './utils/validators';
import { handleRequest } from './utils/backend-request-handler';
import logger from './utils/logger';
import type { WatchedAddress, TransactionSubmission } from '../@cds-models/CardanoWatcherAdminService';

const COMPONENT_NAME = '[CardanoWatcherAdminService]';

// Initialize Cardano Watcher on module load
cardanoWatcher.initialize().catch((err) => {
  logger.error("Failed to initialize Cardano Watcher:", err);
});

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
      return { success: true, message: "Watcher started successfully"};
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
      return { success: true, message: "Watcher stopped successfully"};
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
        network: status.config.network || "preview",
        pollingIntervals: {
          address: status.config.addressPolling?.interval || 30,
          transaction: status.config.transactionPolling?.interval || 60,
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
      // check if already exists / being watched
      const existing = await db.run(SELECT.one.from(WatchedAddresses).where({ address }));
      if (existing) {
        return rejectInvalid('addWatchedAddress', `Address ${address} is already being watched`, 'address');
      }

      // create new watch entry
      const watchedAddressEntry: WatchedAddress = {
        address,
        description: description || null,
        network: network || watcher.getStatus().config.network || 'preview',
        active: true,
        lastCheckedBlock: null,
      };

      const result = await db.run(INSERT.into(WatchedAddresses).entries(watchedAddressEntry));
      
      logger.info({ address, result }, "Added watched address");

      return watchedAddressEntry;
    });
  });

  srv.on("removeWatchedAddress", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} removeWatchedAddress action called`);
    const { address } = req.data;

    // Validate inputs
    if (!address) return rejectMissing('removeWatchedAddress', 'address');
    if (!isValidBech32Address(address)) {
      return rejectInvalid('removeWatchedAddress', 'Invalid Bech32 address format', 'address');
    } 
    return handleRequest(req, async (db: any) => {
      // Check if exists
      const existing = await db.run(SELECT.one.from(WatchedAddresses).where({ address }));
      if (!existing) {
        return rejectInvalid('removeWatchedAddress', `Address ${address} is not being watched`, 'address');
      }
      // Remove watch entry
      const result = await db.run(UPDATE.entity(WatchedAddresses).set({ active: false }).where({ address }));
      logger.info({ address, result }, "Removed watched address");
      return { success: true, message: `Stopped watching address ${address}` };
    });
  });

  // ---------------------------------------------------------------------------
  // Transaction Tracking Actions
  // ---------------------------------------------------------------------------

  /**
   * Submit and Track Transaction
   * Submits a transaction hash for status tracking
   */
  srv.on("addWatchedTransaction", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} TrackSubmittedTransaction action called`);
    const { txHash, description, network } = req.data;
    
    // Validate inputs
    if (!txHash) return rejectMissing('TrackSubmittedTransaction', 'txHash');
    if (!isTxHash(txHash)) {
      return rejectInvalid('TrackSubmittedTransaction', 'Invalid transaction hash format', 'txHash');
    }
    if (network && !isValidNetwork(network)) {
      return rejectInvalid('TrackSubmittedTransaction', 'Invalid network', 'network');
    }

    return handleRequest(req, async (db: any) => {
      // Check if already exists
      const existing = await db.run(SELECT.one.from(TransactionSubmissions).where({ txHash }));
      if (existing) {
        return rejectInvalid('TrackSubmittedTransaction', `Transaction ${txHash} is already being tracked`, 'txHash');
      }
      
      // Create new submission entry
      const submissionEntry: TransactionSubmission = {
        txHash,
        description: description || null,
        network: network,
        active: true,
        currentStatus: "PENDING",
        confirmations: 0,
      };

      await db.run(INSERT.into(TransactionSubmissions).entries(submissionEntry));
      
      logger.info({ txHash }, "TrackSubmittedTransaction action called");
      
      return submissionEntry;
    });
  });

  srv.on("removeWatchedTransaction", async (req: Request) => {
    logger.debug(`${COMPONENT_NAME} removeWatchedTransaction action called`);
    const { txHash } = req.data;
    // Validate inputs
    if (!txHash) return rejectMissing('removeWatchedTransaction', 'txHash');
    if (!isTxHash(txHash)) {
      return rejectInvalid('removeWatchedTransaction', 'Invalid transaction hash format', 'txHash');
    }
    return handleRequest(req, async (db: any) => {
      // Check if exists
      const existing = await db.run(SELECT.one.from(TransactionSubmissions).where({ txHash }));
      if (!existing) {
        return rejectInvalid('removeWatchedTransaction', `Transaction ${txHash} is not being tracked`, 'txHash');
      }
      // Remove watch entry
      const result = await db.run(UPDATE.entity(TransactionSubmissions).set({ active: false }).where({ txHash }));
      logger.info({ txHash, result }, "Removed watched transaction");
      return { success: true, message: `Stopped tracking transaction ${txHash}` };
    });
  });

  logger.info(`${COMPONENT_NAME} All handlers registered`);
};

