// Moderation Service

import fs from 'fs';
import path from 'path';
import { BaseService } from './base-service.js';
import { ErrorFactory } from '../utils/errors.js';

/**
 * Moderation status enumeration
 */
export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * File type enumeration
 */
export enum FileType {
  VIDEO = 'video',
  PDF = 'pdf'
}

/**
 * Moderation record interface
 */
export interface ModerationRecord {
  status: ModerationStatus;
  moderatedAt?: number;
  moderatedBy?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * File group interface for moderation
 */
export interface FileGroup {
  userName: string;
  baseName: string;
  files: FileInfo[];
  timestamp: number;
}

/**
 * File info interface
 */
export interface FileInfo {
  filename: string;
  path: string;
  type: FileType;
  size: number;
  timestamp: number;
  moderationStatus: ModerationStatus;
  moderatedAt?: number;
  moderatedBy?: string;
}

/**
 * Moderation service for handling file moderation
 */
export class ModerationService extends BaseService {
  private readonly outputPath: string;
  private readonly moderationCache: Map<string, Map<string, ModerationRecord>> = new Map();

  constructor(outputPath: string) {
    super('ModerationService');
    this.outputPath = outputPath;
  }

  /**
   * Get moderation data for a user
   */
  private getModerationData(userName: string): Record<string, ModerationRecord> {
    // Check cache first
    if (this.moderationCache.has(userName)) {
      return Object.fromEntries(this.moderationCache.get(userName)!);
    }

    const sanitizedUserName = this.sanitizeUsername(userName);
    const moderationFile = path.join(this.outputPath, sanitizedUserName, '.moderation.json');
    
    if (!fs.existsSync(moderationFile)) {
      return {};
    }

    try {
      const data = JSON.parse(fs.readFileSync(moderationFile, 'utf-8'));
      
      // Update cache
      this.moderationCache.set(userName, new Map(Object.entries(data)));
      
      return data;
    } catch (error) {
      this.log('error', `Failed to read moderation file for ${userName}`, error);
      return {};
    }
  }

  /**
   * Save moderation data for a user
   */
  private saveModerationData(userName: string, data: Record<string, ModerationRecord>): void {
    const sanitizedUserName = this.sanitizeUsername(userName);
    const userDir = path.join(this.outputPath, sanitizedUserName);
    const moderationFile = path.join(userDir, '.moderation.json');

    try {
      // Ensure user directory exists
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      // Write moderation data
      fs.writeFileSync(moderationFile, JSON.stringify(data, null, 2), 'utf-8');
      
      // Update cache
      this.moderationCache.set(userName, new Map(Object.entries(data)));
      
      this.log('info', `Saved moderation data for ${userName}`);
    } catch (error) {
      this.log('error', `Failed to save moderation file for ${userName}`, error);
      throw ErrorFactory.createInternalServerError('Failed to save moderation data');
    }
  }

  /**
   * Get pending file groups for moderation
   */
  async getPendingFileGroups(): Promise<FileGroup[]> {
    return this.handleAsync(async () => {
      const fileGroups: FileGroup[] = [];
      
      if (!fs.existsSync(this.outputPath)) {
        return fileGroups;
      }

      const userDirs = fs.readdirSync(this.outputPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const userName of userDirs) {
        try {
          const userGroups = await this.getUserFileGroups(userName, ModerationStatus.PENDING);
          fileGroups.push(...userGroups);
        } catch (error) {
          this.log('warn', `Failed to get file groups for user ${userName}`, error);
        }
      }

      // Sort by timestamp (newest first)
      return fileGroups.sort((a, b) => b.timestamp - a.timestamp);
    }, 'getPendingFileGroups');
  }

  /**
   * Get file groups for a specific user
   */
  async getUserFileGroups(userName: string, status?: ModerationStatus): Promise<FileGroup[]> {
    const sanitizedUserName = this.sanitizeUsername(userName);
    const userDir = path.join(this.outputPath, sanitizedUserName);
    
    if (!fs.existsSync(userDir)) {
      return [];
    }

    const moderationData = this.getModerationData(userName);
    const fileGroups: Map<string, FileGroup> = new Map();

    // Get all files in user directory
    const files = fs.readdirSync(userDir, { withFileTypes: true })
      .filter(dirent => dirent.isFile())
      .filter(dirent => dirent.name.endsWith('.mp4') || dirent.name.endsWith('.pdf'))
      .filter(dirent => !dirent.name.startsWith('.')) // Exclude hidden files
      .map(dirent => dirent.name);

    for (const filename of files) {
      const filePath = path.join(userDir, filename);
      const stats = fs.statSync(filePath);
      
      // Determine file type
      const type = filename.endsWith('.mp4') ? FileType.VIDEO : FileType.PDF;
      
      // Extract base name (remove extension and language suffix)
      const baseName = this.extractBaseName(filename);
      
      // Get moderation status
      const moderation = moderationData[filename] || { status: ModerationStatus.PENDING };
      
      // Filter by status if specified
      if (status && moderation.status !== status) {
        continue;
      }

      // Create file info
      const fileInfo: FileInfo = {
        filename,
        path: path.relative(this.outputPath, filePath),
        type,
        size: stats.size,
        timestamp: stats.mtime.getTime(),
        moderationStatus: moderation.status,
        moderatedAt: moderation.moderatedAt,
        moderatedBy: moderation.moderatedBy
      };

      // Group by base name
      if (!fileGroups.has(baseName)) {
        fileGroups.set(baseName, {
          userName,
          baseName,
          files: [],
          timestamp: stats.mtime.getTime()
        });
      }

      const group = fileGroups.get(baseName)!;
      group.files.push(fileInfo);
      
      // Update group timestamp to latest file
      if (fileInfo.timestamp > group.timestamp) {
        group.timestamp = fileInfo.timestamp;
      }
    }

    return Array.from(fileGroups.values());
  }

