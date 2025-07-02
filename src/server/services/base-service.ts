// Base Service Class

import { ErrorFactory } from '../utils/errors.js';

/**
 * Base service class with common functionality
 */
export abstract class BaseService {
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Log service activity
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.serviceName}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => {
      const value = params[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      throw ErrorFactory.createValidationError(
        `Missing required fields: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Validate string parameter
   */
  protected validateString(value: any, fieldName: string, options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  }): string {
    if (typeof value !== 'string') {
      throw ErrorFactory.createValidationError(`${fieldName} must be a string`);
    }

    const trimmed = value.trim();
    
    if (options?.minLength && trimmed.length < options.minLength) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must be at least ${options.minLength} characters`
      );
    }

    if (options?.maxLength && trimmed.length > options.maxLength) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must be at most ${options.maxLength} characters`
      );
    }

    if (options?.pattern && !options.pattern.test(trimmed)) {
      throw ErrorFactory.createValidationError(
        `${fieldName} format is invalid`
      );
    }

    return trimmed;
  }

  /**
   * Validate number parameter
   */
  protected validateNumber(value: any, fieldName: string, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): number {
    const num = Number(value);
    
    if (isNaN(num)) {
      throw ErrorFactory.createValidationError(`${fieldName} must be a number`);
    }

    if (options?.integer && !Number.isInteger(num)) {
      throw ErrorFactory.createValidationError(`${fieldName} must be an integer`);
    }

    if (options?.min !== undefined && num < options.min) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must be at least ${options.min}`
      );
    }

    if (options?.max !== undefined && num > options.max) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must be at most ${options.max}`
      );
    }

    return num;
  }

  /**
   * Validate array parameter
   */
  protected validateArray(value: any, fieldName: string, options?: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: any, index: number) => void;
  }): any[] {
    if (!Array.isArray(value)) {
      throw ErrorFactory.createValidationError(`${fieldName} must be an array`);
    }

    if (options?.minLength && value.length < options.minLength) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must have at least ${options.minLength} items`
      );
    }

    if (options?.maxLength && value.length > options.maxLength) {
      throw ErrorFactory.createValidationError(
        `${fieldName} must have at most ${options.maxLength} items`
      );
    }

    if (options?.itemValidator) {
      value.forEach((item, index) => {
        try {
          options.itemValidator!(item, index);
        } catch (error) {
          throw ErrorFactory.createValidationError(
            `${fieldName}[${index}]: ${error instanceof Error ? error.message : 'Invalid item'}`
          );
        }
      });
    }

    return value;
  }

  /**
   * Sanitize filename
   */
  protected sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') {
      throw ErrorFactory.createValidationError('Filename must be a string');
    }

    // Remove dangerous characters and normalize
    const sanitized = filename
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove dangerous characters
      .replace(/\.{2,}/g, '.') // Remove multiple dots
      .replace(/^\.+/, '') // Remove leading dots
      .slice(0, 255); // Limit length

    if (!sanitized) {
      throw ErrorFactory.createValidationError('Invalid filename');
    }

    return sanitized;
  }

  /**
   * Sanitize username
   */
  protected sanitizeUsername(username: string): string {
    if (typeof username !== 'string') {
      throw ErrorFactory.createValidationError('Username must be a string');
    }

    // Allow only alphanumeric, underscore, and hyphen
    const sanitized = username
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 50); // Limit length

    if (!sanitized) {
      throw ErrorFactory.createValidationError('Invalid username format');
    }

    return sanitized;
  }

  /**
   * Handle async operations with proper error handling
   */
  protected async handleAsync<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      this.log('info', `Starting ${operationName}`);
      const result = await operation();
      this.log('info', `Completed ${operationName}`);
      return result;
    } catch (error) {
      this.log('error', `Failed ${operationName}`, error);
      throw ErrorFactory.fromUnknown(error);
    }
  }

  /**
   * Create standardized success response
   */
  protected createSuccessResponse<T>(data: T, message?: string): {
    success: true;
    data: T;
    message?: string;
    timestamp: string;
  } {
    const response = {
      success: true as const,
      data,
      timestamp: new Date().toISOString()
    };

    if (message) {
      return { ...response, message };
    }

    return response;
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      retryCondition?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryCondition = () => true
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !retryCondition(error)) {
          break;
        }

        const delay = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        );

        this.log('warn', `Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, error);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw ErrorFactory.fromUnknown(lastError);
  }
}