// File Service for handling downloads and static files
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

export class FileService {
  constructor(private outputPath: string) {}

  async handleFileDownload(req: Request, res: Response): Promise<void> {
    try {
      const { userName, fileName } = req.params;

      if (!userName || !fileName) {
        res.status(400).json({ error: 'User name and file name are required' });
        return;
      }

      // Security check: only allow mp4 and pdf files
      if (!fileName.endsWith('.mp4') && !fileName.endsWith('.pdf')) {
        res.status(400).json({ error: 'Only MP4 and PDF files are allowed for download' });
        return;
      }

      const filePath = path.join(this.outputPath, userName, fileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', fileName.endsWith('.mp4') ? 'video/mp4' : 'application/pdf');

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({
        error: 'Failed to download file',
        details: (error as Error).message
      });
    }
  }

  validateFilePath(filePath: string): boolean {
    // Basic security check - ensure path doesn't contain dangerous patterns
    const normalizedPath = path.normalize(filePath);
    return !normalizedPath.includes('..') && !normalizedPath.startsWith('/');
  }
}