  /**
   * Moderate a file group
   */
  async moderateFileGroup(
    userName: string,
    baseName: string,
    status: ModerationStatus,
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    return this.handleAsync(async () => {
      this.validateRequired({ userName, baseName, status, moderatorId }, 
        ['userName', 'baseName', 'status', 'moderatorId']);

      const sanitizedUserName = this.sanitizeUsername(userName);
      const sanitizedBaseName = this.sanitizeFilename(baseName);

      // Get current moderation data
      const moderationData = this.getModerationData(userName);
      
      // Find all files in the group
      const userDir = path.join(this.outputPath, sanitizedUserName);
      const files = fs.readdirSync(userDir)
        .filter(filename => this.extractBaseName(filename) === sanitizedBaseName)
        .filter(filename => filename.endsWith('.mp4') || filename.endsWith('.pdf'));

      if (files.length === 0) {
        throw ErrorFactory.createNotFoundError(`File group "${baseName}" for user "${userName}"`);
      }

      // Update moderation status for all files in the group
      const timestamp = Date.now();
      files.forEach(filename => {
        moderationData[filename] = {
          status,
          moderatedAt: timestamp,
          moderatedBy: moderatorId,
          reason
        };
      });

      // Save moderation data
      this.saveModerationData(userName, moderationData);

      this.log('info', `Moderated file group ${baseName} for ${userName}: ${status}`);
    }, 'moderateFileGroup');
  }

  /**
   * Get moderation status for a specific file
   */
  getFileStatus(userName: string, filename: string): ModerationRecord {
    // Clear cache to ensure fresh data
    this.moderationCache.delete(userName);
    const moderationData = this.getModerationData(userName);
    return moderationData[filename] || { status: ModerationStatus.PENDING };
  }

  /**
   * Check if file is approved for access
   */
  isFileApproved(userName: string, filename: string): boolean {
    const status = this.getFileStatus(userName, filename);
    return status.status === ModerationStatus.APPROVED;
  }

  /**
   * Mark a single file as pending moderation
   */
  async markFilePending(userName: string, fileName: string, reason = 'Automatically marked as pending after generation'): Promise<void> {
    try {
      const moderationData = this.getModerationData(userName);
      moderationData[fileName] = {
        status: ModerationStatus.PENDING,
        moderatedAt: Date.now(),
        moderatedBy: 'system',
        reason
      };
      
      this.saveModerationData(userName, moderationData);
      this.log('info', `Marked file as pending: ${userName}/${fileName}`);
    } catch (error) {
      this.log('error', `Failed to mark file as pending: ${fileName}`, error);
      throw error;
    }
  }

  /**
   * Get moderation statistics
   */
  async getModerationStatistics(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    totalUsers: number;
  }> {
    return this.handleAsync(async () => {
      const stats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        totalUsers: 0
      };

      if (!fs.existsSync(this.outputPath)) {
        return stats;
      }

      const userDirs = fs.readdirSync(this.outputPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      stats.totalUsers = userDirs.length;

      for (const userName of userDirs) {
        try {
          const moderationData = this.getModerationData(userName);
          
          Object.values(moderationData).forEach(record => {
            switch (record.status) {
              case ModerationStatus.PENDING:
                stats.pending++;
                break;
              case ModerationStatus.APPROVED:
                stats.approved++;
                break;
              case ModerationStatus.REJECTED:
                stats.rejected++;
                break;
            }
          });
        } catch (error) {
          this.log('warn', `Failed to get moderation stats for user ${userName}`, error);
        }
      }

      return stats;
    }, 'getModerationStatistics');
  }

  /**
   * Extract base name from filename (remove extension and language suffix)
   */
  private extractBaseName(filename: string): string {
    // Remove extension
    const nameWithoutExt = path.parse(filename).name;
    
    // Remove language suffix (e.g., "_ja", "_en")
    return nameWithoutExt.replace(/_[a-z]{2}$/, '');
  }

  /**
   * Clear moderation cache for a user
   */
  clearCache(userName?: string): void {
    if (userName) {
      this.moderationCache.delete(userName);
      this.log('info', `Cleared moderation cache for user ${userName}`);
    } else {
      this.moderationCache.clear();
      this.log('info', 'Cleared all moderation cache');
    }
  }
}

// Export moderation enums for convenience
export { ModerationStatus as Status, FileType as Type };