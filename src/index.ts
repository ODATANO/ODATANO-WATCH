import cds from "@sap/cds";
import * as config from "./config";
import * as watcher from "./watcher";
import type { CardanoWatcherConfig } from "./config";

const COMPONENT_NAME = "/cardanoWatcher";

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

  // Initialize config from cds.env.cardanoWatcher
  config.initialize();

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
 * Start the watcher
 */
export async function start(): Promise<void> {
  return watcher.start();
}

/**
 * Stop the watcher
 */
export async function stop(): Promise<void> {
  return watcher.stop();
}

/**
 * Get current configuration
 */
export function getConfig(): CardanoWatcherConfig {
  return config.get();
}

// Export types
export type { CardanoWatcherConfig } from "./config";
export type { TransactionData, BlockInfo, AddressInfo } from "./blockfrost";

// Event payload types
export interface NewTransactionsEvent {
  address: string;
  count: number;
  transactions: string[];
}

export interface TxStatusChangedEvent {
  txHash: string;
  oldStatus: string;
  newStatus: string;
  confirmations: number;
  blockNumber?: number;
}

export interface MempoolEvent {
  eventType: "ENTERED" | "LEFT" | "UPDATED";
  txHash: string;
  watchType: string;
  matchedCriteria: any;
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
  config: getConfig,
};
