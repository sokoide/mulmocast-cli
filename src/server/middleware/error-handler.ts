// Error Handling Middleware

import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  ErrorFactory, 
  createErrorResponse, 
  isOperationalError 
} from '../utils/errors.js';

/**
 * Global error handling middleware
 * Should be the last middleware in the chain
 */
export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Convert unknown errors to AppError
  const appError = err instanceof AppError ? err : ErrorFactory.fromUnknown(err);
  
  // Log error for monitoring
  console.error(`[${new Date().toISOString()}] Error ${appError.statusCode}:`, {
    message: appError.message,
    path: req.path,
    method: req.method,
    statusCode: appError.statusCode,
    stack: appError.stack,
    isOperational: appError.isOperational,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Create error response
  const errorResponse = createErrorResponse(appError, req.path);
  
  // Send error response
  res.status(appError.statusCode).json(errorResponse);
}

/**
 * Handle 404 errors for unmatched routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = ErrorFactory.createNotFoundError(`Route ${req.path}`);
  next(error);
}

/**
 * Async error wrapper to catch async errors in route handlers
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation middleware wrapper
 */
export function validateRequest(
  validationFn: (req: Request) => { isValid: boolean; errors: string[] }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isValid, errors } = validationFn(req);
      
      if (!isValid) {
        throw ErrorFactory.createValidationError(errors.join(', '));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Rate limiting error handler
 */
export function rateLimitHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = ErrorFactory.createRateLimitError('Too many requests, please try again later');
  next(error);
}

/**
 * Request timeout handler
 */
export function timeoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = ErrorFactory.createInternalServerError('Request timeout');
  next(error);
}

/**
 * Graceful shutdown error handler
 */
export function gracefulShutdownHandler(server: any) {
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    server.close((err: Error) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      console.log('Server closed. Exiting process.');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Unhandled error handlers
 */
export function setupUnhandledErrorHandlers(): void {
  process.on('uncaughtException', (err: Error) => {
    console.error('Uncaught Exception:', err);
    
    if (!isOperationalError(err)) {
      console.error('Non-operational error detected. Shutting down...');
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    const error = ErrorFactory.fromUnknown(reason);
    if (!error.isOperational) {
      console.error('Non-operational promise rejection detected. Shutting down...');
      process.exit(1);
    }
  });
}