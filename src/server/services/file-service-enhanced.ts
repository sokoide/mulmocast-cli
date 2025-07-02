// Enhanced File Service with Moderation Integration
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { BaseService } from './base-service.js';
import { ModerationService, ModerationStatus } from './moderation-service.js';
import { ErrorFactory } from '../utils/errors.js';
import { sanitizeFileName, validateFileType, FileType } from '../utils/file-utils.js';

export interface FileStats {
  size: number;
  lastModified: number;
  type: FileType;
}

export interface UserFile {
  fileName: string;
  size: number;
  lastModified: number;
  type: FileType;
  moderationStatus: ModerationStatus;
  moderatedBy?: string;
  moderatedAt?: number;
}

export class EnhancedFileService extends BaseService {
  private moderationService: ModerationService;
  private allowedExtensions = ['.mp4', '.pdf', '.json', '.mp3'];
  private maxFileSize = 500 * 1024 * 1024; // 500MB

  constructor(private outputPath: string, moderationService?: ModerationService) {
    super('EnhancedFileService');
    this.moderationService = moderationService || new ModerationService(outputPath);
  }

  /**
   * Handle file download/preview with proper validation and security
   */
  async handleFileDownload(req: Request, res: Response): Promise<void> {
    try {
      const { userName, fileName } = req.params;
      const isPreview = req.query.preview === 'true';

      // Validate required parameters
      if (!userName || !fileName) {
        throw ErrorFactory.createValidationError('User name and file name are required');
      }

      // Sanitize inputs
      const sanitizedUserName = sanitizeFileName(userName);
      const sanitizedFileName = sanitizeFileName(fileName);

      // Security checks
      this.validateFileAccess(sanitizedFileName, isPreview);

      // Check moderation status
      const fileStatus = this.moderationService.getFileStatus(sanitizedUserName, sanitizedFileName);
      
      if (fileStatus.status !== ModerationStatus.APPROVED) {
        throw ErrorFactory.createAuthorizationError(
          fileStatus.status === ModerationStatus.PENDING 
            ? 'File is pending moderation' 
            : 'File has been rejected'
        );
      }

      // Construct and validate file path
      const filePath = this.buildSecureFilePath(sanitizedUserName, sanitizedFileName);
      
      // Verify file exists and get stats
      const fileStats = await this.getFileStats(filePath);
      
      // Set response headers
      this.setFileHeaders(res, sanitizedFileName, isPreview, fileStats);
      
      // Stream the file
      await this.streamFile(filePath, res);
      
      console.info(`File ${isPreview ? 'previewed' : 'downloaded'}: ${sanitizedUserName}/${sanitizedFileName}`);
      
    } catch (error) {
      console.error(`Error during file ${req.query.preview ? 'preview' : 'download'}:`, error);
      
      if (!res.headersSent) {
        const appError = ErrorFactory.fromUnknown(error);
        res.status(appError.statusCode).json({
          success: false,
          error: appError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Get user files with moderation status
   */
  async getUserFiles(userName: string): Promise<UserFile[]> {
    try {
      const sanitizedUserName = sanitizeFileName(userName);
      const userDir = path.join(this.outputPath, sanitizedUserName);
      
      if (!fs.existsSync(userDir)) {
        return [];
      }
      
      const files = fs.readdirSync(userDir, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && !dirent.name.startsWith('.'))
        .filter(dirent => this.allowedExtensions.some(ext => dirent.name.endsWith(ext)));
      
      const userFiles: UserFile[] = [];
      
      for (const file of files) {
        try {
          const filePath = path.join(userDir, file.name);
          const stats = fs.statSync(filePath);
          const fileStatus = this.moderationService.getFileStatus(sanitizedUserName, file.name);
          
          userFiles.push({
            fileName: file.name,
            size: stats.size,
            lastModified: stats.mtime.getTime(),
            type: validateFileType(file.name),
            moderationStatus: fileStatus.status as ModerationStatus,
            moderatedBy: fileStatus.moderatedBy,
            moderatedAt: fileStatus.moderatedAt
          });
        } catch (error) {
          console.warn(`Failed to get stats for file ${file.name}:`, error);
        }
      }
      
      return userFiles.sort((a, b) => b.lastModified - a.lastModified);
      
    } catch (error) {
      console.error('Error getting user files:', error);
      return [];
    }
  }
  
  /**
   * Validate file access permissions
   */
  private validateFileAccess(fileName: string, isPreview: boolean): void {
    // Validate file extension
    const allowedForDownload = ['.mp4', '.pdf'];
    const allowedForPreview = ['.mp4', '.pdf'];
    const extensions = isPreview ? allowedForPreview : allowedForDownload;
    
    if (!extensions.some(ext => fileName.endsWith(ext))) {
      throw ErrorFactory.createValidationError(
        `Only ${extensions.join(', ')} files are allowed for ${isPreview ? 'preview' : 'download'}`
      );
    }
    
    // Additional security checks
    if (fileName.includes('..') || fileName.startsWith('/') || fileName.includes('\\')) {
      throw ErrorFactory.createValidationError('Invalid file name');
    }
  }
  
  /**
   * Build secure file path
   */
  private buildSecureFilePath(userName: string, fileName: string): string {
    const filePath = path.join(this.outputPath, userName, fileName);
    
    // Ensure the resolved path is within the output directory
    const resolvedPath = path.resolve(filePath);
    const outputDirResolved = path.resolve(this.outputPath);
    
    if (!resolvedPath.startsWith(outputDirResolved)) {
      throw ErrorFactory.createValidationError('Invalid file path');
    }
    
    return filePath;
  }
  
  /**
   * Get file statistics
   */
  private async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.size > this.maxFileSize) {
        throw ErrorFactory.createValidationError('File too large');
      }
      
      return {
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        type: validateFileType(filePath)
      };
      
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw ErrorFactory.createNotFoundError('File');
      }
      throw error;
    }
  }
  
  /**
   * Set appropriate response headers
   */
  private setFileHeaders(res: Response, fileName: string, isPreview: boolean, stats: FileStats): void {
    // Set content type
    const contentType = this.getContentType(fileName);
    res.setHeader('Content-Type', contentType);
    
    // Set content length
    res.setHeader('Content-Length', stats.size);
    
    // Set last modified
    res.setHeader('Last-Modified', new Date(stats.lastModified).toUTCString());
    
    // Set disposition based on preview vs download
    const disposition = isPreview ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  
  /**
   * Get content type for file
   */
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.mp3': 'audio/mpeg'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
  
  /**
   * Stream file to response
   */
  private async streamFile(filePath: string, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        reject(ErrorFactory.createInternalServerError('Failed to stream file'));
      });
      
      fileStream.on('end', () => {
        resolve();
      });
      
      fileStream.pipe(res);
    });
  }
  
  /**
   * Legacy method for backward compatibility
   */
  validateFilePath(filePath: string): boolean {
    try {
      const normalizedPath = path.normalize(filePath);
      return !normalizedPath.includes('..') && !normalizedPath.startsWith('/');
    } catch {
      return false;
    }
  }
}