// Progress Tracking Service

import { BaseService } from './base-service.js';
import { broadcastToClients } from '../utils/logger.js';

/**
 * Progress callback function type
 */
export type ProgressCallback = (step: string, message: string) => void;

/**
 * Progress tracker for a specific user/operation
 */
export class ProgressTracker {
  private readonly userId: string;
  private readonly operationId: string;
  private readonly callbacks: ProgressCallback[];

  constructor(userId: string, operationId: string, callbacks: ProgressCallback[] = []) {
    this.userId = userId;
    this.operationId = operationId;
    this.callbacks = callbacks;
  }

  /**
   * Report progress for script generation
   */
  script(message: string): void {
    this.report('Script Generation', message);
  }

  /**
   * Report progress for audio generation
   */
  audio(message: string): void {
    this.report('Audio Generation', message);
  }

  /**
   * Report progress for image generation
   */
  images(message: string): void {
    this.report('Image Generation', message);
  }

  /**
   * Report progress for video generation
   */
  video(message: string): void {
    this.report('Video Generation', message);
  }

  /**
   * Report progress for PDF generation
   */
  pdf(message: string): void {
    this.report('PDF Generation', message);
  }

  /**
   * Report custom progress step
   */
  custom(step: string, message: string): void {
    this.report(step, message);
  }

  /**
   * Report completion
   */
  complete(message: string = 'Operation completed successfully'): void {
    this.report('Completion', `✅ ${message}`);
  }

  /**
   * Report error
   */
  error(message: string): void {
    this.report('Error', `❌ ${message}`);
  }

  /**
   * Report warning
   */
  warning(message: string): void {
    this.report('Warning', `⚠️ ${message}`);
  }

  /**
   * Report info
   */
  info(message: string): void {
    this.report('Info', `ℹ️ ${message}`);
  }

  /**
   * Core reporting method
   */
  private report(step: string, message: string): void {
    const formattedMessage = this.formatMessage(step, message);
    
    // Call all registered callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(step, formattedMessage);
      } catch (error) {
        console.error(`Progress callback error for ${this.userId}:`, error);
      }
    });
  }

  /**
   * Format progress message with consistent structure
   */
  private formatMessage(step: string, message: string): string {
    const timestamp = new Date().toLocaleTimeString();
    return `[${timestamp}] ${step}: ${message}`;
  }

  /**
   * Add a new callback
   */
  addCallback(callback: ProgressCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get operation ID
   */
  getOperationId(): string {
    return this.operationId;
  }
}

/**
 * Progress service for managing progress tracking across operations
 */
export class ProgressService extends BaseService {
  private readonly activeTrackers: Map<string, ProgressTracker> = new Map();

  constructor() {
    super('ProgressService');
  }

  /**
   * Create a new progress tracker for a user operation
   */
  createTracker(
    userId: string, 
    operationId?: string,
    enableBroadcast: boolean = true
  ): ProgressTracker {
    const id = operationId || this.generateOperationId();
    const trackerId = `${userId}:${id}`;

    // Create callbacks
    const callbacks: ProgressCallback[] = [];

    // Add broadcast callback if enabled
    if (enableBroadcast) {
      callbacks.push((step: string, message: string) => {
        broadcastToClients(message, userId);
      });
    }

    // Create tracker
    const tracker = new ProgressTracker(userId, id, callbacks);
    
    // Store tracker for later access
    this.activeTrackers.set(trackerId, tracker);

    this.log('info', `Created progress tracker for user ${userId}, operation ${id}`);

    // Clean up tracker after 1 hour
    setTimeout(() => {
      this.activeTrackers.delete(trackerId);
    }, 60 * 60 * 1000);

    return tracker;
  }

  /**
   * Get existing tracker
   */
  getTracker(userId: string, operationId: string): ProgressTracker | undefined {
    const trackerId = `${userId}:${operationId}`;
    return this.activeTrackers.get(trackerId);
  }

  /**
   * Remove tracker
   */
  removeTracker(userId: string, operationId: string): void {
    const trackerId = `${userId}:${operationId}`;
    this.activeTrackers.delete(trackerId);
    this.log('info', `Removed progress tracker for user ${userId}, operation ${operationId}`);
  }

  /**
   * Get all active trackers for a user
   */
  getUserTrackers(userId: string): ProgressTracker[] {
    return Array.from(this.activeTrackers.values())
      .filter(tracker => tracker.getUserId() === userId);
  }

  /**
   * Get statistics about active trackers
   */
  getStatistics(): {
    totalTrackers: number;
    userCounts: Record<string, number>;
  } {
    const userCounts: Record<string, number> = {};
    
    for (const tracker of this.activeTrackers.values()) {
      const userId = tracker.getUserId();
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    }

    return {
      totalTrackers: this.activeTrackers.size,
      userCounts
    };
  }

  /**
   * Clean up all trackers for a user
   */
  cleanupUserTrackers(userId: string): void {
    const toRemove: string[] = [];
    
    for (const [trackerId, tracker] of this.activeTrackers.entries()) {
      if (tracker.getUserId() === userId) {
        toRemove.push(trackerId);
      }
    }
    
    toRemove.forEach(trackerId => {
      this.activeTrackers.delete(trackerId);
    });

    if (toRemove.length > 0) {
      this.log('info', `Cleaned up ${toRemove.length} trackers for user ${userId}`);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a progress callback function for legacy compatibility
   */
  createProgressCallback(userId: string): ProgressCallback {
    const tracker = this.createTracker(userId);
    return (step: string, message: string) => {
      tracker.custom(step, message);
    };
  }
}

// Export singleton instance
export const progressService = new ProgressService();