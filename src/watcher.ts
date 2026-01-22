import cds from "@sap/cds";
const { SELECT, INSERT, UPDATE } = cds.ql;
import { randomUUID } from "crypto";
import * as config from "./config";
import * as blockfrost from "./blockfrost";
import type { TransactionInfo } from "./blockfrost";
import { BlockchainEvent, TransactionSubmission ,TransactionSubmissions, WatchedAddress, WatchedAddresses } from "../@cds-models/CardanoWatcherAdminService";
const logger = cds.log(`ODATANO-WATCH`);
let addressInterval: NodeJS.Timeout | null = null;
let transactionInterval: NodeJS.Timeout | null = null;

let isRunning = false;
let addressPollingActive = false;
let transactionPollingActive = false;
let signalHandlersRegistered = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

/**
 * Setup the watcher - should be called once during initialization
 * @returns true if setup succeeded, false if Blockfrost is not configured
 */
export async function setup(): Promise<boolean> {
  const cfg = config.get();
  
  logger.debug("Watcher setup - Config:", {
    hasApiKey: !!cfg.blockfrostApiKey,
    network: cfg.network,
    apiKeyPrefix: cfg.blockfrostApiKey?.substring(0, 10)
  });
  
  // Use the application's standard database
  logger.debug('Connecting to standard database service');
  db = cds.db;
  logger.debug("Database connection established");
  
  // Initialize Blockfrost if API key is available
  if (cfg.blockfrostApiKey) {
    logger.debug("Initializing Blockfrost client...");
    try {
      blockfrost.initializeClient(cfg);
      logger.debug("Blockfrost available:", blockfrost.isAvailable());
    } catch (err) {
      logger.error("Failed to initialize Blockfrost:", err);
      return false;
    }
  } else {
    logger.warn("No Blockfrost API key found in configuration");
    return false;
  }
  
  // Register shutdown handlers (only once to prevent memory leak)
  if (!signalHandlersRegistered) {
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
    signalHandlersRegistered = true;
  }

  if (cfg.autoStart) {
    logger.info("Auto-starting Cardano Watcher...");
    await start();
    return true;
  }
  return true;
}

/**
 * Start watching the blockchain
 */
export async function start(): Promise<void> {
  if (isRunning) {
    logger.warn("Watcher is already running");
    return;
  }

  const cfg = config.get();

  logger.info(`Starting Cardano Watcher on ${cfg.network} network`);
  
  isRunning = true;

  // start individual polling paths based on config
  if (cfg.addressPolling?.enabled) {
    await startAddressPolling();
  }
  
  if (cfg.transactionPolling?.enabled) {
    await startTransactionPolling();
  }
  
}

/**
 * Stop watching the blockchain (all polling paths)
 */
export async function stop(): Promise<void> {
  if (!isRunning) {
    return;
  }

  logger.debug("Stopping Cardano Watcher...");

  await stopAddressPolling();
  await stopTransactionPolling();

  isRunning = false;
  logger.info("Cardano Watcher stopped");
}

// ============================================================================
// Address Polling Path
// ============================================================================

/**
 * Start address polling
 */
export async function startAddressPolling(): Promise<void> {

  if (addressPollingActive) {
    return;
  }

  const cfg = config.get();
  const interval = cfg.addressPolling?.interval || 30;

  logger.debug(`Starting address polling (interval: ${interval}s)`);
  addressPollingActive = true;

  // Start interval
  addressInterval = setInterval(async () => {
    try {
      await pollWatchedAddresses();
    } catch (err) {
      logger.error("Error in address polling:", err);
    }
  }, interval * 1000);

  // Run initial poll immediately
  try {
    await pollWatchedAddresses();
  } catch (err) {
    logger.error("Error in initial address poll:", err);
  }
}

/**
 * Stop address polling
 */
export async function stopAddressPolling(): Promise<void> {
  if (!addressPollingActive) {
    return;
  }

  logger.debug("Stopping address polling...");

  if (addressInterval) {
    clearInterval(addressInterval);
    addressInterval = null;
  }

  addressPollingActive = false;
}

// ============================================================================
// Transaction Polling Path
// ============================================================================

/**
 * Start transaction submission polling
 */
export async function startTransactionPolling(): Promise<void> {
  if (transactionPollingActive) {
    return;
  }

  const cfg = config.get();
  const interval = cfg.transactionPolling?.interval || 60;

  logger.debug(`Starting transaction polling (interval: ${interval}s)`);
  transactionPollingActive = true;

  // Start interval
  transactionInterval = setInterval(async () => {
    try {
      await pollTransactionSubmissions();
    } catch (err) {
      logger.error("Error in transaction polling:", err);
    }
  }, interval * 1000);

  // Run initial poll immediately
  try {
    await pollTransactionSubmissions();
  } catch (err) {
    logger.error("Error in initial transaction poll:", err);
  }
}

/**
 * Stop transaction submission polling
 */
export async function stopTransactionPolling(): Promise<void> {
  if (!transactionPollingActive) {
    return;
  }

  logger.debug("Stopping transaction polling...");

  if (transactionInterval) {
    clearInterval(transactionInterval);
    transactionInterval = null;
  }

  transactionPollingActive = false;
}


// ============================================================================
// Individual Polling Functions
// ============================================================================

/**
 * Poll watched addresses for new transactions
 * @returns Number of events detected
 */
