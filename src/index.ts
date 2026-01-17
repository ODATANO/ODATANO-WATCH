import cds from "@sap/cds";
import * as config from "./config";
import * as watcher from "./watcher";
import type { CardanoWatcherConfig } from "./config";

const COMPONENT_NAME = "/watcher";

let initialized = false;

/**
 * Initialize the Cardano Watcher plugin
 */
export async function initialize(): Promise<void> {
  if (initialized) {
    return;
  }

  const logger = cds.log(COMPONENT_NAME);
  logger.info("Initializing Cardano Watcher plugin...");

  // Initialize config from cds.env.cardanoWatcher (merge with defaults)
  const envConfig = cds.env.cardanoWatcher || {};
  logger.info("Config from cds.env:", envConfig);
  config.initialize(envConfig);
  
  const cfg = config.get();
  logger.info("Final config:", { 
    network: cfg.network, 
    hasApiKey: !!cfg.blockfrostApiKey,
    apiKeyLength: cfg.blockfrostApiKey?.length 
  });

  // Check if database is already connected
  const db = await cds.connect.to('db');
  if (db) {
    logger.info("Database already connected, setting up Cardano Watcher...");
    await watcher.setup();
    logger.info("Cardano Watcher initialized successfully");
    initialized = true;
    return;
  }

  // Wait for database connection
  let initFinished: () => void;
  const initPromise = new Promise<void>((resolve) => (initFinished = resolve));

  cds.on("connect", (service: { name: string; }) => {
    if (service.name === "db") {
      logger.info("Database connected, setting up Cardano Watcher...");
      
      // Setup watcher
      watcher.setup().then(() => {
        logger.info("Cardano Watcher initialized successfully");
        initialized = true;
        initFinished();
      }).catch((err) => {
        logger.error("Failed to setup watcher:", err);
        throw err;
      });
    }
  });

  await initPromise;
}

/**
 * Start the watcher (all enabled paths)
 */
export async function start(): Promise<void> {
  return watcher.start();
}

/**
 * Stop the watcher (all paths)
 */
export async function stop(): Promise<void> {
  return watcher.stop();
}

/**
 * Start individual polling paths
 */
export async function startAddressPolling(): Promise<void> {
  return watcher.startAddressPolling();
}

export async function startTransactionPolling(): Promise<void> {
  return watcher.startTransactionPolling();
}

/**
 * Stop individual polling paths
 */
export async function stopAddressPolling(): Promise<void> {
  return watcher.stopAddressPolling();
}

export async function stopTransactionPolling(): Promise<void> {
  return watcher.stopTransactionPolling();
}

/**
 * Get watcher status
 */
export function getStatus() {
  return watcher.getStatus();
}

/**
 * Get current configuration
 */
export function getConfig(): CardanoWatcherConfig {
  return config.get();
}

// Export types
export type { CardanoWatcherConfig } from "./config";
export type { TransactionInfo, AddressInfo } from "./blockfrost";

// Event payload types
export interface NewTransactionsEvent {
  address: string;
  count: number;
  transactions: string[];
}

export interface TxConfirmedEvent {
  txHash: string;
  blockHeight: number;
  confirmations: number;
}

export interface ContractEvent {
  txHash: string;
  contractAddress: string;
  eventType: string;
  scriptHash: string;
  datum?: any;
  redeemer?: any;
}

// Default export
export default {
  initialize,
  start,
  stop,
  startAddressPolling,
  startTransactionPolling,
  stopAddressPolling,
  stopTransactionPolling,
  getStatus,
  config: getConfig,
};
