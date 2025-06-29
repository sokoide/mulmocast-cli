// Health and Configuration Routes
import { Router, Request, Response } from 'express';
import { MulmocastAPIService } from '../services/mulmocast-api.js';
import { ServerConfig } from '../types/interfaces.js';

export function createHealthRoutes(mulmocastAPIService: MulmocastAPIService, config: ServerConfig): Router {
  const router = Router();

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', service: 'mulmocast-api' });
  });

  // Configuration endpoint
  router.get('/config', (req: Request, res: Response) => {
    const serviceConfig = mulmocastAPIService.getMulmocastService().getConfiguration();
    res.json({
      success: true,
      data: {
        ...serviceConfig,
        examplesPath: config.clientPath,
        environment: {
          MULMOCAST_BASE_PATH: process.env.MULMOCAST_BASE_PATH || 'default',
          MULMOCAST_OUTPUT_PATH: process.env.MULMOCAST_OUTPUT_PATH || 'default',
          MULMOCAST_CACHE_PATH: process.env.MULMOCAST_CACHE_PATH || 'default',
          MULMOCAST_EXAMPLES_PATH: process.env.MULMOCAST_EXAMPLES_PATH || 'default',
          GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID ? 'SET' : 'NOT_SET',
          OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET'
        }
      }
    });
  });

  return router;
}