async function pollWatchedAddresses(): Promise<number> {
  let eventsDetected = 0;

  try {
    // Get all watched addresses
    const watchedAddresses = await db.tx(async (tx: any) => {
      return tx.run(
        SELECT.from(WatchedAddresses)
          .where({ active: true })
      ) as Promise<WatchedAddress[]>;
    });

    if (!watchedAddresses || watchedAddresses.length === 0) {
      logger.debug("No active watched addresses found");
      return 0;
    }

    logger.debug(`Checking ${watchedAddresses.length} watched addresses`);

    // Process each watched address
    for (const watchedAddr of watchedAddresses) {
      const events = await processAddress(watchedAddr);
      eventsDetected += events;
    }

  } catch (err) {
    logger.error("Error in pollWatchedAddresses:", err);
    throw err;
  }
  
  return eventsDetected;
}

/**
 * Process a single watched address
 * @returns Number of events detected
 */
async function processAddress(watchedAddr: WatchedAddress): Promise<number> {
  const cfg = config.get();
  let eventsDetected = 0;

  try {
    if (!watchedAddr.address || !watchedAddr.lastCheckedBlock) {
      logger.warn("Watched address has no address field or lastCheckedBlock is null:", watchedAddr);
      return 0;
    }

    logger.debug(`Processing address: ${watchedAddr.address}`);

    const transactions = await fetchAddressTransactions(watchedAddr.address, watchedAddr.lastCheckedBlock);

    if (transactions && transactions.length > 0) {
      logger.info(`Found ${transactions.length} new transactions for ${watchedAddr.address}`);
      eventsDetected = transactions.length;

      await db.tx(async (tx: any) => {
        // Insert all blockchain events
        for (const tx_data of transactions) {
          await tx.run(
            INSERT.into(BlockchainEvent).entries({
              id: randomUUID(),
              type: "TRANSACTION",
              blockHeight: tx_data.blockHeight,
              blockHash: tx_data.blockHash,
              txHash: tx_data.txHash,
              address_address: watchedAddr.address,
              payload: JSON.stringify(tx_data),
              network: cfg.network,
              processed: false,
            } as BlockchainEvent)
          );
        }

        // Update lastCheckedBlock once after processing all transactions
        const maxBlock = Math.max(...transactions.map(t => t.blockHeight));
        await tx.run(
          UPDATE.entity(WatchedAddresses)
            .set({ lastCheckedBlock: maxBlock })
            .where({ address: watchedAddr.address })
        );
      });

      // Emit event for other parts of the application
      try {
        await (cds as any).emit("cardano.newTransactions", {
          address: watchedAddr.address,
          count: transactions.length,
          transactions: transactions.map(t => t.txHash),
        });
      } catch (emitErr) {
        logger.warn("Failed to emit newTransactions event:", emitErr);
      }
    }
  } catch (err) {
    logger.error(`Error processing address ${watchedAddr.address}:`, err);
  }
  
  return eventsDetected;
}

/**
 * Fetch transactions for an address from Cardano API
 */
async function fetchAddressTransactions(
  address: string,
  fromBlock: number | null
): Promise<TransactionInfo[] | null> {
  
  // Try Blockfrost first
  if (blockfrost.isAvailable()) {
    try {
      return await blockfrost.fetchAddressTransactions(address, fromBlock);
    } catch (err) {
      logger.error("Error fetching from Blockfrost:", err);
      throw err;
    }
  }
  return null;
}

/**
 * Poll submitted transactions to check if they are in the network
 * This checks if submitted transactions have been picked up by the blockchain,
 * not their confirmation status.
 * @returns Number of events detected
 */
async function pollTransactionSubmissions(): Promise<number> {
  let eventsDetected = 0;

  try {
    // Get active transaction submissions
    const submissions = await db.tx(async (tx: any) => {
      return tx.run(
        SELECT.from(TransactionSubmissions)
          .where({ active: true })
      );
    });

    if (!submissions || submissions.length === 0) {
      logger.debug("No active transaction submissions found");
      return 0;
    }

    logger.debug(`Checking ${submissions.length} transaction submissions`);

    // Process each submission
    for (const submission of submissions) {
      const events = await processTransactionSubmission(submission);
      eventsDetected += events;
    }

  } catch (err) {
    logger.error("Error in pollTransactionSubmissions:", err);
    throw err;
  }
  
  return eventsDetected;
}

async function processTransactionSubmission(submission: TransactionSubmission): Promise<number> {
  const cfg = config.get();
  let eventsDetected = 0;
  try {
    if (!submission.txHash) {
      logger.warn("Transaction submission has no txHash:", submission);
      return 0;
    }
    logger.debug(`Processing transaction submission: ${submission.txHash}`);

    const txData = await blockfrost.getTransaction(submission.txHash);
    if (txData) {
      logger.info(`Transaction ${submission.txHash} found on chain in block ${txData.blockHeight}`);
      eventsDetected += 1;
      await db.tx(async (tx: any) => {
        // Store blockchain event
        await tx.run(
          INSERT.into(BlockchainEvent).entries({
            id: randomUUID(),
            type: "TRANSACTION_SUBMISSION",
            blockHeight: txData.blockHeight,
            blockHash: txData.blockHash,
            txHash: txData.txHash,
            payload: JSON.stringify(txData),
            network: cfg.network,
            processed: false,
          } as BlockchainEvent)
        );  
        // Update submission status
        await tx.run(
          UPDATE.entity(TransactionSubmissions).set({ active: false }).where({ txHash: submission.txHash })
        );
      });
    }
  } catch (err) {
    logger.error(`Error processing transaction submission ${submission.txHash}:`, err);
  }
  return eventsDetected;
}

/**
 * Get current watcher status
 */
export function getStatus(): { 
  isRunning: boolean; 
  addressPolling: boolean;
  transactionPolling: boolean;
  config: config.CardanoWatcherConfig;
  } 
  {
    return {
      isRunning,
      addressPolling: addressPollingActive,
      transactionPolling: transactionPollingActive,
      config: config.get(),
    };
  }

