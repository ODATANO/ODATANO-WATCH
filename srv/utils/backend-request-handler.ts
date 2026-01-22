import { normalizeBackendError, BackendError } from './errors';
import cds, { Request, Service } from '@sap/cds';

const logger = cds.log('ODATANO-WATCH');

/** 
 * BackendRequestHandler - Provides standardized handling for backend requests 
 */

/** 
 * BackendRequestHandler - Wraps a backend method call with standardized error handling
 * @param fn - The async function to execute
 * @param backendName - Name of the backend (for error context)
 * @returns {Promise<T>} The result of the backend call or a normalized error
 */
export async function handleBackendRequest<T>(
  fn: () => Promise<T>,
  backendName: string
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    throw normalizeBackendError(err, backendName);
  }
}

/**
 * General request handler for Services
 * @param req - The incoming request 
 * @param handler - The async function containing business logic
 * @returns {Promise<unknown>} The result of the handler or a mapped error response
 */
export async function handleRequest(
  req: Request,
  handler: (db: Service) => Promise<unknown>
): Promise<unknown> {
  const context = req.target?.name || req.event;
  const db = cds.tx(req);
  
  try {
    return await handler(db);
  } catch (err: unknown) {
    logger.error({ err }, `[Service] ${context} error`);
    
    // Map BackendError to CDS request error
    if (err instanceof BackendError) {
      return req.reject(
        err.statusCode,
        `${err.code}: ${context} - ${err.message}`,
        err.target
      );
    }
    
    // Unexpected errors
    logger.error({ err }, `Unexpected error in ${context}`);
    return req.reject(500, `Internal error: ${(err as Error).message || 'Unknown error'}`);
  }
}
