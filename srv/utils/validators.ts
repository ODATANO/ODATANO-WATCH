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
 * @param address - The address to validate
 * @returns {boolean} True if valid
 */
export function isValidBech32Address(address: unknown): boolean {
  if (typeof address !== 'string') return false;
  
  // Basic Bech32 pattern for Cardano addresses
  // addr1 or addr_test1 followed by alphanumeric characters
  const bech32Pattern = /^(addr1|addr_test1)[a-z0-9]{53,98}$/;
  
  return bech32Pattern.test(address);
}

/**
 * Validate Cardano Bech32 stake address
 * @param stakeAddress - The stake address to validate
 * @returns {boolean} True if valid
 */
export function isValidBech32StakeAddress(stakeAddress: unknown): boolean {
  if (typeof stakeAddress !== 'string') return false;
  
  // Stake addresses start with stake1 or stake_test1
  const stakePattern = /^(stake1|stake_test1)[a-z0-9]{53}$/;
  
  return stakePattern.test(stakeAddress);
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
 * Validate pool ID
 * @param poolId - The pool ID to validate
 * @returns {boolean} True if valid
 */
export function isValidPoolId(poolId: unknown): boolean {
  if (typeof poolId !== 'string') return false;
  
  // Pool IDs are Bech32 encoded with 'pool' prefix
  const poolPattern = /^pool1[a-z0-9]{51}$/;
  
  return poolPattern.test(poolId);
}

/**
 * Validate DRep ID
 * @param drepId - The drep ID to validate
 * @returns {boolean} True if valid
 */
export function isValidDrepId(drepId: unknown): boolean {
  if (typeof drepId !== 'string') return false;
  
  // DRep IDs are Bech32 encoded with 'drep' prefix
  const drepPattern = /^drep1[a-z0-9]{51}$/;
  
  return drepPattern.test(drepId);
}

/**
 * Validate CBOR hex string
 * @param cbor - The CBOR string to validate
 * @returns {boolean} True if valid
 */
export function isValidCbor(cbor: unknown): boolean {
  if (typeof cbor !== 'string') return false;
  
  // CBOR is hex-encoded, so it should be even length and contain only hex characters
  return /^[a-f0-9]+$/i.test(cbor) && cbor.length % 2 === 0 && cbor.length > 0;
}

/**
 * Validate address (allows both payment and stake addresses)
 * @param address - The address to validate
 * @returns {boolean} True if valid
 */
export function isValidAddress(address: unknown): boolean {
  return isValidBech32Address(address) || isValidBech32StakeAddress(address);
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
