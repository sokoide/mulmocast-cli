// Moderator Management Routes
import { Router, Request, Response } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import path from 'path';
import fs from 'fs';

export function createModeratorRoutes(mulmocastAPIService: MulmocastAPIService): Router {
  const router = Router();

  // Get all pending file groups for moderation
  router.get('/pending', async (req: any, res: any) => {
    try {
      const pendingGroups = await mulmocastAPIService.getMulmocastService().getAllPendingFileGroups();

      res.json({
        success: true,
        data: pendingGroups
      });
    } catch (error) {
      console.error('Get pending file groups error:', error);
      res.status(500).json({
        error: 'Failed to get pending file groups',
        details: (error as Error).message
      });
    }
  });

  // Moderate a file group (approve/reject both PDF and video)
  router.post('/moderate', async (req: any, res: any) => {
    try {
      const { userName, baseName, status, moderatorId } = req.body;

      if (!userName || !baseName || !status || !moderatorId) {
        return res.status(400).json({ 
          error: 'userName, baseName, status, and moderatorId are required' 
        });
      }

      if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ 
          error: 'Status must be either "approved" or "rejected"' 
        });
      }

      await mulmocastAPIService.getMulmocastService().moderateFileGroup(
        userName, 
        baseName, 
        status, 
        moderatorId
      );

      res.json({
        success: true,
        message: `File group ${status} successfully`
      });
    } catch (error) {
      console.error('Moderate file group error:', error);
      res.status(500).json({
        error: 'Failed to moderate file group',
        details: (error as Error).message
      });
    }
  });

  // Preview a file (serve the file for preview)
  router.get('/preview/:userName/:filename', async (req: any, res: any) => {
    try {
      const { userName, filename } = req.params;

      if (!userName || !filename) {
        return res.status(400).json({ error: 'User name and file name are required' });
      }

      // Security check: only allow mp4 and pdf files
      if (!filename.endsWith('.mp4') && !filename.endsWith('.pdf')) {
        return res.status(400).json({ error: 'Only MP4 and PDF files are allowed for preview' });
      }

      const filePath = mulmocastAPIService.getMulmocastService().getFilePreviewPath(userName, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Set appropriate headers for preview (not download)
      res.setHeader('Content-Type', filename.endsWith('.mp4') ? 'video/mp4' : 'application/pdf');
      
      // For PDF, set inline display
      if (filename.endsWith('.pdf')) {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      }

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Preview file error:', error);
      res.status(500).json({
        error: 'Failed to preview file',
        details: (error as Error).message
      });
    }
  });

  return router;
}