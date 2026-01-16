/** 
 * Error codes used throughout the Cardano Watcher backend 
 */
export const ERROR_CODES = {
  /**
   * 400 – Invalid input
   * Indicates that the input provided by the client is invalid
   */
  INVALID_INPUT: 'WATCHER_INVALID_INPUT',

  /**
   * 404 – Data not found
   * Indicates that the requested resource could not be found
   */
  NOT_FOUND: 'WATCHER_NOT_FOUND',

  /**
    * 429 – Rate limiting
    * indicates temporary unavailability
    */
  PROVIDER_RATE_LIMITED: 'WATCHER_PROVIDER_RATE_LIMITED',

  /**
   * 503 – Upstream / connectivity 
   * Indicates that the blockchain provider is currently unavailable
   */
  PROVIDER_UNAVAILABLE: 'WATCHER_PROVIDER_UNAVAILABLE',

  /** 
   * 500 – Internal fallback
   * Indicates an unexpected internal error
   */
  INTERNAL_ERROR: 'WATCHER_INTERNAL_ERROR',
} as const;

/** 
 * Type for error codes
 */
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
