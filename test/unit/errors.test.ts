/**
 * Unit tests for errors.ts and error-codes.ts
 */
import { ERROR_CODES } from '../../srv/utils/error-codes';
import {
  BackendError,
  NotFoundError,
  ProviderUnavailableError,
  RateLimitError,
  ConfigError,
  BackendInitError,
  normalizeBackendError,
  rejectInvalid,
  rejectMissing,
} from '../../srv/utils/errors';

describe('Error Codes', () => {
  describe('ERROR_CODES constants', () => {
    it('should have INVALID_INPUT code', () => {
      expect(ERROR_CODES.INVALID_INPUT).toBe('WATCHER_INVALID_INPUT');
    });

    it('should have NOT_FOUND code', () => {
      expect(ERROR_CODES.NOT_FOUND).toBe('WATCHER_NOT_FOUND');
    });

    it('should have PROVIDER_RATE_LIMITED code', () => {
      expect(ERROR_CODES.PROVIDER_RATE_LIMITED).toBe('WATCHER_PROVIDER_RATE_LIMITED');
    });

    it('should have PROVIDER_UNAVAILABLE code', () => {
      expect(ERROR_CODES.PROVIDER_UNAVAILABLE).toBe('WATCHER_PROVIDER_UNAVAILABLE');
    });

    it('should have INTERNAL_ERROR code', () => {
      expect(ERROR_CODES.INTERNAL_ERROR).toBe('WATCHER_INTERNAL_ERROR');
    });

    it('should be immutable (const assertion)', () => {
      const codes = ERROR_CODES;
      expect(Object.keys(codes)).toHaveLength(5);
    });
  });
});

