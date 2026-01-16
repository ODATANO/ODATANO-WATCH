import cds from "@sap/cds";

export interface CardanoWatcherConfig {
  network?: "mainnet" | "testnet" | "preview" | "preprod";
  pollingInterval?: number;
  blockfrostApiKey?: string;
  blockfrostProjectId?: string;
  autoStart?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  enableWebhooks?: boolean;
  webhookEndpoint?: string;
}

let configuration: CardanoWatcherConfig = {
  network: "mainnet",
  pollingInterval: 30,
  blockfrostApiKey: undefined,
  blockfrostProjectId: undefined,
  autoStart: true,
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 100,
  enableWebhooks: false,
  webhookEndpoint: undefined,
};

/**
 * Initialize configuration with options
 */
export function initialize(options: CardanoWatcherConfig = {}): void {
  const envConfig = (cds.env.cardanoWatcher as CardanoWatcherConfig) || {};
  
  configuration = {
    ...configuration,
    ...envConfig,
    ...options,
  };

  validateConfiguration();
}

/**
 * Validate configuration
 */
function validateConfiguration(): void {
  const validNetworks = ["mainnet", "testnet", "preview", "preprod"];
  
  if (!validNetworks.includes(configuration.network!)) {
    throw new Error(`Invalid network: ${configuration.network}. Must be one of: ${validNetworks.join(", ")}`);
  }

  if (configuration.pollingInterval! < 5) {
    throw new Error("Polling interval must be at least 5 seconds");
  }

  if (!configuration.blockfrostApiKey && !configuration.blockfrostProjectId) {
    cds.log("/cardanoWatcher/config").warn(
      "No Blockfrost API key configured. Set BLOCKFROST_API_KEY or configure via cds.env.cardanoWatcher"
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
