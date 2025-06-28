// Main Mulmocast Generation Routes
import { Router, Request, Response } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import { userContextStorage, broadcastToClients } from '../utils/logger.js';
import { handleSSEConnection } from '../middleware/sse.js';
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

  // Generate script only
  router.post('/script', async (req: Request<{}, ApiResponse, ScriptRequest>, res: Response<ApiResponse>) => {
    const { input, template, options = {} } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const userId = options.uniqueUserName;

    return userContextStorage.run(userId, async () => {
      try {
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

        res.json({
          success: true,
          data: {
            ...result,
            fileId
          }
        });
      } catch (error) {
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
  router.post('/video', async (req: Request<{}, ApiResponse, VideoRequest>, res: Response<ApiResponse>) => {
    const { scriptPath, caption, userName, options = {} } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ error: 'Script path is required' });
    }

    return userContextStorage.run(userName, async () => {
      try {
        const videoOptions = {
          ...options,
          ...(caption && { c: caption })
        };
        console.info('videoOptions:', videoOptions);

        const result = await mulmocastAPIService.getMulmocastService().generateVideo(scriptPath, videoOptions);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate video',
          details: (error as Error).message
        });
      }
    });
  });

  // Generate PDF from existing script
  router.post('/pdf', async (req: Request<{}, ApiResponse, PdfRequest>, res: Response<ApiResponse>) => {
    const { scriptPath, pdfMode = 'slide', pdfSize = 'letter', userName } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ error: 'Script path is required' });
    }

    return userContextStorage.run(userName, async () => {
      try {
        const result = await mulmocastAPIService.getMulmocastService().generatePdf(scriptPath, pdfMode, pdfSize);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate PDF',
          details: (error as Error).message
        });
      }
    });
  });

  // Generate all outputs at once
  router.post('/generate-all', async (req: Request<{}, ApiResponse, GenerateAllRequest>, res: Response<ApiResponse>) => {
    const {
      input,
      template,
      outputs = ['script', 'video', 'pdf'],
      options = {}
    } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const userId = options.uniqueUserName;

    return userContextStorage.run(userId, async () => {
      try {
        broadcastToClients("🚀 Starting batch generation (script → video → pdf)", userId);

        const result = await mulmocastAPIService.getMulmocastService().generateAll(input, {
          templateName: template,
          outputs,
          ...options,
          progressCallback: (step: string, progress: string) => {
            broadcastToClients(`${step}: ${progress}`, userId);
          }
        });

        broadcastToClients("✅ All generation completed successfully!", userId);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
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
  router.post('/video-from-file', async (req: Request<{}, ApiResponse, FileBasedRequest>, res: Response<ApiResponse>) => {
    try {
      const { fileId, caption, options = {} } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
      }

      const generatedFile = mulmocastAPIService.getGeneratedFile(fileId);
      if (!generatedFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      const videoOptions = {
        ...options,
        ...(caption && { c: caption })
      };

      const result = await mulmocastAPIService.getMulmocastService().generateVideo(generatedFile.scriptPath, videoOptions);

      mulmocastAPIService.updateFileStatus(fileId, 'video');

      res.json({
        success: true,
        data: {
          ...result,
          fileId,
          scriptPath: generatedFile.scriptPath
        }
      });
    } catch (error) {
      console.error('Video generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate video',
        details: (error as Error).message
      });
    }
  });

  // Generate PDF from existing script file
  router.post('/pdf-from-file', async (req: Request<{}, ApiResponse, FileBasedRequest>, res: Response<ApiResponse>) => {
    try {
      const { fileId, pdfMode = 'slide', pdfSize = 'letter', options = {} } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
      }

      const generatedFile = mulmocastAPIService.getGeneratedFile(fileId);
      if (!generatedFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      const result = await mulmocastAPIService.getMulmocastService().generatePdf(generatedFile.scriptPath, pdfMode, pdfSize);

      mulmocastAPIService.updateFileStatus(fileId, 'pdf');

      res.json({
        success: true,
        data: {
          ...result,
          fileId,
          scriptPath: generatedFile.scriptPath
        }
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF',
        details: (error as Error).message
      });
    }
  });

  // SSE endpoint for real-time updates
  router.get('/events', handleSSEConnection);

  return router;
}