describe('Error Classes', () => {
  describe('BackendError', () => {
    it('should create error with all properties', () => {
      const error = new BackendError(
        'Test error',
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'TestBackend',
        true,
        'target-resource'
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.backendName).toBe('TestBackend');
      expect(error.isRetryable).toBe(true);
      expect(error.target).toBe('target-resource');
      expect(error.name).toBe('BackendError');
    });

    it('should default isRetryable to false', () => {
      const error = new BackendError(
        'Test error',
        400,
        ERROR_CODES.INVALID_INPUT
      );

      expect(error.isRetryable).toBe(false);
    });

    it('should be instanceof Error', () => {
      const error = new BackendError('Test', 500, ERROR_CODES.INTERNAL_ERROR);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof BackendError).toBe(true);
    });

    it('should have stack trace', () => {
      const error = new BackendError('Test', 500, ERROR_CODES.INTERNAL_ERROR);
      expect(error.stack).toBeDefined();
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with correct code', () => {
      const error = new NotFoundError('Resource not found', 'Blockfrost', 'address');

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(error.backendName).toBe('Blockfrost');
      expect(error.target).toBe('address');
      expect(error.isRetryable).toBe(false);
      expect(error.name).toBe('NotFoundError');
    });

    it('should work without optional parameters', () => {
      const error = new NotFoundError('Not found');

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.backendName).toBeUndefined();
      expect(error.target).toBeUndefined();
    });

    it('should be instanceof BackendError', () => {
      const error = new NotFoundError('Not found');
      expect(error instanceof BackendError).toBe(true);
      expect(error instanceof NotFoundError).toBe(true);
    });
  });

  describe('ProviderUnavailableError', () => {
    it('should create 503 error with correct code', () => {
      const error = new ProviderUnavailableError('Service unavailable', 'Blockfrost');

      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ERROR_CODES.PROVIDER_UNAVAILABLE);
      expect(error.backendName).toBe('Blockfrost');
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('ProviderUnavailableError');
    });

    it('should be retryable', () => {
      const error = new ProviderUnavailableError('Unavailable');
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should create 429 error with correct code', () => {
      const error = new RateLimitError('Rate limit exceeded', 'Blockfrost');

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(ERROR_CODES.PROVIDER_RATE_LIMITED);
      expect(error.backendName).toBe('Blockfrost');
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('RateLimitError');
    });

    it('should be retryable', () => {
      const error = new RateLimitError('Rate limited');
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('ConfigError', () => {
    it('should create config error with message', () => {
      const error = new ConfigError('Invalid configuration');

      expect(error.message).toBe('Invalid configuration');
      expect(error.name).toBe('ConfigError');
    });

    it('should be instanceof Error', () => {
      const error = new ConfigError('Config issue');
      expect(error instanceof Error).toBe(true);
    });

    it('should have stack trace', () => {
      const error = new ConfigError('Config error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('BackendInitError', () => {
    it('should create 500 error with backend name', () => {
      const error = new BackendInitError('Failed to initialize', 'Blockfrost');

      expect(error.message).toBe('Failed to initialize');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.backendName).toBe('Blockfrost');
      expect(error.isRetryable).toBe(false);
      expect(error.name).toBe('BackendInitError');
    });
  });
});

describe('normalizeBackendError', () => {
  it('should return BackendError as-is', () => {
    const original = new NotFoundError('Already normalized');
    const result = normalizeBackendError(original);

    expect(result).toBe(original);
  });

  it('should convert 429 status to RateLimitError', () => {
    const error = { message: 'Too many requests', status: 429 };
    const result = normalizeBackendError(error, 'TestBackend');

    expect(result instanceof RateLimitError).toBe(true);
    expect(result.statusCode).toBe(429);
    expect(result.backendName).toBe('TestBackend');
  });

  it('should convert rate limit message to RateLimitError', () => {
    const error = { message: 'Rate limit exceeded, please slow down' };
    const result = normalizeBackendError(error);

    expect(result instanceof RateLimitError).toBe(true);
  });

  it('should convert "too many requests" message to RateLimitError', () => {
    const error = { message: 'Too Many Requests' };
    const result = normalizeBackendError(error);

    expect(result instanceof RateLimitError).toBe(true);
  });

  it('should convert 404 status to NotFoundError', () => {
    const error = { message: 'Resource not found', status: 404 };
    const result = normalizeBackendError(error);

    expect(result instanceof NotFoundError).toBe(true);
    expect(result.statusCode).toBe(404);
  });

  it('should convert "not found" message to NotFoundError', () => {
    const error = { message: 'Address not found' };
    const result = normalizeBackendError(error);

    expect(result instanceof NotFoundError).toBe(true);
  });

  it('should convert 5xx status to ProviderUnavailableError', () => {
    const error500 = { message: 'Internal server error', status: 500 };
    const error502 = { message: 'Bad gateway', status: 502 };
    const error503 = { message: 'Service unavailable', status: 503 };

    expect(normalizeBackendError(error500) instanceof ProviderUnavailableError).toBe(true);
    expect(normalizeBackendError(error502) instanceof ProviderUnavailableError).toBe(true);
    expect(normalizeBackendError(error503) instanceof ProviderUnavailableError).toBe(true);
  });

  it('should convert 4xx with "not found" message to NotFoundError', () => {
    const error = { message: 'Transaction not found', status: 400 };
    const result = normalizeBackendError(error);

    expect(result instanceof NotFoundError).toBe(true);
  });

  it('should convert other 4xx to ProviderUnavailableError', () => {
    const error = { message: 'Bad request', status: 400 };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
  });

  it('should convert timeout errors to ProviderUnavailableError', () => {
    const error = { message: 'Request timeout', code: 'ETIMEDOUT' };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
  });

  it('should convert network errors to ProviderUnavailableError', () => {
    const error = { message: 'Network error occurred' };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
  });

  it('should convert ECONNREFUSED to ProviderUnavailableError', () => {
    const error = { message: 'Connection refused', code: 'ECONNREFUSED' };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
  });

  it('should convert ENOTFOUND to ProviderUnavailableError', () => {
    const error = { message: 'getaddrinfo ENOTFOUND' };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
  });

  it('should handle response.status in error object', () => {
    const error = { message: 'Error', response: { status: 404 } };
    const result = normalizeBackendError(error);

    expect(result instanceof NotFoundError).toBe(true);
  });

  it('should handle statusCode property', () => {
    const error = { message: 'Error', statusCode: 503 };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
  });

  it('should fallback to ProviderUnavailableError for unknown errors', () => {
    const error = { message: 'Something went wrong' };
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
    expect(result.message).toContain('Unknown error');
  });

  it('should handle error without message', () => {
    const error = {};
    const result = normalizeBackendError(error);

    expect(result instanceof ProviderUnavailableError).toBe(true);
    expect(result.message).toContain('Unknown error');
  });

  it('should preserve backendName', () => {
    const error = { message: 'Error', status: 500 };
    const result = normalizeBackendError(error, 'CustomBackend');

    expect(result.backendName).toBe('CustomBackend');
  });
});

describe('rejectInvalid', () => {
  it('should throw BackendError with 400 status', () => {
    expect(() => rejectInvalid('Validation', 'Invalid address format')).toThrow(BackendError);

    try {
      rejectInvalid('Validation', 'Invalid address format', 'address');
    } catch (error) {
      expect(error instanceof BackendError).toBe(true);
      const backendError = error as BackendError;
      expect(backendError.statusCode).toBe(400);
      expect(backendError.code).toBe(ERROR_CODES.INVALID_INPUT);
      expect(backendError.message).toBe('Validation: Invalid address format');
      expect(backendError.target).toBe('address');
      expect(backendError.isRetryable).toBe(false);
    }
  });

  it('should format context and message', () => {
    try {
      rejectInvalid('AddressCheck', 'must start with addr');
    } catch (error) {
      expect((error as Error).message).toBe('AddressCheck: must start with addr');
    }
  });
});

describe('rejectMissing', () => {
  it('should throw BackendError with 400 status', () => {
    expect(() => rejectMissing('CreateAddress', 'address')).toThrow(BackendError);

    try {
      rejectMissing('CreateAddress', 'address');
    } catch (error) {
      expect(error instanceof BackendError).toBe(true);
      const backendError = error as BackendError;
      expect(backendError.statusCode).toBe(400);
      expect(backendError.code).toBe(ERROR_CODES.INVALID_INPUT);
      expect(backendError.message).toBe('CreateAddress: address is required');
      expect(backendError.target).toBe('address');
      expect(backendError.isRetryable).toBe(false);
    }
  });

  it('should set target to field name', () => {
    try {
      rejectMissing('Context', 'fieldName');
    } catch (error) {
      expect((error as BackendError).target).toBe('fieldName');
    }
  });
});

describe('Error Type Narrowing', () => {
  it('should allow type narrowing with instanceof', () => {
    const error: Error = new NotFoundError('Test');

    if (error instanceof BackendError) {
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
    }

    if (error instanceof NotFoundError) {
      expect(error.isRetryable).toBe(false);
    }
  });

  it('should distinguish between error types', () => {
    const errors: BackendError[] = [
      new NotFoundError('Not found'),
      new RateLimitError('Rate limited'),
      new ProviderUnavailableError('Unavailable'),
    ];

    const notFoundCount = errors.filter(e => e instanceof NotFoundError).length;
    const rateLimitCount = errors.filter(e => e instanceof RateLimitError).length;
    const unavailableCount = errors.filter(e => e instanceof ProviderUnavailableError).length;

    expect(notFoundCount).toBe(1);
    expect(rateLimitCount).toBe(1);
    expect(unavailableCount).toBe(1);
  });
});
