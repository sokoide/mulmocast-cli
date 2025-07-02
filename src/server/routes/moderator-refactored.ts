// Refactored Moderator Routes

import { Router } from 'express';
import { ModerationService, ModerationStatus } from '../services/moderation-service.js';
import { FileService } from '../services/file-service.js';
import { asyncHandler, validateRequest } from '../middleware/error-handler.js';
import { ErrorFactory } from '../utils/errors.js';

/**
 * Create refactored moderator routes
 */
export function createRefactoredModeratorRoutes(
  moderationService: ModerationService,
  fileService: FileService
): Router {
  const router = Router();

  // Validation functions
  const validateModerationRequest = (req: any) => {
    const { userName, baseName, status, moderatorId } = req.body;
    const errors: string[] = [];

    if (!userName || typeof userName !== 'string') {
      errors.push('userName is required and must be a string');
    }

    if (!baseName || typeof baseName !== 'string') {
      errors.push('baseName is required and must be a string');
    }

    if (!status || !Object.values(ModerationStatus).includes(status)) {
      errors.push(`status must be one of: ${Object.values(ModerationStatus).join(', ')}`);
    }

    if (!moderatorId || typeof moderatorId !== 'string') {
      errors.push('moderatorId is required and must be a string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Get pending file groups for moderation
  router.get('/pending',
    asyncHandler(async (req, res) => {
      const pendingGroups = await moderationService.getPendingFileGroups();
      
      res.json({
        success: true,
        data: pendingGroups,
        timestamp: new Date().toISOString()
      });
    })
  );

  // Get file groups for a specific user
  router.get('/user/:userName',
    asyncHandler(async (req, res) => {
      const { userName } = req.params;
      const { status } = req.query;

      if (!userName) {
        throw ErrorFactory.createValidationError('userName is required');
      }

      // Validate status if provided
      let filterStatus: ModerationStatus | undefined;
      if (status) {
        if (!Object.values(ModerationStatus).includes(status as ModerationStatus)) {
          throw ErrorFactory.createValidationError(
            `Invalid status. Must be one of: ${Object.values(ModerationStatus).join(', ')}`
          );
        }
        filterStatus = status as ModerationStatus;
      }

      const fileGroups = await moderationService.getUserFileGroups(userName, filterStatus);
      
      res.json({
        success: true,
        data: fileGroups,
        timestamp: new Date().toISOString()
      });
    })
  );

  // Moderate a file group
  router.post('/moderate',
    validateRequest(validateModerationRequest),
    asyncHandler(async (req, res) => {
      const { userName, baseName, status, moderatorId, reason } = req.body;

      await moderationService.moderateFileGroup(
        userName,
        baseName,
        status,
        moderatorId,
        reason
      );

      res.json({
        success: true,
        message: `File group ${status} successfully`,
        data: {
          userName,
          baseName,
          status,
          moderatedAt: Date.now(),
          moderatedBy: moderatorId
        },
        timestamp: new Date().toISOString()
      });
    })
  );

  // Get moderation statistics
  router.get('/statistics',
    asyncHandler(async (req, res) => {
      const stats = await moderationService.getModerationStatistics();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    })
  );

  // Get moderation status for a specific file
  router.get('/status/:userName/:filename',
    asyncHandler(async (req, res) => {
      const { userName, filename } = req.params;

      if (!userName || !filename) {
        throw ErrorFactory.createValidationError('userName and filename are required');
      }

      const status = moderationService.getFileStatus(userName, filename);
      
      res.json({
        success: true,
        data: {
          fileName: filename,
          userName,
          ...status
        },
        timestamp: new Date().toISOString()
      });
    })
  );

  // Preview file endpoint (with moderation check)
  router.get('/preview/:userName/:fileName',
    asyncHandler(async (req, res) => {
      const { userName, fileName } = req.params;

      if (!userName || !fileName) {
        throw ErrorFactory.createValidationError('userName and fileName are required');
      }

      // Security check: only allow mp4 and pdf files
      if (!fileName.endsWith('.mp4') && !fileName.endsWith('.pdf')) {
        throw ErrorFactory.createValidationError('Only MP4 and PDF files are allowed for preview');
      }

      // Check if file is approved for preview (moderators can preview pending files)
      const fileStatus = moderationService.getFileStatus(userName, fileName);
      
      // Allow preview for pending and approved files (reject only rejected files)
      if (fileStatus.status === ModerationStatus.REJECTED) {
        throw ErrorFactory.createAuthorizationError('File has been rejected and cannot be previewed');
      }

      // Use file service to handle the actual file serving with preview flag
      req.query.preview = 'true';
      await fileService.handleFileDownload(req as any, res);
    })
  );

  // Bulk moderation endpoint
  router.post('/moderate-bulk',
    validateRequest((req) => {
      const { operations, moderatorId } = req.body;
      const errors: string[] = [];

      if (!Array.isArray(operations)) {
        errors.push('operations must be an array');
      } else if (operations.length === 0) {
        errors.push('operations array cannot be empty');
      } else if (operations.length > 50) {
        errors.push('Cannot process more than 50 operations at once');
      }

      if (!moderatorId || typeof moderatorId !== 'string') {
        errors.push('moderatorId is required and must be a string');
      }

      // Validate each operation
      operations?.forEach((op: any, index: number) => {
        if (!op.userName) errors.push(`operations[${index}].userName is required`);
        if (!op.baseName) errors.push(`operations[${index}].baseName is required`);
        if (!Object.values(ModerationStatus).includes(op.status)) {
          errors.push(`operations[${index}].status is invalid`);
        }
      });

      return { isValid: errors.length === 0, errors };
    }),
    asyncHandler(async (req, res) => {
      const { operations, moderatorId, reason } = req.body;

      const results = [];
      const errors = [];

      // Process each operation
      for (const [index, operation] of operations.entries()) {
        try {
          await moderationService.moderateFileGroup(
            operation.userName,
            operation.baseName,
            operation.status,
            moderatorId,
            reason || operation.reason
          );

          results.push({
            index,
            success: true,
            userName: operation.userName,
            baseName: operation.baseName,
            status: operation.status
          });
        } catch (error) {
          errors.push({
            index,
            success: false,
            userName: operation.userName,
            baseName: operation.baseName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: errors.length === 0,
        data: {
          processed: results.length + errors.length,
          successful: results.length,
          failed: errors.length,
          results,
          errors
        },
        timestamp: new Date().toISOString()
      });
    })
  );

  // Clear moderation cache (admin endpoint)
  router.post('/clear-cache',
    asyncHandler(async (req, res) => {
      const { userName } = req.body;

      moderationService.clearCache(userName);

      res.json({
        success: true,
        message: userName ? `Cache cleared for user ${userName}` : 'All cache cleared',
        timestamp: new Date().toISOString()
      });
    })
  );

  return router;
}