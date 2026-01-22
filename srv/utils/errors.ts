import { ERROR_CODES, type ErrorCode } from './error-codes';

/** 
 * Backend Errors Implementation
 * Defines typed errors for backend communication issues
 */

/** 
 * BackendError Base class for all backend-related errors
 */
export class BackendError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly target?: string;
  public readonly backendName?: string;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    backendName?: string,
    isRetryable: boolean = false,
    target?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.backendName = backendName;
    this.isRetryable = isRetryable;
    this.target = target;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 
 * NotFoundError - Resource not found in backend (404)
 * This is NOT a provider error - it's a valid response indicating the resource doesn't exist
 */
export class NotFoundError extends BackendError {
  constructor(message: string, backendName?: string, target?: string) {
    super(message, 404, ERROR_CODES.NOT_FOUND, backendName, false, target);
  }
}

/** 
 * ProviderUnavailableError - Provider unavailable or timeout (503)
 * Indicates a temporary issue - retrying may help
 */
export class ProviderUnavailableError extends BackendError {
  constructor(message: string, backendName?: string) {
    super(message, 503, ERROR_CODES.PROVIDER_UNAVAILABLE, backendName, true);
  }
}

/** 
 * RateLimitError - Provider rate limit exceeded (429)
 * Indicates too many requests - client should back off and retry later
 */
export class RateLimitError extends BackendError {
  constructor(message: string, backendName?: string) {
    super(message, 429, ERROR_CODES.PROVIDER_RATE_LIMITED, backendName, true);
  }
}

/** 
 * ConfigError - Error in configuration settings
 * Captures configuration-related issues
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 
 * BackendInitError - Error initializing a specific backend
 */
export class BackendInitError extends BackendError {
  constructor(message: string, backendName: string) {
    super(message, 500, ERROR_CODES.INTERNAL_ERROR, backendName, false);
  }
}

/** 
 * Normalize various error types into standardized BackendError
 * Priority:
 * 1. If already BackendError, return as-is
 * 2. Check HTTP status 429 or rate limit messages → 429
 * 3. Check HTTP status 404 → 404
 * 4. Check HTTP status 5xx → 503 (retry-able)
 * 5. Check HTTP status 4xx → 404 if "not found", otherwise 503
 * 6. Unknown/network errors → 503
 */
export function normalizeBackendError(
  err: unknown,
  backendName?: string,
): BackendError {
  // Already normalized
  if (err instanceof BackendError) {
    return err;
  }

  const message = (err as Error).message || 'Unknown error';
  const statusCode = (err as { response?: { status?: number }; status?: number; statusCode?: number }).response?.status || 
                     (err as { status?: number }).status || 
                     (err as { statusCode?: number }).statusCode;

  // Rate limit detection
  if (
    statusCode === 429 ||
    /rate limit|too many requests/i.test(message)
  ) {
    return new RateLimitError(message, backendName);
  }

  // Not found
  if (statusCode === 404 || /not found/i.test(message)) {
    return new NotFoundError(message, backendName);
  }

  // Server errors → Provider Unavailable (retry-able)
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return new ProviderUnavailableError(message, backendName);
  }

  // Client errors (4xx) → depends on message
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    if (/not found/i.test(message)) {
      return new NotFoundError(message, backendName);
    }
    return new ProviderUnavailableError(message, backendName);
  }

  // Network/timeout errors → Provider Unavailable
  if (
    /timeout|network|econnrefused|enotfound/i.test(message) ||
    (err as { code?: string }).code === 'ECONNREFUSED' ||
    (err as { code?: string }).code === 'ETIMEDOUT'
  ) {
    return new ProviderUnavailableError(message, backendName);
  }

  // Fallback: Unknown error → Provider Unavailable
  return new ProviderUnavailableError(
    `Unknown error: ${message}`,
    backendName
  );
}

/** 
 * Function to reject requests with standardized error messages
 * @param ctx - Context string for the error
 * @param message - Detailed error message
 * @param target - Optional target resource
 * @throws {BackendError} BackendError with 400 status code
 */
export function rejectInvalid(ctx: string, message: string, target?: string): never {
  throw new BackendError(
    `${ctx}: ${message}`,
    400,
    ERROR_CODES.INVALID_INPUT,
    undefined,
    false,
    target
  );
}

/** 
 * Function to reject requests for missing required fields
 * @param ctx - Context string for the error
 * @param field - Name of the missing field
 * @throws {BackendError} BackendError with 400 status code
*/
export function rejectMissing(ctx: string, field: string): never {
  throw new BackendError(
    `${ctx}: ${field} is required`,
    400,
    ERROR_CODES.INVALID_INPUT,
    undefined,
    false,
    field
  );
}
