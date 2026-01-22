/**
 * Unit tests for config.ts
 */
import { jest } from '@jest/globals';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockCds = {
  log: jest.fn(() => mockLogger),
  env: {
    requires: {
      watch: {
        blockfrostApiKey: 'test-key',
        network: 'preview',
      },
    },
  },
};

jest.mock('@sap/cds', () => ({
  default: mockCds,
  ...mockCds,
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Import after mocks
import * as config from '../../src/config';

describe('Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get()', () => {
    it('should return configuration object', () => {
      const cfg = config.get();

      expect(cfg).toBeDefined();
      expect(cfg.network).toBeDefined();
      expect(cfg.blockfrostApiKey).toBeDefined();
    });
  });

  describe('initialize()', () => {
    it('should accept valid network configuration', () => {
      expect(() => {
        config.initialize({ network: 'mainnet' });
      }).not.toThrow();

      expect(() => {
        config.initialize({ network: 'preview' });
      }).not.toThrow();

      expect(() => {
        config.initialize({ network: 'preprod' });
      }).not.toThrow();
    });

    it('should throw error for invalid network', () => {
      expect(() => {
        config.initialize({ network: 'invalid' as any });
      }).toThrow('Invalid network: invalid. Must be one of: mainnet, preview, preprod');
    });

    it('should warn when no API key is configured', () => {
      config.initialize({ 
        network: 'preview',
        blockfrostApiKey: undefined 
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No Blockfrost API key configured. Set blockfrostApiKey in cds.env.requires.watch configuration'
      );
    });
  });

  describe('update()', () => {
    it('should update configuration', () => {
      config.update({ network: 'mainnet' });
      const cfg = config.get();

      expect(cfg.network).toBe('mainnet');
    });

    it('should validate after update', () => {
      expect(() => {
        config.update({ network: 'invalid-network' as any });
      }).toThrow('Invalid network');
    });
  });

  describe('validateConfiguration()', () => {
    it('should throw error for invalid network during initialization', () => {
      expect(() => {
        config.initialize({ network: 'testnet' as any });
      }).toThrow('Invalid network: testnet. Must be one of: mainnet, preview, preprod');
    });

    it('should log warning for missing API key during initialization', () => {
      jest.clearAllMocks();
      
      config.initialize({ 
        network: 'preview',
        blockfrostApiKey: '' 
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No Blockfrost API key configured. Set blockfrostApiKey in cds.env.requires.watch configuration'
      );
    });
  });
});
