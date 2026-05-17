/**
 * Unit tests for ogmios.ts (Ogmios ChainSync client wrapper)
 *
 * ogmios.ts owns module-level singleton state (config, client, reconnect timer).
 * We use jest.isolateModules per test so each case gets a fresh module
 * with no leaked state from previous tests.
 */
import { jest } from '@jest/globals';

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@sap/cds', () => ({
  log: jest.fn(() => mockLogger),
  default: { log: jest.fn(() => mockLogger) },
}));

const mockOgmiosClient = {
  createInteractionContext: jest.fn<any>(),
  createChainSynchronizationClient: jest.fn<any>(),
};
jest.mock('@cardano-ogmios/client', () => mockOgmiosClient);

type OgmiosModule = typeof import('../../src/ogmios');

function loadFresh(): OgmiosModule {
  let mod!: OgmiosModule;
  jest.isolateModules(() => {
    mod = require('../../src/ogmios');
  });
  return mod;
}

describe('Ogmios Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: createInteractionContext + createChainSynchronizationClient succeed.
    mockOgmiosClient.createInteractionContext.mockResolvedValue({});
    mockOgmiosClient.createChainSynchronizationClient.mockResolvedValue({
      resume: jest.fn<any>().mockResolvedValue({ intersection: 'origin' }),
      shutdown: jest.fn<any>().mockResolvedValue(undefined),
    });
  });

  // -------------------------------------------------------------------------
  // initializeClient
  // -------------------------------------------------------------------------
  describe('initializeClient', () => {
    it('rejects an http:// URL', () => {
      const ogmios = loadFresh();
      expect(() =>
        ogmios.initializeClient({ url: 'http://localhost:1337', network: 'preview' }),
      ).toThrow(/Invalid Ogmios URL/);
    });

    it('rejects an empty URL', () => {
      const ogmios = loadFresh();
      expect(() =>
        ogmios.initializeClient({ url: '', network: 'preview' }),
      ).toThrow(/Invalid Ogmios URL/);
    });

    it('accepts ws:// URLs', () => {
      const ogmios = loadFresh();
      expect(() =>
        ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'mainnet' }),
      ).not.toThrow();
      expect(ogmios.isAvailable()).toBe(true);
    });

    it('accepts wss:// URLs', () => {
      const ogmios = loadFresh();
      expect(() =>
        ogmios.initializeClient({ url: 'wss://ogmios.example/v1', network: 'preprod' }),
      ).not.toThrow();
      expect(ogmios.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------
  describe('isAvailable', () => {
    it('returns false before init', () => {
      const ogmios = loadFresh();
      expect(ogmios.isAvailable()).toBe(false);
    });

    it('returns true after init', () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://x', network: 'preview' });
      expect(ogmios.isAvailable()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // start
  // -------------------------------------------------------------------------
  describe('start', () => {
    const handlers = {
      rollForward: jest.fn<any>().mockResolvedValue(undefined),
      rollBackward: jest.fn<any>().mockResolvedValue(undefined),
    };

    it('throws when not initialized', async () => {
      const ogmios = loadFresh();
      await expect(ogmios.start(null, handlers)).rejects.toThrow(/not initialized/);
    });

    it('connects and resumes from origin when cursor is null', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

      const resume = jest.fn<any>().mockResolvedValue({ intersection: 'origin' });
      mockOgmiosClient.createChainSynchronizationClient.mockResolvedValueOnce({
        resume,
        shutdown: jest.fn<any>().mockResolvedValue(undefined),
      });

      await ogmios.start(null, handlers);

      expect(mockOgmiosClient.createInteractionContext).toHaveBeenCalledTimes(1);
      expect(resume).toHaveBeenCalledWith(['origin']);
    });

    it('passes cursor point plus origin fallback when cursor is provided', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

      const resume = jest.fn<any>().mockResolvedValue({
        intersection: { slot: 100, id: 'abc' },
      });
      mockOgmiosClient.createChainSynchronizationClient.mockResolvedValueOnce({
        resume,
        shutdown: jest.fn<any>().mockResolvedValue(undefined),
      });

      await ogmios.start({ slot: 100, blockHash: 'abc' }, handlers);

      expect(resume).toHaveBeenCalledWith([{ slot: 100, id: 'abc' }, 'origin']);
    });

    it('is a no-op when chainSync is already started', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

      await ogmios.start(null, handlers);
      jest.clearAllMocks();

      await ogmios.start(null, handlers);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already started'),
      );
      expect(mockOgmiosClient.createInteractionContext).not.toHaveBeenCalled();
    });

    it('builds an http URL by stripping ws prefix for the context', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'wss://example.com/v1', network: 'mainnet' });

      await ogmios.start(null, handlers);

      const ctxOpts: any = mockOgmiosClient.createInteractionContext.mock.calls[0]?.[2];
      expect(ctxOpts.connection.address.webSocket).toBe('wss://example.com/v1');
      expect(ctxOpts.connection.address.http).toBe('https://example.com/v1');
    });

    it('throws after exhausting maxRetries', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({
        url: 'ws://localhost:1337',
        network: 'preview',
        maxRetries: 2,
        retryDelayMs: 1, // backoff floors at 250ms anyway; sleep is awaited real-time
      });

      mockOgmiosClient.createInteractionContext.mockRejectedValue(
        new Error('connection refused'),
      );

      await expect(ogmios.start(null, handlers)).rejects.toThrow('connection refused');

      // 2 attempts before the throw.
      expect(mockOgmiosClient.createInteractionContext).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('max retries (2) exhausted'),
      );
    }, 10000);

    it('invokes user handlers on rollForward / rollBackward callbacks', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

      let registeredHandlers: any = null;
      mockOgmiosClient.createChainSynchronizationClient.mockImplementationOnce(
        (_ctx: unknown, h: any) => {
          registeredHandlers = h;
          return Promise.resolve({
            resume: jest.fn<any>().mockResolvedValue({ intersection: 'origin' }),
            shutdown: jest.fn<any>().mockResolvedValue(undefined),
          });
        },
      );

      const userHandlers = {
        rollForward: jest.fn<any>().mockResolvedValue(undefined),
        rollBackward: jest.fn<any>().mockResolvedValue(undefined),
      };
      await ogmios.start(null, userHandlers);

      // Simulate the Ogmios client invoking the registered callbacks.
      const next = jest.fn();
      await registeredHandlers.rollForward(
        { block: { slot: 1 }, tip: 'origin' },
        next,
      );
      await registeredHandlers.rollBackward(
        { point: 'origin', tip: 'origin' },
        next,
      );

      expect(userHandlers.rollForward).toHaveBeenCalledWith({ slot: 1 }, 'origin', next);
      expect(userHandlers.rollBackward).toHaveBeenCalledWith('origin', 'origin', next);
    });
  });

  // -------------------------------------------------------------------------
  // shutdown
  // -------------------------------------------------------------------------
  describe('shutdown', () => {
    it('is safe to call before start', async () => {
      const ogmios = loadFresh();
      await expect(ogmios.shutdown()).resolves.toBeUndefined();
    });

    it('calls client.shutdown when running', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

      const shutdownSpy = jest.fn<any>().mockResolvedValue(undefined);
      mockOgmiosClient.createChainSynchronizationClient.mockResolvedValueOnce({
        resume: jest.fn<any>().mockResolvedValue({ intersection: 'origin' }),
        shutdown: shutdownSpy,
      });

      await ogmios.start(null, {
        rollForward: jest.fn<any>().mockResolvedValue(undefined),
        rollBackward: jest.fn<any>().mockResolvedValue(undefined),
      });
      await ogmios.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('swallows client.shutdown errors with a warning', async () => {
      const ogmios = loadFresh();
      ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

      const shutdownSpy = jest.fn<any>().mockRejectedValue(new Error('boom'));
      mockOgmiosClient.createChainSynchronizationClient.mockResolvedValueOnce({
        resume: jest.fn<any>().mockResolvedValue({ intersection: 'origin' }),
        shutdown: shutdownSpy,
      });

      await ogmios.start(null, {
        rollForward: jest.fn<any>().mockResolvedValue(undefined),
        rollBackward: jest.fn<any>().mockResolvedValue(undefined),
      });
      await expect(ogmios.shutdown()).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Ogmios shutdown error'),
        expect.any(Error),
      );
    });
  });

  // -------------------------------------------------------------------------
  // reconnect / close handler
  // -------------------------------------------------------------------------
  describe('close handler', () => {
    it('schedules a reconnect when the websocket closes', async () => {
      jest.useFakeTimers();
      try {
        const ogmios = loadFresh();
        ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

        let capturedOnClose: ((code: number, reason: string) => void) | null = null;
        mockOgmiosClient.createInteractionContext.mockImplementationOnce(
          (_onErr: unknown, onClose: any) => {
            capturedOnClose = onClose;
            return Promise.resolve({});
          },
        );

        await ogmios.start(null, {
          rollForward: jest.fn<any>().mockResolvedValue(undefined),
          rollBackward: jest.fn<any>().mockResolvedValue(undefined),
        });

        expect(capturedOnClose).not.toBeNull();

        // Trigger the close → should warn and schedule a reconnect timer.
        capturedOnClose!(1006, 'abnormal');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('WebSocket closed'),
        );
        // The reconnect timer fires after backoff(1, retryDelayMs). With
        // retryDelayMs default 1000 → backoff floors at 1000; first attempt
        // floors at 250ms minimum. We just verify a timer was scheduled.
        expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1);

        // Drain by calling shutdown so the timer is cleared.
        await ogmios.shutdown();
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not schedule reconnect if stop was already requested', async () => {
      jest.useFakeTimers();
      try {
        const ogmios = loadFresh();
        ogmios.initializeClient({ url: 'ws://localhost:1337', network: 'preview' });

        let capturedOnClose: ((code: number, reason: string) => void) | null = null;
        mockOgmiosClient.createInteractionContext.mockImplementationOnce(
          (_onErr: unknown, onClose: any) => {
            capturedOnClose = onClose;
            return Promise.resolve({});
          },
        );

        await ogmios.start(null, {
          rollForward: jest.fn<any>().mockResolvedValue(undefined),
          rollBackward: jest.fn<any>().mockResolvedValue(undefined),
        });
        await ogmios.shutdown();

        const timersBefore = jest.getTimerCount();
        capturedOnClose!(1000, '');

        expect(jest.getTimerCount()).toBe(timersBefore);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
