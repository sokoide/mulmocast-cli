// File Utilities for Security and Validation

export enum FileType {
  VIDEO = 'video',
  PDF = 'pdf',
  JSON = 'json',
  AUDIO = 'audio',
  UNKNOWN = 'unknown'
}

/**
 * Sanitize file name by removing dangerous characters
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid file name');
  }
  
  // Remove path separators and dangerous characters
  return fileName
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\.\./g, '')
    .replace(/^\.+/, '')
    .trim();
}

/**
 * Validate and determine file type based on extension
 */
export function validateFileType(fileName: string): FileType {
  const ext = getFileExtension(fileName);
  
  switch (ext) {
    case '.mp4':
    case '.mov':
    case '.avi':
      return FileType.VIDEO;
    case '.pdf':
      return FileType.PDF;
    case '.json':
      return FileType.JSON;
    case '.mp3':
    case '.wav':
    case '.aac':
      return FileType.AUDIO;
    default:
      return FileType.UNKNOWN;
  }
}

/**
 * Get file extension in lowercase
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
}

/**
 * Check if file type is allowed for operations
 */
export function isAllowedFileType(fileName: string, allowedTypes: FileType[]): boolean {
  const fileType = validateFileType(fileName);
  return allowedTypes.includes(fileType);
}

/**
 * Validate file name format for user files
 */
export function validateUserFileName(fileName: string): boolean {
  // Must not be empty
  if (!fileName || fileName.trim().length === 0) {
    return false;
  }
  
  // Must not contain path separators
  if (fileName.includes('/') || fileName.includes('\\')) {
    return false;
  }
  
  // Must not contain dangerous characters
  if (/[<>:"|?*]/.test(fileName)) {
    return false;
  }
  
  // Must not be a system file
  if (fileName.startsWith('.') || fileName.startsWith('..')) {
    return false;
  }
  
  // Must have valid length
  if (fileName.length > 255) {
    return false;
  }
  
  return true;
}

/**
 * Get safe file name for storage
 */
export function getSafeFileName(originalName: string, timestamp?: number): string {
  const sanitized = sanitizeFileName(originalName);
  const ext = getFileExtension(sanitized);
  const baseName = sanitized.slice(0, sanitized.length - ext.length);
  
  if (timestamp) {
    return `${baseName}_${timestamp}${ext}`;
  }
  
  return sanitized;
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSize: number = 500 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}