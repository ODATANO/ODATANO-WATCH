import cds from "@sap/cds";
const { SELECT, INSERT, UPDATE } = cds.ql;
import * as config from "./config";
import * as blockfrost from "./blockfrost";
import type { TransactionData } from "./blockfrost";

const COMPONENT_NAME = "/cardanoWatcher/watcher";

let addressInterval: NodeJS.Timeout | null = null;
let transactionInterval: NodeJS.Timeout | null = null;
// let mempoolInterval: NodeJS.Timeout | null = null; // Not implemented yet

let isRunning = false;
let addressPollingActive = false;
let transactionPollingActive = false;
let mempoolPollingActive = false;

interface WatchedAddress {
  address: string;
  description?: string;
  active: boolean;
  lastCheckedBlock: number | null;
  network: string;
}

/**
 * Setup the watcher (called during initialization)
 */
export async function setup(): Promise<void> {
  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();
  
  // Initialize Blockfrost if API key is available
  if (cfg.blockfrostApiKey || cfg.blockfrostProjectId) {
    blockfrost.initializeClient(cfg);
  }
  
  // Register shutdown handlers
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  if (cfg.autoStart) {
    logger.info("Auto-starting Cardano Watcher...");
    await start();
  }
}

/**
 * Start watching the blockchain (all enabled polling paths)
 */
