// File Management Routes
import { Router, Request, Response } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import { FileService } from '../services/file-service.js';
import { ModerationService } from '../services/moderation-service.js';

export function createFileRoutes(mulmocastAPIService: MulmocastAPIService, fileService: FileService): Router {
  const router = Router();
  
  // Initialize moderation service
  const config = mulmocastAPIService.getMulmocastService().getConfiguration();
  const moderationService = new ModerationService(config.outputPath);

  // Get user's JSON files
  router.get('/user-files/:userName', async (req: any, res: any) => {
    try {
      const { userName } = req.params;

      if (!userName) {
        return res.status(400).json({ error: 'User name is required' });
      }

      const files = await mulmocastAPIService.getMulmocastService().getUserFiles(userName);

      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get user files error:', error);
      res.status(500).json({
        error: 'Failed to get user files',
        details: (error as Error).message
      });
    }
  });

  // Get user's media files (MP4, PDF) with moderation status
  router.get('/user-media/:userName', async (req: any, res: any) => {
    try {
      const { userName } = req.params;

      if (!userName) {
        return res.status(400).json({ error: 'User name is required' });
      }

      const mediaFiles = await mulmocastAPIService.getMulmocastService().getUserMediaFiles(userName);
      
      // Add moderation status to each file
      const filesWithModerationStatus = mediaFiles.map((file: any) => {
        const moderationStatus = moderationService.getFileStatus(userName, file.filename);
        console.log(`Debug file: ${file.filename}, timestamp: ${file.timestamp}`);
        const result = {
          ...file,
          lastModified: file.timestamp, // Add lastModified field for client compatibility
          moderationStatus: moderationStatus.status,
          moderatedBy: moderationStatus.moderatedBy,
          moderatedAt: moderationStatus.moderatedAt,
          canPreview: moderationStatus.status === 'approved',
          canDownload: moderationStatus.status === 'approved'
        };
        console.log(`Debug result lastModified: ${result.lastModified}`);
        return result;
      });

      res.json({
        success: true,
        data: filesWithModerationStatus
      });
    } catch (error) {
      console.error('Get user media files error:', error);
      res.status(500).json({
        error: 'Failed to get user media files',
        details: (error as Error).message
      });
    }
  });

  // Download file endpoint
  router.get('/download/:userName/:fileName', async (req: any, res: any) => {
    await fileService.handleFileDownload(req, res);
  });

  return router;
}