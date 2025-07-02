// User Context Management Middleware

import { Request, Response, NextFunction } from 'express';
import { userContextStorage, addActiveUser, removeActiveUser } from '../utils/logger.js';
import { ErrorFactory } from '../utils/errors.js';

/**
 * Extended request interface with user context
 */
export interface RequestWithUserContext extends Request {
  userContext?: {
    userId: string;
    userName: string;
  };
}

/**
 * Extract user ID from request
 */
function extractUserId(req: Request): string | undefined {
  // Try to get from body first (for POST requests)
  if (req.body?.options?.uniqueUserName) {
    return req.body.options.uniqueUserName;
  }
  
  // Try to get from body.userName (legacy support)
  if (req.body?.userName) {
    return req.body.userName;
  }
  
  // Try to get from params (for GET requests)
  if (req.params?.userName) {
    return req.params.userName;
  }
  
  // Try to get from query
  if (req.query?.userName) {
    return req.query.userName as string;
  }
  
  return undefined;
}

/**
 * Middleware to set user context for the request
 */
export function withUserContext(
  req: RequestWithUserContext,
  res: Response,
  next: NextFunction
): void {
  const userId = extractUserId(req);
  
  if (!userId) {
    const error = ErrorFactory.createValidationError('User identification is required', 'userName');
    return next(error);
  }
  
  // Set user context on request
  req.userContext = {
    userId,
    userName: userId
  };
  
  // Run the request in user context storage
  userContextStorage.run(userId, () => {
    addActiveUser(userId);
    
    // Clean up user when request completes
    const cleanup = () => {
      removeActiveUser(userId);
    };
    
    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    
    next();
  });
}

/**
 * Middleware wrapper that ensures user context is available
 * Use this for routes that require user context
 */
export function requireUserContext(
  handler: (req: RequestWithUserContext, res: Response, next: NextFunction) => Promise<void> | void
) {
  return async (req: RequestWithUserContext, res: Response, next: NextFunction) => {
    try {
      // Ensure user context middleware has run
      if (!req.userContext) {
        throw ErrorFactory.createValidationError('User context not available');
      }
      
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware for optional user context
 * Adds user context if available but doesn't require it
 */
export function optionalUserContext(
  req: RequestWithUserContext,
  res: Response,
  next: NextFunction
): void {
  const userId = extractUserId(req);
  
  if (userId) {
    req.userContext = {
      userId,
      userName: userId
    };
    
    userContextStorage.run(userId, () => {
      addActiveUser(userId);
      
      const cleanup = () => {
        removeActiveUser(userId);
      };
      
      res.on('finish', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);
      
      next();
    });
  } else {
    next();
  }
}

/**
 * Get current user context from async local storage
 */
export function getCurrentUserContext(): {
  userId?: string;
  userName?: string;
} {
  const userId = userContextStorage.getStore();
  return userId ? { userId, userName: userId } : {};
}

/**
 * Validation middleware for user context requirements
 */
export function validateUserContext(requirements: {
  userIdRequired?: boolean;
  userNameRequired?: boolean;
}) {
  return (req: RequestWithUserContext, res: Response, next: NextFunction) => {
    const { userContext } = req;
    
    if (requirements.userIdRequired && !userContext?.userId) {
      return next(ErrorFactory.createValidationError('User ID is required'));
    }
    
    if (requirements.userNameRequired && !userContext?.userName) {
      return next(ErrorFactory.createValidationError('User name is required'));
    }
    
    next();
  };
}

/**
 * Middleware to sanitize user input
 */
export function sanitizeUserInput(
  req: RequestWithUserContext,
  res: Response,
  next: NextFunction
): void {
  if (req.userContext?.userId) {
    // Sanitize user ID - only allow alphanumeric, underscore, and hyphen
    req.userContext.userId = req.userContext.userId.replace(/[^a-zA-Z0-9_-]/g, '');
    req.userContext.userName = req.userContext.userId; // Keep them in sync
    
    // Validate sanitized input
    if (!req.userContext.userId) {
      return next(ErrorFactory.createValidationError('Invalid user ID format'));
    }
    
    if (req.userContext.userId.length > 50) {
      return next(ErrorFactory.createValidationError('User ID too long (max 50 characters)'));
    }
  }
  
  next();
}