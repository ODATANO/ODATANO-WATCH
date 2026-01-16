import cds from "@sap/cds";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";

export interface TransactionData {
  txHash: string;
  blockNumber: number;
  blockHash: string;
  sender: string | null;
  receiver: string | null;
  amount: number;
  fee: number;
  metadata: any;
  assets: any[];
  timestamp?: number;
}

export interface BlockInfo {
  height: number;
  hash: string;
  time: number;
  slot: number;
}

export interface AddressInfo {
  address: string;
  balance: number;
  stakeAddress: string | null;
  type: string;
}

const COMPONENT_NAME = "/cardanoWatcher/blockfrost";

let blockfrostClient: any = null;

/**
 * Initialize Blockfrost client
 */
export function initializeClient(config: any): any {
  if (blockfrostClient) {
    return blockfrostClient;
  }

  try {
    blockfrostClient = new BlockFrostAPI({
      projectId: config.blockfrostProjectId || config.blockfrostApiKey,
      network: config.network === "mainnet" ? "mainnet" : config.network,
    });

    cds.log(COMPONENT_NAME).info("Blockfrost client initialized", {
      network: config.network,
    });

    return blockfrostClient;
  } catch (err) {
    cds.log(COMPONENT_NAME).warn(
      "Blockfrost not available. Install @blockfrost/blockfrost-js to use Blockfrost integration"
    );
    return null;
  }
}

/**
 * Fetch transactions for a specific address
 */
export async function fetchAddressTransactions(
  address: string,
  fromBlock: number | null = null
): Promise<TransactionData[]> {
  if (!blockfrostClient) {
    return [];
  }

  const logger = cds.log(COMPONENT_NAME);

  try {
    logger.debug(`Fetching transactions for address: ${address}`);

    const transactions = await blockfrostClient.addressesTransactions(
      address,
      {
        order: "asc",
        count: 100,
      }
    );

    if (!transactions || transactions.length === 0) {
      return [];
    }

    logger.debug(`Found ${transactions.length} transactions`);

    const parsedTxs: TransactionData[] = [];
    for (const tx of transactions) {
      try {
        const txDetails = await blockfrostClient.txs(tx.tx_hash);
        const txUtxos = await blockfrostClient.txsUtxos(tx.tx_hash);

        if (fromBlock && txDetails.block_height <= fromBlock) {
          continue;
        }

        const sender = txUtxos.inputs[0]?.address || null;
        const receiver = txUtxos.outputs[0]?.address || null;
        const amount = txUtxos.outputs[0]?.amount
          ? parseFloat(txUtxos.outputs[0].amount.find((a: any) => a.unit === "lovelace")?.quantity || 0) / 1000000
          : 0;

        const assets = txUtxos.outputs.flatMap((output: any) => 
          output.amount.filter((a: any) => a.unit !== "lovelace")
        );

        let metadata = null;
        try {
          if (txDetails.metadata_count > 0) {
            const txMetadata = await blockfrostClient.txsMetadata(tx.tx_hash);
            metadata = txMetadata;
          }
        } catch (metaErr) {
          logger.debug(`No metadata for tx ${tx.tx_hash}`);
        }

        parsedTxs.push({
          txHash: tx.tx_hash,
          blockNumber: txDetails.block_height,
          blockHash: txDetails.block,
          sender,
          receiver,
          amount,
          fee: parseFloat(txDetails.fees) / 1000000,
          metadata,
          assets,
          timestamp: txDetails.block_time,
        });

      } catch (txErr) {
        logger.error(`Error fetching details for tx ${tx.tx_hash}:`, txErr);
      }
    }

    return parsedTxs;

  } catch (err) {
    logger.error(`Error fetching transactions for ${address}:`, err);
    throw err;
  }
}

/**
 * Get latest block information
 */
export async function getLatestBlock(): Promise<BlockInfo | null> {
  if (!blockfrostClient) {
    return null;
  }

  try {
    const block = await blockfrostClient.blocksLatest();
    return {
      height: block.height,
      hash: block.hash,
      time: block.time,
      slot: block.slot,
    };
  } catch (err) {
    cds.log(COMPONENT_NAME).error("Error fetching latest block:", err);
    throw err;
  }
}

/**
 * Get address information
 */
export async function getAddressInfo(address: string): Promise<AddressInfo | null> {
  if (!blockfrostClient) {
    return null;
  }

  try {
    const info = await blockfrostClient.addresses(address);
    return {
      address: info.address,
      balance: parseFloat(info.amount.find((a: any) => a.unit === "lovelace")?.quantity || 0) / 1000000,
      stakeAddress: info.stake_address,
      type: info.type,
    };
  } catch (err) {
    cds.log(COMPONENT_NAME).error(`Error fetching address info for ${address}:`, err);
    throw err;
  }
}

/**
 * Verify if Blockfrost is available and configured
 */
export function isAvailable(): boolean {
  return blockfrostClient !== null;
}
