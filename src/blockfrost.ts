import cds from "@sap/cds";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { CdsTimestamp } from "../@cds-models/_";

export interface TransactionInfo {
  txHash: string;
  blockHash: string;
  blockHeight: number;
  amount: number;
  fee: number;
  confirmations: number;
  lastSeen: CdsTimestamp;
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
  transactions?: TransactionInfo[];
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
      network: config.network,
    });

    cds.log(COMPONENT_NAME).info("Blockfrost client initialized", {
      network: config.network,
      projectId: (config.blockfrostProjectId || config.blockfrostApiKey)?.substring(0, 10) + "..."
    });

    return blockfrostClient;
  } catch (err) {
    cds.log(COMPONENT_NAME).error("Failed to initialize Blockfrost client:", err);
    throw err;
  }
}

/**
 * Fetch transactions for a specific address
 */
export async function fetchAddressTransactions(
  address: string,
  fromBlock: number | null = null
): Promise<TransactionInfo[] | null> {

  const logger = cds.log(COMPONENT_NAME);
  
  if (!blockfrostClient) {
    return null;
  }

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
      return null;
    }

    logger.debug(`Found ${transactions.length} transactions`);

    const parsedTxs: TransactionInfo[] = [];
    for (const tx of transactions) {
      try {
        const txDetails = await blockfrostClient.txs(tx.tx_hash);
        const txUtxos = await blockfrostClient.txsUtxos(tx.tx_hash);

        if (fromBlock && txDetails.block_height <= fromBlock) {
          continue;
        }

        const amount = txUtxos.outputs[0]?.amount
          ? parseFloat(txUtxos.outputs[0].amount.find((a: any) => a.unit === "lovelace")?.quantity || 0) / 1000000
          : 0;

        const latestBlock = await blockfrostClient.blocksLatest();
        
        const confirmations = latestBlock.height - txDetails.block_height;

        parsedTxs.push({
          txHash: tx.tx_hash,
          blockHeight: txDetails.block_height,
          blockHash: txDetails.block,
          amount,
          fee: parseFloat(txDetails.fees) / 1000000,
          lastSeen: txDetails.block_time,
          confirmations,
        });

      } catch (txErr) {
        logger.error(`Error fetching details for tx ${tx.tx_hash}:`, txErr);
      }
    }

    return parsedTxs.length > 0 ? parsedTxs : null;

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
    
    const transactions = await fetchAddressTransactions(address);

    return {
      address: info.address,
      balance: parseFloat(info.amount.find((a: any) => a.unit === "lovelace")?.quantity || 0) / 1000000,
      stakeAddress: info.stake_address,
      type: info.type,
      transactions: transactions || [],
    };
  } catch (err) {
    cds.log(COMPONENT_NAME).error(`Error fetching address info for ${address}:`, err);
    throw err;
  }
}

export async function getTransaction(hash: string): Promise<TransactionInfo | null> {
  if (!blockfrostClient) {
    return null;
  }
  
  try {
    const tx = await blockfrostClient.txs(hash);
    
    // Get latest block to calculate confirmations
    const latestBlock = await blockfrostClient.blocksLatest();
    const confirmations = latestBlock.height - tx.block_height;
    
    return {
      txHash: tx.hash,
      blockHash: tx.block,
      blockHeight: tx.block_height,
      amount: parseFloat(tx.output_amount.find((a: any) => a.unit === "lovelace")?.quantity || 0) / 1000000,
      fee: parseFloat(tx.fees) / 1000000,
      confirmations,
      lastSeen: tx.block_time,
    };
  } catch (err) {
    // Transaction might not be on chain yet or be in mempool
    cds.log(COMPONENT_NAME).debug(`Transaction ${hash} not found:`, err);
    return null;
  }
}

/**
 * Verify if Blockfrost is available and configured
 */
export function isAvailable(): boolean {
  return blockfrostClient !== null;
}
