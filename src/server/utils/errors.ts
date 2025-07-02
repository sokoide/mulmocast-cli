// Centralized Error Handling System

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    this.name = this.constructor.name;
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    const fullMessage = field ? `${field}: ${message}` : message;
    super(fullMessage, 400);
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Internal server error class
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * Error factory for creating standardized errors
 */
export class ErrorFactory {
  static createValidationError(message: string, field?: string): ValidationError {
    return new ValidationError(message, field);
  }

  static createNotFoundError(resource: string): NotFoundError {
    return new NotFoundError(resource);
  }

  static createAuthenticationError(message?: string): AuthenticationError {
    return new AuthenticationError(message);
  }

  static createAuthorizationError(message?: string): AuthorizationError {
    return new AuthorizationError(message);
  }

  static createConflictError(message: string): ConflictError {
    return new ConflictError(message);
  }

  static createRateLimitError(message?: string): RateLimitError {
    return new RateLimitError(message);
  }

  static createInternalServerError(message?: string): InternalServerError {
    return new InternalServerError(message);
  }

  /**
   * Create appropriate error from unknown error object
   */
  static fromUnknown(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new InternalServerError(error.message);
    }

    if (typeof error === 'string') {
      return new InternalServerError(error);
    }

    return new InternalServerError('An unknown error occurred');
  }
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  code?: string;
  timestamp: string;
  path?: string;
  brokenJson?: unknown;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: AppError,
  path?: string,
  additionalData?: { brokenJson?: unknown }
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: error.message,
    timestamp: error.timestamp,
  };

  // Add path if provided
  if (path) {
    response.path = path;
  }

  // Add details for development/debugging
  if (process.env.NODE_ENV === 'development') {
    response.details = error.stack;
  }

  // Add additional data if provided
  if (additionalData?.brokenJson) {
    response.brokenJson = additionalData.brokenJson;
  }

  return response;
}

/**
 * Determine if an error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}