// Refactored Mulmocast Routes with Improved Architecture

import { Router } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import { progressService } from '../services/progress-service.js';
import { 
  asyncHandler, 
  globalErrorHandler, 
  validateRequest 
} from '../middleware/error-handler.js';
import { 
  withUserContext, 
  requireUserContext, 
  RequestWithUserContext,
  validateUserContext,
  sanitizeUserInput
} from '../middleware/user-context.js';
import { ErrorFactory } from '../utils/errors.js';
import { handleSSEConnection } from '../middleware/sse.js';

/**
 * Create refactored mulmocast routes with improved error handling and user context management
 */
export function createRefactoredMulmocastRoutes(mulmocastAPIService: MulmocastAPIService): Router {
  const router = Router();

  // Validation functions
  const validateScriptRequest = (req: RequestWithUserContext) => {
    const { input, template, options } = req.body;
    const errors: string[] = [];

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      errors.push('Input text is required and cannot be empty');
    }

    if (input && input.length > 10000) {
      errors.push('Input text is too long (max 10000 characters)');
    }

    if (template && typeof template !== 'string') {
      errors.push('Template must be a string');
    }

    if (options && typeof options !== 'object') {
      errors.push('Options must be an object');
    }

    if (options?.filename && typeof options.filename !== 'string') {
      errors.push('Filename must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const validateVideoRequest = (req: RequestWithUserContext) => {
    const { scriptPath, caption, userName } = req.body;
    const errors: string[] = [];

    if (!scriptPath || typeof scriptPath !== 'string') {
      errors.push('Script path is required');
    }

    if (caption && typeof caption !== 'string') {
      errors.push('Caption must be a string');
    }

    if (!userName || typeof userName !== 'string') {
      errors.push('User name is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const validatePdfRequest = (req: RequestWithUserContext) => {
    const { scriptPath, pdfMode, pdfSize, userName } = req.body;
    const errors: string[] = [];

    if (!scriptPath || typeof scriptPath !== 'string') {
      errors.push('Script path is required');
    }

    if (!userName || typeof userName !== 'string') {
      errors.push('User name is required');
    }

    const validModes = ['slide', 'talk', 'handout'];
    if (pdfMode && !validModes.includes(pdfMode)) {
      errors.push(`PDF mode must be one of: ${validModes.join(', ')}`);
    }

    const validSizes = ['letter', 'a4', 'legal'];
    if (pdfSize && !validSizes.includes(pdfSize)) {
      errors.push(`PDF size must be one of: ${validSizes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Generate script only
  router.post('/script',
    withUserContext,
    sanitizeUserInput,
    validateUserContext({ userIdRequired: true }),
    validateRequest(validateScriptRequest),
    asyncHandler(async (req: RequestWithUserContext, res) => {
      const { input, template, options = {} } = req.body;
      const { userId } = req.userContext!;

      // Create progress tracker
      const progressTracker = progressService.createTracker(userId, `script-${Date.now()}`);
      
      try {
        progressTracker.script('Starting script generation...');

        const result = await mulmocastAPIService.getMulmocastService().generateScript(input, {
          templateName: template,
          ...options,
          progressCallback: (step: string, progress: string) => {
            progressTracker.custom(step, progress);
          }
        });

        // Store generated file info
        const fileId = `${options.filename || 'story'}-${result.timestamp}`;
        const generatedFile = {
          id: fileId,
          filename: options.filename || 'story',
          scriptPath: result.scriptPath,
          timestamp: parseInt(result.timestamp),
          input,
          template: template || 'familyday_jpn',
          status: 'script' as const
        };
        
        mulmocastAPIService.storeGeneratedFile(fileId, generatedFile);
        progressTracker.complete('Script generation completed successfully');

        res.json({
          success: true,
          data: {
            ...result,
            fileId
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        progressTracker.error('Script generation failed');
        throw error;
      }
    })
  );

  // Generate video from existing script
  router.post('/video',
    withUserContext,
    sanitizeUserInput,
    validateUserContext({ userIdRequired: true }),
    validateRequest(validateVideoRequest),
    asyncHandler(async (req: RequestWithUserContext, res) => {
      const { scriptPath, caption, userName, options = {} } = req.body;
      const { userId } = req.userContext!;

      // Create progress tracker
      const progressTracker = progressService.createTracker(userId, `video-${Date.now()}`);
      
      try {
        progressTracker.video('Starting video generation from existing script...');
        
        const videoOptions = {
          ...options,
          ...(caption && { c: caption })
        };

        const result = await mulmocastAPIService.getMulmocastService().generateVideo(scriptPath, {
          ...videoOptions,
          progressCallback: (step: string, progress: string) => {
            progressTracker.custom(step, progress);
          }
        });

        progressTracker.complete('Video generation completed successfully');

        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        progressTracker.error('Video generation failed');
        throw error;
      }
    })
  );

  // Generate PDF from existing script
  router.post('/pdf',
    withUserContext,
    sanitizeUserInput,
    validateUserContext({ userIdRequired: true }),
    validateRequest(validatePdfRequest),
    asyncHandler(async (req: RequestWithUserContext, res) => {
      const { scriptPath, pdfMode = 'slide', pdfSize = 'letter', userName } = req.body;
      const { userId } = req.userContext!;

      // Create progress tracker
      const progressTracker = progressService.createTracker(userId, `pdf-${Date.now()}`);
      
      try {
        progressTracker.pdf(`Starting PDF generation (${pdfMode}, ${pdfSize})...`);
        
        const result = await mulmocastAPIService.getMulmocastService().generatePdf(
          scriptPath, 
          pdfMode, 
          pdfSize, 
          {
            progressCallback: (step: string, progress: string) => {
              progressTracker.custom(step, progress);
            }
          }
        );

        progressTracker.complete('PDF generation completed successfully');

        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        progressTracker.error('PDF generation failed');
        throw error;
      }
    })
  );

  // Generate all outputs at once
  router.post('/generate-all',
    withUserContext,
    sanitizeUserInput,
    validateUserContext({ userIdRequired: true }),
    validateRequest(validateScriptRequest),
    asyncHandler(async (req: RequestWithUserContext, res) => {
      const { input, template, outputs = ['script', 'video', 'pdf'], options = {} } = req.body;
      const { userId } = req.userContext!;

      // Create progress tracker
      const progressTracker = progressService.createTracker(userId, `generate-all-${Date.now()}`);
      
      try {
        progressTracker.info('Starting batch generation (script → video → pdf)');

        const result = await mulmocastAPIService.getMulmocastService().generateAll(input, {
          templateName: template,
          outputs,
          ...options,
          progressCallback: (step: string, progress: string) => {
            progressTracker.custom(step, progress);
          }
        });

        progressTracker.complete('All generation completed successfully');

        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        progressTracker.error('Batch generation failed');
        
        // Extract error details for better user feedback
        const { message, brokenJson } = mulmocastAPIService.extractErrorDetails(error as Error);
        
        if (brokenJson) {
          console.warn('WARNING: Broken JSON detected during batch generation:', brokenJson);
        }

        throw error;
      }
    })
  );

  // Generate video from existing script file
  router.post('/video-from-file',
    withUserContext,
    sanitizeUserInput,
    validateUserContext({ userIdRequired: true }),
    asyncHandler(async (req: RequestWithUserContext, res) => {
      const { fileId, caption, options = {} } = req.body;
      const { userId } = req.userContext!;

      if (!fileId) {
        throw ErrorFactory.createValidationError('File ID is required');
      }

      const generatedFile = mulmocastAPIService.getGeneratedFile(fileId);
      if (!generatedFile) {
        throw ErrorFactory.createNotFoundError('File');
      }

      // Create progress tracker
      const progressTracker = progressService.createTracker(userId, `video-from-file-${Date.now()}`);
      
      try {
        progressTracker.video('Starting video generation from existing script...');

        const videoOptions = {
          ...options,
          ...(caption && { c: caption })
        };

        const result = await mulmocastAPIService.getMulmocastService().generateVideo(
          generatedFile.scriptPath, 
          {
            ...videoOptions,
            progressCallback: (step: string, progress: string) => {
              progressTracker.custom(step, progress);
            }
          }
        );

        mulmocastAPIService.updateFileStatus(fileId, 'video');
        progressTracker.complete('Video generation completed successfully');

        res.json({
          success: true,
          data: {
            ...result,
            fileId,
            scriptPath: generatedFile.scriptPath
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        progressTracker.error('Video generation failed');
        throw error;
      }
    })
  );

  // Generate PDF from existing script file
  router.post('/pdf-from-file',
    withUserContext,
    sanitizeUserInput,
    validateUserContext({ userIdRequired: true }),
    asyncHandler(async (req: RequestWithUserContext, res) => {
      const { fileId, pdfMode = 'slide', pdfSize = 'letter', options = {} } = req.body;
      const { userId } = req.userContext!;

      if (!fileId) {
        throw ErrorFactory.createValidationError('File ID is required');
      }

      const generatedFile = mulmocastAPIService.getGeneratedFile(fileId);
      if (!generatedFile) {
        throw ErrorFactory.createNotFoundError('File');
      }

      // Create progress tracker
      const progressTracker = progressService.createTracker(userId, `pdf-from-file-${Date.now()}`);
      
      try {
        progressTracker.pdf(`Starting PDF generation (${pdfMode}, ${pdfSize})...`);

        const result = await mulmocastAPIService.getMulmocastService().generatePdf(
          generatedFile.scriptPath, 
          pdfMode, 
          pdfSize, 
          {
            progressCallback: (step: string, progress: string) => {
              progressTracker.custom(step, progress);
            }
          }
        );

        mulmocastAPIService.updateFileStatus(fileId, 'pdf');
        progressTracker.complete('PDF generation completed successfully');

        res.json({
          success: true,
          data: {
            ...result,
            fileId,
            scriptPath: generatedFile.scriptPath
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        progressTracker.error('PDF generation failed');
        throw error;
      }
    })
  );

  // SSE endpoint for real-time updates
  router.get('/events', handleSSEConnection);

  // Test endpoint to send a test message (development only)
  if (process.env.NODE_ENV === 'development') {
    router.post('/test-message',
      validateRequest((req) => {
        const { userId, message } = req.body;
        const errors: string[] = [];

        if (!userId) errors.push('userId is required');
        if (!message) errors.push('message is required');

        return { isValid: errors.length === 0, errors };
      }),
      asyncHandler(async (req, res) => {
        const { userId, message } = req.body;
        
        const progressTracker = progressService.createTracker(userId, `test-${Date.now()}`);
        progressTracker.info(message);

        res.json({
          success: true,
          message: 'Test message sent',
          timestamp: new Date().toISOString()
        });
      })
    );
  }

  return router;
}