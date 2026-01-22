/** 
 * Input Validators
 * Validation functions for common blockchain data types
 */

/**
 * Validate transaction hash (64 character hex string for Blake2b-256)
 * @param hash - The transaction hash to validate
 * @returns {boolean} True if valid
 */
export function isTxHash(hash: unknown): boolean {
  if (typeof hash !== 'string') return false;
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Validate block hash (64 character hex string for Blake2b-256)
 * @param hash - The block hash to validate
 * @returns {boolean} True if valid
 */
export function isBlockHash(hash: unknown): boolean {
  if (typeof hash !== 'string') return false;
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Validate Cardano Bech32 address
 * Note: Cardano addresses are always lowercase per convention, so this
 * validator intentionally only accepts lowercase characters.
 * @param address - The address to validate
 * @returns {boolean} True if valid
 */
export function isValidBech32Address(address: unknown): boolean {
  if (typeof address !== 'string') return false;

  // Basic Bech32 pattern for Cardano addresses
  // addr1 (mainnet) or addr_test1 (testnet) followed by lowercase alphanumeric characters
  const bech32Pattern = /^(addr1|addr_test1)[a-z0-9]{53,98}$/;

  return bech32Pattern.test(address);
}

/**
 * Validate network type
 * @param network - The network to validate
 * @returns {boolean} True if valid
 */
export function isValidNetwork(network: unknown): boolean {
  if (typeof network !== 'string') return false;
  
  const validNetworks = ['mainnet', 'preview', 'preprod'];
  return validNetworks.includes(network.toLowerCase());
}

/**
 * Validate epoch number
 * @param epoch - The epoch number to validate
 * @returns {boolean} True if valid
 */
export function isEpochNumber(epoch: unknown): boolean {
  if (typeof epoch !== 'number') return false;
  return Number.isInteger(epoch) && epoch >= 0;
}

/**
 * Validate positive integer
 * @param value - The value to validate
 * @returns {boolean} True if valid
 */
export function isPositiveInteger(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  return Number.isInteger(value) && value > 0;
}

/**
 * Validate non-negative integer
 * @param value - The value to validate
 * @returns {boolean} True if valid
 */
export function isNonNegativeInteger(value: unknown): boolean {
  if (typeof value !== 'number') return false;
  return Number.isInteger(value) && value >= 0;
}

/**
 * Validate string not empty
 * @param value - The value to validate
 * @returns {boolean} True if valid
 */
export function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
