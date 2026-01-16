import cds from "@sap/cds";

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

 let configuration: CardanoWatcherConfig = {
  network: "mainnet",
  blockfrostApiKey: undefined,
  blockfrostProjectId: undefined,
  autoStart: true,
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 100,
  enableWebhooks: false,
  webhookEndpoint: undefined,
  
  // Individual polling configs with sensible defaults
  addressPolling: {
    enabled: true,
    interval: 30, // Check watched addresses every 30s
  },
  transactionPolling: {
    enabled: true,
    interval: 60, // Check submitted transactions every 60s
  },
};

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
      "No Blockfrost API key configured. Configure via cds.env.cardanoWatcher"
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
