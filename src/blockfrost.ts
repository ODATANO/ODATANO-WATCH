import cds from "@sap/cds";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { handleBackendRequest } from "../srv/utils/backend-request-handler";

interface BlockfrostAmount {
  unit: string;
  quantity: string;
}

export interface TransactionInfo {
  txHash: string;
  blockHash: string;
  blockHeight: number;
  amount: number;
  fee: number;
  confirmations: number;
  lastSeen: number; // Unix timestamp from Blockfrost
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

const logger = cds.log("ODATANO-WATCH");

let blockfrostClient: BlockFrostAPI | null = null;

/**
 * Initialize Blockfrost client
 */
export function initializeClient(config: { blockfrostApiKey?: string; network?: string }): BlockFrostAPI {
  if (blockfrostClient) {
    return blockfrostClient;
  }

  try {
    blockfrostClient = new BlockFrostAPI({
      projectId: config.blockfrostApiKey!,
      network: config.network as 'mainnet' | 'preprod' | 'preview',
    });

    logger.debug("Blockfrost client initialized", {
      network: config.network,
      projectId: config.blockfrostApiKey?.substring(0, 10) + "..."
    });

    return blockfrostClient;
  } catch (err) {
    logger.error("Failed to initialize Blockfrost client:", err);
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

  if (!blockfrostClient) {
    return null;
  }

  return handleBackendRequest(async () => {
    logger.debug(`Fetching transactions for address: ${address}`);

    const transactions = await blockfrostClient!.addressesTransactions(
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

    // Fetch latest block once outside the loop for efficiency
    const latestBlock = await blockfrostClient!.blocksLatest();
    const latestBlockHeight = latestBlock.height ?? 0;

    const parsedTxs: TransactionInfo[] = [];
    for (const tx of transactions) {
      try {
        const txDetails = await blockfrostClient!.txs(tx.tx_hash);
        const txUtxos = await blockfrostClient!.txsUtxos(tx.tx_hash);

        if (fromBlock && txDetails.block_height <= fromBlock) {
          continue;
        }

        const amount = txUtxos.outputs[0]?.amount
          ? parseFloat(txUtxos.outputs[0].amount.find((a: BlockfrostAmount) => a.unit === "lovelace")?.quantity || "0") / 1000000
          : 0;

        const confirmations = latestBlockHeight - txDetails.block_height;

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
  }, "Blockfrost");
}

/**
 * Get latest block information
 */
export async function getLatestBlock(): Promise<BlockInfo | null> {
  if (!blockfrostClient) {
    return null;
  }

  return handleBackendRequest(async () => {
    const block = await blockfrostClient!.blocksLatest();
    return {
      height: block.height ?? 0,
      hash: block.hash,
      time: block.time ?? 0,
      slot: block.slot ?? 0,
    };
  }, "Blockfrost");
}

/**
 * Get address information
 */
export async function getAddressInfo(address: string): Promise<AddressInfo | null> {
  if (!blockfrostClient) {
    return null;
  }

  return handleBackendRequest(async () => {
    const info = await blockfrostClient!.addresses(address);
    
    const transactions = await fetchAddressTransactions(address);

    return {
      address: info.address,
      balance: parseFloat(info.amount.find((a: BlockfrostAmount) => a.unit === "lovelace")?.quantity || "0") / 1000000,
      stakeAddress: info.stake_address,
      type: info.type,
      transactions: transactions || [],
    };
  }, "Blockfrost");
}

export async function getTransaction(hash: string): Promise<TransactionInfo | null> {
  if (!blockfrostClient) {
    return null;
  }
  
  return handleBackendRequest(async () => {
    const tx = await blockfrostClient!.txs(hash);

    // Get latest block to calculate confirmations
    const latestBlock = await blockfrostClient!.blocksLatest();
    const latestBlockHeight = latestBlock.height ?? 0;
    const confirmations = latestBlockHeight - tx.block_height;

    return {
      txHash: tx.hash,
      blockHash: tx.block,
      blockHeight: tx.block_height,
      amount: parseFloat(tx.output_amount.find((a: BlockfrostAmount) => a.unit === "lovelace")?.quantity || "0") / 1000000,
      fee: parseFloat(tx.fees) / 1000000,
      confirmations,
      lastSeen: tx.block_time,
    };
  }, "Blockfrost").catch(err => {
    // Transaction might not be on chain yet or be in mempool
    logger.debug(`Transaction ${hash} not found:`, err);
    return null;
  });
}

/**
 * Verify if Blockfrost is available and configured
 */
export function isAvailable(): boolean {
  return blockfrostClient !== null;
}
