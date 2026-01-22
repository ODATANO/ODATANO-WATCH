import {
  isTxHash,
  isBlockHash,
  isValidBech32Address,
  isValidNetwork,
  isEpochNumber,
  isPositiveInteger,
  isNonNegativeInteger,
  isNonEmptyString,
} from '../../srv/utils/validators';

describe('Validators', () => {
  
  describe('isTxHash', () => {
    it('should return true for valid 64-char hex transaction hash', () => {
      expect(isTxHash('2b8216b428b5292a4b13075cf37b26434f890a4ffcce1f75da1f85d2297efe83')).toBe(true);
      expect(isTxHash('CB082E3E77A7D8CF56BAABA5CBE8843D63B53FA41074557ED29E0DBFE7DAAB39')).toBe(true);
      expect(isTxHash('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789')).toBe(true);
    });

    it('should return false for invalid transaction hash', () => {
      expect(isTxHash('invalid')).toBe(false);
      expect(isTxHash('2b8216b428b5292a')).toBe(false); // too short
      expect(isTxHash('2b8216b428b5292a4b13075cf37b26434f890a4ffcce1f75da1f85d2297efe83XX')).toBe(false); // 66 chars
      expect(isTxHash('zb8216b428b5292a4b13075cf37b26434f890a4ffcce1f75da1f85d2297efe83')).toBe(false); // invalid char
      expect(isTxHash(123)).toBe(false); // not a string
      expect(isTxHash(null)).toBe(false);
      expect(isTxHash(undefined)).toBe(false);
      expect(isTxHash({})).toBe(false);
      expect(isTxHash([])).toBe(false);
    });
  });

  describe('isBlockHash', () => {
    it('should return true for valid 64-char hex block hash', () => {
      expect(isBlockHash('2b8216b428b5292a4b13075cf37b26434f890a4ffcce1f75da1f85d2297efe83')).toBe(true);
      expect(isBlockHash('CB082E3E77A7D8CF56BAABA5CBE8843D63B53FA41074557ED29E0DBFE7DAAB39')).toBe(true);
    });

    it('should return false for invalid block hash', () => {
      expect(isBlockHash('invalid')).toBe(false);
      expect(isBlockHash('2b8216b428')).toBe(false);
      expect(isBlockHash(123)).toBe(false);
      expect(isBlockHash(null)).toBe(false);
      expect(isBlockHash(undefined)).toBe(false);
    });
  });

  describe('isValidBech32Address', () => {
    it('should return true for valid Cardano mainnet addresses', () => {
      // Addresses need to be correct length (53-98 chars after prefix)
      const validMainnet = 'addr1' + 'q'.repeat(98); // 102 chars total
      expect(isValidBech32Address(validMainnet)).toBe(true);
    });

    it('should return true for valid Cardano testnet addresses', () => {
      expect(isValidBech32Address('addr_test1vqm5vyp8xztmxyl6mcr2xr5schajvsq8fjs8gn8g2zu0pgg8gckcp')).toBe(true);
      expect(isValidBech32Address('addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isValidBech32Address('invalid')).toBe(false);
      expect(isValidBech32Address('ADDR1xyz')).toBe(false); // uppercase
      expect(isValidBech32Address('addr2xyz123')).toBe(false); // wrong prefix
      expect(isValidBech32Address('addr_test1')).toBe(false); // too short
      expect(isValidBech32Address('addr1')).toBe(false);
      expect(isValidBech32Address(123)).toBe(false);
      expect(isValidBech32Address(null)).toBe(false);
      expect(isValidBech32Address(undefined)).toBe(false);
      expect(isValidBech32Address({})).toBe(false);
    });
  });

  describe('isValidNetwork', () => {
    it('should return true for valid networks', () => {
      expect(isValidNetwork('mainnet')).toBe(true);
      expect(isValidNetwork('preprod')).toBe(true);
      expect(isValidNetwork('preview')).toBe(true);
      expect(isValidNetwork('MAINNET')).toBe(true); // case insensitive
    });

    it('should return false for invalid networks', () => {
      expect(isValidNetwork('testnet')).toBe(false); // not in valid list
      expect(isValidNetwork('invalid')).toBe(false);
      expect(isValidNetwork('production')).toBe(false);
      expect(isValidNetwork('')).toBe(false);
      expect(isValidNetwork(123)).toBe(false);
      expect(isValidNetwork(null)).toBe(false);
      expect(isValidNetwork(undefined)).toBe(false);
    });
  });

  describe('isEpochNumber', () => {
    it('should return true for valid epoch numbers', () => {
      expect(isEpochNumber(0)).toBe(true);
      expect(isEpochNumber(1)).toBe(true);
      expect(isEpochNumber(500)).toBe(true);
      expect(isEpochNumber(999999)).toBe(true);
    });

    it('should return false for invalid epoch numbers', () => {
      expect(isEpochNumber(-1)).toBe(false);
      expect(isEpochNumber(1.5)).toBe(false);
      expect(isEpochNumber('500')).toBe(false);
      expect(isEpochNumber(NaN)).toBe(false);
      expect(isEpochNumber(Infinity)).toBe(false);
      expect(isEpochNumber(null)).toBe(false);
      expect(isEpochNumber(undefined)).toBe(false);
      expect(isEpochNumber({})).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger(999999)).toBe(true);
    });

    it('should return false for non-positive integers', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger('1')).toBe(false);
      expect(isPositiveInteger(NaN)).toBe(false);
      expect(isPositiveInteger(null)).toBe(false);
      expect(isPositiveInteger(undefined)).toBe(false);
    });
  });

  describe('isNonNegativeInteger', () => {
    it('should return true for non-negative integers', () => {
      expect(isNonNegativeInteger(0)).toBe(true);
      expect(isNonNegativeInteger(1)).toBe(true);
      expect(isNonNegativeInteger(100)).toBe(true);
    });

    it('should return false for negative or non-integer values', () => {
      expect(isNonNegativeInteger(-1)).toBe(false);
      expect(isNonNegativeInteger(1.5)).toBe(false);
      expect(isNonNegativeInteger('0')).toBe(false);
      expect(isNonNegativeInteger(NaN)).toBe(false);
      expect(isNonNegativeInteger(null)).toBe(false);
      expect(isNonNegativeInteger(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
      expect(isNonEmptyString(' x ')).toBe(true);
    });

    it('should return false for empty or whitespace strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString(' ')).toBe(false);
      expect(isNonEmptyString('  \t\n  ')).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });
});
