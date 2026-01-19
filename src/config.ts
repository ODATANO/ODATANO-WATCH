import cds from "@sap/cds";
import { config as loadEnv } from "dotenv";
import { env } from "process";

// Load .env file if present
// This allows environment variables to be set from a .env file during development and testing
// because cds.env loads .env files after this module is loaded.
loadEnv({ quiet: true });

export interface PollingConfig {
  enabled: boolean;
  interval: number; // in seconds
}

const logger = cds.log("ODATANO-WATCH");

export interface CardanoWatcherConfig {
  network?: "mainnet" | "preview" | "preprod";
  blockfrostApiKey?: string;
  autoStart?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  // Individual polling configurations
  addressPolling?: PollingConfig;        // Monitor watched addresses for new transactions
  transactionPolling?: PollingConfig;    // Check if submitted transactions are in the network
}

/**
 * Load configuration from cds.env or environment variables
 */
function loadInitialConfig(): CardanoWatcherConfig {
  // Try to get config from cds.env.requires.watch
  const cdsConfig = cds.env?.requires?.watch;

  if (!cdsConfig) {
    logger.debug("No cds.env.requires.watch configuration found, falling back to environment variables");
  }
  // Resolve apiKey: prefer CDS config, fallback to env variable (for plugin development only)
  let apiKey = cdsConfig?.blockfrostApiKey ?? env.BLOCKFROST_KEY;
  
  return {
    network: cdsConfig?.network ?? "preview",
    blockfrostApiKey: apiKey,
    autoStart: cdsConfig?.autoStart ?? true,
    maxRetries: cdsConfig?.maxRetries ?? 3,
    retryDelay: cdsConfig?.retryDelay ?? 5000,
    
    // Individual polling configs with sensible defaults
    addressPolling: {
      enabled: cdsConfig?.addressPolling?.enabled !== undefined ? cdsConfig.addressPolling.enabled : true,
      interval: cdsConfig?.addressPolling?.interval ?? 60,
    },
    transactionPolling: {
      enabled: cdsConfig?.transactionPolling?.enabled !== undefined ? cdsConfig.transactionPolling.enabled : true,
      interval: cdsConfig?.transactionPolling?.interval ?? 60,
    },
  };
}

let configuration: CardanoWatcherConfig = loadInitialConfig();

/**
 * Initialize configuration with options
 * @param options Configuration options
 * @returns void 
 */
export function initialize(options: CardanoWatcherConfig = {}): void {
  configuration = {
    ...configuration,
    ...options,
  };

  validateConfiguration();
}

/**
 * Validate configuration
 */
function validateConfiguration(): void {
  const validNetworks = ["mainnet", "preview", "preprod"];
  logger.debug(`Validating configuration for network: ${configuration.network}`);
  if (!validNetworks.includes(configuration.network!)) {
    throw new Error(`Invalid network: ${configuration.network}. Must be one of: ${validNetworks.join(", ")}`);
  }

  if (!configuration.blockfrostApiKey) {
    logger.warn(
      "No Blockfrost API key configured. Set blockfrostApiKey in cds.env.requires.watch configuration"
    );
  }
}

/**
 * Get current configuration
 */
export function get(): CardanoWatcherConfig {
  return { ...configuration };
}

/**
 * Update configuration
 */
export function update(updates: Partial<CardanoWatcherConfig>): void {
  configuration = {
    ...configuration,
    ...updates,
  };
  validateConfiguration();
}
