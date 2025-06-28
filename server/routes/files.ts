// File Management Routes
import { Router, Request, Response } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import { FileService } from '../services/file-service.js';

export function createFileRoutes(mulmocastAPIService: MulmocastAPIService, fileService: FileService): Router {
  const router = Router();

  // Get user's JSON files
  router.get('/user-files/:userName', async (req: Request, res: Response) => {
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

  // Get user's media files (MP4, PDF)
  router.get('/user-media/:userName', async (req: Request, res: Response) => {
    try {
      const { userName } = req.params;

      if (!userName) {
        return res.status(400).json({ error: 'User name is required' });
      }

      const mediaFiles = await mulmocastAPIService.getMulmocastService().getUserMediaFiles(userName);

      res.json({
        success: true,
        data: mediaFiles
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
  router.get('/download/:userName/:fileName', async (req: Request, res: Response) => {
    await fileService.handleFileDownload(req, res);
  });

  return router;
}