export async function start(): Promise<void> {
  if (isRunning) {
    cds.log(COMPONENT_NAME).warn("Watcher is already running");
    return;
  }

  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();

  logger.info(`Starting Cardano Watcher on ${cfg.network} network`);
  
  isRunning = true;

  // Start individual polling paths based on config
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

  const logger = cds.log(COMPONENT_NAME);
  logger.info("Stopping Cardano Watcher...");

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

  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();
  const interval = cfg.addressPolling?.interval || 30;

  logger.info(`Starting address polling (interval: ${interval}s)`);
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

  const logger = cds.log(COMPONENT_NAME);
  logger.info("Stopping address polling...");

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

  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();
  const interval = cfg.transactionPolling?.interval || 60;

  logger.info(`Starting transaction polling (interval: ${interval}s)`);
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

  const logger = cds.log(COMPONENT_NAME);
  logger.info("Stopping transaction polling...");

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
  const logger = cds.log(COMPONENT_NAME);
  let eventsDetected = 0;

  try {
    // Get watched addresses
    const watchedAddresses = await cds.tx(async (tx: any) => {
      return tx.run(
        SELECT.from("odatano.watch.WatchedAddress")
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
  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();
  let eventsDetected = 0;

  try {
    logger.debug(`Processing address: ${watchedAddr.address}`);

    const transactions = await fetchAddressTransactions(watchedAddr.address, watchedAddr.lastCheckedBlock);

    if (transactions && transactions.length > 0) {
      logger.info(`Found ${transactions.length} new transactions for ${watchedAddr.address}`);
      eventsDetected = transactions.length;

      await cds.tx(async (tx: any) => {
        for (const tx_data of transactions) {
          // Store blockchain event
          await tx.run(
            INSERT.into("odatano.watch.BlockchainEvent").entries({
              type: "TRANSACTION",
              blockNumber: tx_data.blockNumber,
              blockHash: tx_data.blockHash,
              txHash: tx_data.txHash,
              address_address: watchedAddr.address,
              payload: JSON.stringify(tx_data),
              network: cfg.network,
              processed: false,
            })
          );

          // Store transaction details
          await tx.run(
            INSERT.into("odatano.watch.Transaction").entries({
              txHash: tx_data.txHash,
              blockNumber: tx_data.blockNumber,
              blockHash: tx_data.blockHash,
              sender: tx_data.sender,
              receiver: tx_data.receiver,
              amount: tx_data.amount,
              fee: tx_data.fee,
              metadata: tx_data.metadata ? JSON.stringify(tx_data.metadata) : null,
              assets: tx_data.assets ? JSON.stringify(tx_data.assets) : null,
              status: "CONFIRMED",
              network: cfg.network,
            })
          );
        }

        // Update last checked block
        const maxBlock = Math.max(...transactions.map(t => t.blockNumber));
        await tx.run(
          UPDATE.entity("odatano.watch.WatchedAddress")
            .set({ lastCheckedBlock: maxBlock })
            .where({ address: watchedAddr.address })
        );
      });

      // Emit event for other parts of the application
      await (cds as any).emit("cardano.newTransactions", {
        address: watchedAddr.address,
        count: transactions.length,
        transactions: transactions.map(t => t.txHash),
      });
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
): Promise<TransactionData[]> {
  const logger = cds.log(COMPONENT_NAME);

  // Try Blockfrost first
  if (blockfrost.isAvailable()) {
    try {
      return await blockfrost.fetchAddressTransactions(address, fromBlock);
    } catch (err) {
      logger.error("Error fetching from Blockfrost:", err);
      throw err;
    }
  }

  // Fallback: no data source available
  logger.warn(
    "No blockchain API configured. Install @blockfrost/blockfrost-js and configure API key to fetch real data."
  );
  
  return [];
}

/**
 * Poll submitted transactions to check if they are in the network
 * This checks if submitted transactions have been picked up by the blockchain,
 * not their confirmation status.
 * @returns Number of events detected
 */
async function pollTransactionSubmissions(): Promise<number> {
  const logger = cds.log(COMPONENT_NAME);
  let eventsDetected = 0;

  try {
    // Get active transaction submissions
    const submissions = await cds.tx(async (tx: any) => {
      return tx.run(
        SELECT.from("odatano.watch.TransactionSubmission")
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

/**
 * Process a single transaction submission
 * Checks if submitted transaction is in the network (found on-chain)
 * @returns Number of events detected
 */
async function processTransactionSubmission(submission: any): Promise<number> {
  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();
  let eventsDetected = 0;

  try {
    logger.debug(`Checking if transaction ${submission.txHash} is in network`);

    const txInfo = await blockfrost.getTransaction(submission.txHash);

    if (!txInfo) {
      // Transaction not found in network yet - still pending
      logger.debug(`Transaction ${submission.txHash} still pending (not in network)`);
      
      // Update lastChecked timestamp
      await cds.tx(async (tx: any) => {
        await tx.run(
          UPDATE.entity("odatano.watch.TransactionSubmission")
            .set({ 
              lastChecked: new Date().toISOString(),
              currentStatus: "PENDING"
            })
            .where({ txHash: submission.txHash })
        );
      });
      return 0;
    }

    // Transaction found in network!
    const wasPending = submission.currentStatus === "PENDING" || !submission.currentStatus;

    if (wasPending) {
      logger.info(`Transaction ${submission.txHash} confirmed in network!`);
      eventsDetected = 1;

      await cds.tx(async (tx: any) => {
        // Update submission status to CONFIRMED
        await tx.run(
          UPDATE.entity("odatano.watch.TransactionSubmission")
            .set({
              currentStatus: "CONFIRMED",
              lastChecked: new Date().toISOString(),
              confirmations: (txInfo as any).confirmations || 0,
            })
            .where({ txHash: submission.txHash })
        );

        // Create blockchain event
        await tx.run(
          INSERT.into("odatano.watch.BlockchainEvent").entries({
            type: "TX_CONFIRMED",
            txHash: submission.txHash,
            submission_txHash: submission.txHash,
            blockNumber: (txInfo as any).blockHeight,
            blockHash: (txInfo as any).blockHash,
            payload: JSON.stringify({
              foundAt: new Date().toISOString(),
              blockHeight: (txInfo as any).blockHeight,
              confirmations: (txInfo as any).confirmations || 0,
            }),
            network: cfg.network,
            processed: false,
          })
        );
      });

      // Emit event - transaction confirmed in network
      await (cds as any).emit("cardano.transactionConfirmed", {
        txHash: submission.txHash,
        blockHeight: (txInfo as any).blockHeight,
        confirmations: (txInfo as any).confirmations || 0,
      });
    } else {
      // Already in network, just update lastChecked and confirmations
      await cds.tx(async (tx: any) => {
        await tx.run(
          UPDATE.entity("odatano.watch.TransactionSubmission")
            .set({ 
              lastChecked: new Date().toISOString(),
              confirmations: (txInfo as any).confirmations || 0,
            })
            .where({ txHash: submission.txHash })
        );
      });
    }

  } catch (err) {
    logger.error(`Error processing transaction ${submission.txHash}:`, err);
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
  mempoolPolling: boolean;
  config: any;
} {
  return {
    isRunning,
    addressPolling: addressPollingActive,
    transactionPolling: transactionPollingActive,
    mempoolPolling: mempoolPollingActive,
    config: config.get(),
  };
}

/**
 * Manual Poll - Trigger a one-time polling cycle
 * @returns Number of events detected
 */
export async function manualPoll(): Promise<number> {
  const logger = cds.log(COMPONENT_NAME);
  logger.info("Manual poll triggered");
  
  let eventsDetected = 0;
  
  try {
    // Poll watched addresses
    const addressEvents = await pollWatchedAddresses();
    eventsDetected += addressEvents || 0;
    
    // Poll transaction submissions
    const txEvents = await pollTransactionSubmissions();
    eventsDetected += txEvents || 0;
    
    logger.info({ eventsDetected }, "Manual poll completed");
  } catch (err) {
    logger.error("Error during manual poll:", err);
    throw err;
  }
  
  return eventsDetected;
}

