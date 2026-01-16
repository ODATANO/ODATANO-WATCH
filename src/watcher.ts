import cds from "@sap/cds";
const { SELECT, INSERT, UPDATE } = cds.ql;
import * as config from "./config";
import * as blockfrost from "./blockfrost";
import type { TransactionData } from "./blockfrost";

const COMPONENT_NAME = "/cardanoWatcher/watcher";

let watcherInterval: NodeJS.Timeout | null = null;
let isRunning = false;

interface WatchedAddress {
  ID: string;
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
 * Start watching the blockchain
 */
export async function start(): Promise<void> {
  if (isRunning) {
    cds.log(COMPONENT_NAME).warn("Watcher is already running");
    return;
  }

  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();

  logger.info(`Starting Cardano Watcher on ${cfg.network} network with ${cfg.pollingInterval}s interval`);
  
  isRunning = true;

  // Start polling
  watcherInterval = setInterval(async () => {
    try {
      await pollBlockchain();
    } catch (err) {
      logger.error("Error polling blockchain:", err);
    }
  }, cfg.pollingInterval! * 1000);

  // Run initial poll immediately
  try {
    await pollBlockchain();
  } catch (err) {
    logger.error("Error in initial blockchain poll:", err);
  }
}

/**
 * Stop watching the blockchain
 */
export async function stop(): Promise<void> {
  if (!isRunning) {
    return;
  }

  const logger = cds.log(COMPONENT_NAME);
  logger.info("Stopping Cardano Watcher...");

  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }

  isRunning = false;
  logger.info("Cardano Watcher stopped");
}

/**
 * Poll the blockchain for new events
 * 
 * Currently implements:
 * - Address monitoring (new transactions)
 * 
 * Planned implementations:
 * - Transaction status tracking (confirmations, status changes)
 * - Mempool monitoring (pending tx detection)
 * - Smart contract events (script executions)
 */
export async function pollBlockchain(): Promise<void> {
  const logger = cds.log(COMPONENT_NAME);

  try {
    // Monitor watched addresses for new transactions
    await pollWatchedAddresses();

    // TODO: Monitor submitted transactions for status changes
    // await pollTransactionSubmissions();

    // TODO: Monitor mempool for matching transactions
    // await pollMempoolWatches();

  } catch (err) {
    logger.error("Error in pollBlockchain:", err);
    throw err;
  }
}

/**
 * Poll watched addresses for new transactions
 */
async function pollWatchedAddresses(): Promise<void> {
  const logger = cds.log(COMPONENT_NAME);

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
      return;
    }

    logger.debug(`Checking ${watchedAddresses.length} watched addresses`);

    // Process each watched address
    for (const watchedAddr of watchedAddresses) {
      await processAddress(watchedAddr);
    }

  } catch (err) {
    logger.error("Error in pollWatchedAddresses:", err);
    throw err;
  }
}

/**
 * Process a single watched address
 */
async function processAddress(watchedAddr: WatchedAddress): Promise<void> {
  const logger = cds.log(COMPONENT_NAME);
  const cfg = config.get();

  try {
    logger.debug(`Processing address: ${watchedAddr.address}`);

    const transactions = await fetchAddressTransactions(watchedAddr.address, watchedAddr.lastCheckedBlock);

    if (transactions && transactions.length > 0) {
      logger.info(`Found ${transactions.length} new transactions for ${watchedAddr.address}`);

      await cds.tx(async (tx: any) => {
        for (const tx_data of transactions) {
          // Store blockchain event
          await tx.run(
            INSERT.into("odatano.watch.BlockchainEvent").entries({
              type: "TRANSACTION",
              blockNumber: tx_data.blockNumber,
              blockHash: tx_data.blockHash,
              txHash: tx_data.txHash,
              address_ID: watchedAddr.ID,
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
            .where({ ID: watchedAddr.ID })
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
 * Get current watcher status
 */
export function getStatus(): { isRunning: boolean; config: any } {
  return {
    isRunning,
    config: config.get(),
  };
}
