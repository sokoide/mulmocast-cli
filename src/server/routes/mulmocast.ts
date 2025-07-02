// Main Mulmocast Generation Routes
import { Router, Request, Response } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import { ModerationService, ModerationStatus } from '../services/moderation-service.js';
import { userContextStorage, broadcastToClients, addActiveUser, removeActiveUser } from '../utils/logger.js';
import { handleSSEConnection } from '../middleware/sse.js';
import path from 'path';
import {
  ScriptRequest,
  VideoRequest,
  PdfRequest,
  GenerateAllRequest,
  FileBasedRequest,
  GeneratedFile,
  ApiResponse
} from '../types/interfaces.js';

export function createMulmocastRoutes(mulmocastAPIService: MulmocastAPIService): Router {
  const router = Router();
  
  // Initialize moderation service
  const config = mulmocastAPIService.getMulmocastService().getConfiguration();
  const moderationService = new ModerationService(config.outputPath);
  
  // Helper function to mark generated files as pending moderation
  async function markFilesForModeration(userName: string, filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      if (filePath && (filePath.endsWith('.mp4') || filePath.endsWith('.pdf'))) {
        const fileName = path.basename(filePath);
        
        try {
          await moderationService.markFilePending(userName, fileName);
          console.log(`Marked for moderation: ${userName}/${fileName}`);
        } catch (error) {
          console.warn(`Failed to mark file for moderation: ${fileName}`, error);
        }
      }
    }
  }

  // Generate script only
  (router.post as any)('/script', async (req: Request, res: Response) => {
    const { input, template, options = {} } = req.body;

    if (!input) {
      return res.status(400).json({ success: false, error: 'Input text is required' });
    }

    const userId = options.uniqueUserName;

    return userContextStorage.run(userId, async () => {
      try {
        addActiveUser(userId);
        const result = await mulmocastAPIService.getMulmocastService().generateScript(input, {
          templateName: template,
          ...options
        });

        // Store generated file info
        const fileId = `${options.filename || 'story'}-${result.timestamp}`;
        const generatedFile: GeneratedFile = {
          id: fileId,
          filename: options.filename || 'story',
          scriptPath: result.scriptPath,
          timestamp: parseInt(result.timestamp),
          input,
          template: template || 'familyday_jpn',
          status: 'script'
        };
        mulmocastAPIService.storeGeneratedFile(fileId, generatedFile);

        removeActiveUser(userId);
        res.json({
          success: true,
          data: {
            ...result,
            fileId
          }
        });
      } catch (error) {
        removeActiveUser(userId);
        console.error('Script generation error:', error);
        const { message, brokenJson } = mulmocastAPIService.extractErrorDetails(error as Error);

        const response: ApiResponse = {
          success: false,
          error: 'Failed to generate script',
          details: message
        };

        if (brokenJson) {
          response.brokenJson = brokenJson;
          console.warn('WARNING: Broken JSON detected during script generation:', brokenJson);
        }

        res.status(500).json(response);
      }
    });
  });

  // Generate video from existing script
  (router.post as any)('/video', async (req: Request, res: Response) => {
    const { scriptPath, caption, userName, options = {} } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ success: false, error: 'Script path is required' });
    }

    return userContextStorage.run(userName, async () => {
      try {
        addActiveUser(userName);
        broadcastToClients("🎬 Starting video generation from existing script...", userName);
        
        const videoOptions = {
          ...options,
          ...(caption && { c: caption })
        };
        console.info('videoOptions:', videoOptions);

        // Add progress callback for detailed video generation steps
        const result = await mulmocastAPIService.getMulmocastService().generateVideo(scriptPath, {
          ...videoOptions,
          progressCallback: (step: string, progress: string) => {
            broadcastToClients(`${step}: ${progress}`, userName);
          }
        });

        // Mark generated video for moderation
        if (result.videoPath) {
          await markFilesForModeration(userName, [result.videoPath]);
          broadcastToClients("📋 Video marked for moderation", userName);
        }

        broadcastToClients("✅ Video generation completed!", userName);
        removeActiveUser(userName);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        removeActiveUser(userName);
        console.error('Video generation error:', error);
        broadcastToClients("❌ Video generation failed", userName);
        res.status(500).json({
          success: false,
          error: 'Failed to generate video',
          details: (error as Error).message
        });
      }
    });
  });

  // Generate PDF from existing script
  (router.post as any)('/pdf', async (req: Request, res: Response) => {
    const { scriptPath, pdfMode = 'slide', pdfSize = 'letter', userName } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ success: false, error: 'Script path is required' });
    }

    return userContextStorage.run(userName, async () => {
      try {
        addActiveUser(userName);
        broadcastToClients(`📄 Starting PDF generation (${pdfMode}, ${pdfSize})...`, userName);
        
        // Add progress callback for detailed PDF generation steps
        const result = await mulmocastAPIService.getMulmocastService().generatePdf(scriptPath, pdfMode, pdfSize, {
          progressCallback: (step: string, progress: string) => {
            broadcastToClients(`${step}: ${progress}`, userName);
          }
        });

        // Mark generated PDF for moderation
        if (result.pdfPath) {
          await markFilesForModeration(userName, [result.pdfPath]);
          broadcastToClients("📋 PDF marked for moderation", userName);
        }

        broadcastToClients("✅ PDF generation completed!", userName);
        removeActiveUser(userName);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        removeActiveUser(userName);
        console.error('PDF generation error:', error);
        broadcastToClients("❌ PDF generation failed", userName);
        res.status(500).json({
          success: false,
          error: 'Failed to generate PDF',
          details: (error as Error).message
        });
      }
    });
  });

  // Generate all outputs at once
  (router.post as any)('/generate-all', async (req: Request, res: Response) => {
    const {
      input,
      template,
      outputs = ['script', 'video', 'pdf'],
      options = {}
    } = req.body;

    if (!input) {
      return res.status(400).json({ success: false, error: 'Input text is required' });
    }

    const userId = options.uniqueUserName;

    return userContextStorage.run(userId, async () => {
      try {
        addActiveUser(userId);
        broadcastToClients("🚀 Starting batch generation (script → video → pdf)", userId);

        const result = await mulmocastAPIService.getMulmocastService().generateAll(input, {
          templateName: template,
          outputs,
          ...options,
          progressCallback: (step: string, progress: string) => {
            broadcastToClients(`${step}: ${progress}`, userId);
          }
        });

        // Mark generated files for moderation
        const filesToModerate = [];
        if (result.videoPath) filesToModerate.push(result.videoPath);
        if (result.pdfPath) filesToModerate.push(result.pdfPath);
        
        if (filesToModerate.length > 0) {
          await markFilesForModeration(userId, filesToModerate);
          broadcastToClients(`📋 ${filesToModerate.length} file(s) marked for moderation`, userId);
        }

        broadcastToClients("✅ All generation completed successfully!", userId);
        removeActiveUser(userId);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        removeActiveUser(userId);
        console.error('Generation error:', error);
        broadcastToClients("❌ Batch generation failed", userId);

        const { message, brokenJson } = mulmocastAPIService.extractErrorDetails(error as Error);

        const response: ApiResponse = {
          success: false,
          error: 'Failed to generate content',
          details: message
        };

        if (brokenJson) {
          response.brokenJson = brokenJson;
          console.warn('WARNING: Broken JSON detected during batch generation:', brokenJson);
        }

        res.status(500).json(response);
      }
    });
  });

  // Generate video from existing script file
  (router.post as any)('/video-from-file', async (req: Request, res: Response) => {
    const { fileId, caption, options = {} } = req.body;

    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID is required' });
    }

    const generatedFile = mulmocastAPIService.getGeneratedFile(fileId);
    if (!generatedFile) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const userName = options.uniqueUserName;

    return userContextStorage.run(userName, async () => {
      try {
        addActiveUser(userName);
        broadcastToClients("🎬 Starting video generation from existing script...", userName);

        const videoOptions = {
          ...options,
          ...(caption && { c: caption })
        };

        // Add progress callback for detailed video generation steps
        const result = await mulmocastAPIService.getMulmocastService().generateVideo(generatedFile.scriptPath, {
          ...videoOptions,
          progressCallback: (step: string, progress: string) => {
            broadcastToClients(`${step}: ${progress}`, userName);
          }
        });

        mulmocastAPIService.updateFileStatus(fileId, 'video');

        broadcastToClients("✅ Video generation completed!", userName);
        removeActiveUser(userName);

        res.json({
          success: true,
          data: {
            ...result,
            fileId,
            scriptPath: generatedFile.scriptPath
          }
        });
      } catch (error) {
        removeActiveUser(userName);
        console.error('Video generation error:', error);
        broadcastToClients("❌ Video generation failed", userName);
        res.status(500).json({
          success: false,
          error: 'Failed to generate video',
          details: (error as Error).message
        });
      }
    });
  });

  // Generate PDF from existing script file
  (router.post as any)('/pdf-from-file', async (req: Request, res: Response) => {
    const { fileId, pdfMode = 'slide', pdfSize = 'letter', options = {} } = req.body;

    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID is required' });
    }

    const generatedFile = mulmocastAPIService.getGeneratedFile(fileId);
    if (!generatedFile) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const userName = options.uniqueUserName;

    return userContextStorage.run(userName, async () => {
      try {
        addActiveUser(userName);
        broadcastToClients(`📄 Starting PDF generation (${pdfMode}, ${pdfSize})...`, userName);

        // Add progress callback for detailed PDF generation steps
        const result = await mulmocastAPIService.getMulmocastService().generatePdf(generatedFile.scriptPath, pdfMode, pdfSize, {
          progressCallback: (step: string, progress: string) => {
            broadcastToClients(`${step}: ${progress}`, userName);
          }
        });

        mulmocastAPIService.updateFileStatus(fileId, 'pdf');

        broadcastToClients("✅ PDF generation completed!", userName);
        removeActiveUser(userName);

        res.json({
          success: true,
          data: {
            ...result,
            fileId,
            scriptPath: generatedFile.scriptPath
          }
        });
      } catch (error) {
        removeActiveUser(userName);
        console.error('PDF generation error:', error);
        broadcastToClients("❌ PDF generation failed", userName);
        res.status(500).json({
          success: false,
          error: 'Failed to generate PDF',
          details: (error as Error).message
        });
      }
    });
  });

  // SSE endpoint for real-time updates
  router.get('/events', handleSSEConnection);

  // Test endpoint to send a test message
  router.post('/test-message', (req: Request, res: Response) => {
    const { userId, message } = req.body;
    if (userId && message) {
      broadcastToClients(message, userId);
      res.json({ success: true, message: 'Test message sent' });
    } else {
      res.status(400).json({ success: false, error: 'userId and message required' });
    }
  });

  return router;
}