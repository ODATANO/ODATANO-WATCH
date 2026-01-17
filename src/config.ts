import cds from "@sap/cds";
import { config as loadEnv } from "dotenv";
import { env } from "process";

// Load .env file
loadEnv();

export interface PollingConfig {
  enabled: boolean;
  interval: number; // in seconds
}

export interface CardanoWatcherConfig {
  network?: "mainnet" | "preview" | "preprod";
  blockfrostApiKey?: string;
  blockfrostProjectId?: string;
  autoStart?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  enableWebhooks?: boolean;
  webhookEndpoint?: string;
  
  // Individual polling configurations
  addressPolling?: PollingConfig;        // Monitor watched addresses for new transactions
  transactionPolling?: PollingConfig;    // Check if submitted transactions are in the network
}

/**
 * Resolve environment variable placeholders like ${env:VAR_NAME}
 */
function resolveEnvPlaceholder(value: any): any {
  if (typeof value !== 'string') return value;
  
  const match = value.match(/^\$\{env:([^}]+)\}$/);
  if (match) {
    const envVarName = match[1];
    return env[envVarName];
  }
  
  return value;
}

/**
 * Load configuration from cds.env or environment variables
 */
function loadInitialConfig(): CardanoWatcherConfig {
  // Try to get config from cds.env.requires.cardanoWatcher or cds.env.requires.watch
  const cdsConfig = cds.env?.requires?.cardanoWatcher || cds.env?.requires?.watch || {};
  
  // Resolve apiKey from cds.env or environment variable
  let apiKey = resolveEnvPlaceholder(cdsConfig.apiKey || cdsConfig.blockfrostApiKey) || env.BLOCKFROSTKEY;
  
  // Log for debugging
  console.log("[config] BLOCKFROSTKEY from env:", env.BLOCKFROSTKEY ? "SET (length: " + env.BLOCKFROSTKEY.length + ")" : "NOT SET");
  console.log("[config] BLOCKFROST_KEY from env:", env.BLOCKFROST_KEY ? "SET (length: " + env.BLOCKFROST_KEY.length + ")" : "NOT SET");
  console.log("[config] CDS config:", JSON.stringify(cdsConfig, null, 2));
  console.log("[config] Resolved apiKey:", apiKey ? "SET (length: " + apiKey.length + ")" : "NOT SET");
  
  return {
    network: cdsConfig.network || "preview",
    blockfrostApiKey: apiKey,
    blockfrostProjectId: cdsConfig.blockfrostProjectId || undefined,
    autoStart: cdsConfig.autoStart !== undefined ? cdsConfig.autoStart : true,
    maxRetries: cdsConfig.maxRetries || 3,
    retryDelay: cdsConfig.retryDelay || 5000,
    batchSize: cdsConfig.batchSize || 100,
    enableWebhooks: cdsConfig.enableWebhooks || false,
    webhookEndpoint: cdsConfig.webhookEndpoint || undefined,
    
    // Individual polling configs with sensible defaults
    addressPolling: {
      enabled: cdsConfig.addressPolling?.enabled !== undefined ? cdsConfig.addressPolling.enabled : true,
      interval: cdsConfig.addressPolling?.interval || 30,
    },
    transactionPolling: {
      enabled: cdsConfig.transactionPolling?.enabled !== undefined ? cdsConfig.transactionPolling.enabled : true,
      interval: cdsConfig.transactionPolling?.interval || 60,
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
  
  if (!validNetworks.includes(configuration.network!)) {
    throw new Error(`Invalid network: ${configuration.network}. Must be one of: ${validNetworks.join(", ")}`);
  }

  if (!configuration.blockfrostApiKey && !configuration.blockfrostProjectId) {
    cds.log("/cardanoWatcher/config").warn(
      "No Blockfrost API key configured. Set BLOCKFROSTKEY environment variable or configure via cds.env.cardanoWatcher"
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
