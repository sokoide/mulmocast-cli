// Main Express Application
import express from 'express';
import { getServerConfig, logServerConfig } from './utils/config.js';
import { setupEnhancedLogging, setupGraphAILogger, ensureGraphAILoggerOverride } from './utils/logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { MulmocastAPIService } from './services/mulmocast-api.js';
import { FileService } from './services/file-service.js';
import { createHealthRoutes } from './routes/health.js';
import { createFileRoutes } from './routes/files.js';
import { createMulmocastRoutes } from './routes/mulmocast.js';
import { createModeratorRoutes } from './routes/moderator.js';

// Initialize configuration
const config = getServerConfig();
logServerConfig(config);

// Setup enhanced logging BEFORE initializing services
setupEnhancedLogging();
setupGraphAILogger();
ensureGraphAILoggerOverride();

// Initialize services
const mulmocastAPIService = new MulmocastAPIService(config);
const fileService = new FileService(config.outputPath);

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(corsMiddleware);

// Serve static files
app.use('/client', express.static(config.clientPath));
app.use('/moderator', express.static('./src/moderator'));
app.use('/output', express.static(config.outputPath));

// Redirect /client/ to /client/index.html
app.get('/client/', (req, res) => {
  res.redirect('/client/index.html');
});

// Routes
app.use('/api', createHealthRoutes(mulmocastAPIService, config));
app.use('/api/mulmocast', createFileRoutes(mulmocastAPIService, fileService));
app.use('/api/mulmocast', createMulmocastRoutes(mulmocastAPIService));
app.use('/api/moderator', createModeratorRoutes(mulmocastAPIService));

// Start server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Mulmocast API server running on port ${config.port}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   - Health: http://localhost:${config.port}/api/health`);
  console.log(`   - Config: http://localhost:${config.port}/api/config`);
  console.log(`   - User Files: http://localhost:${config.port}/api/mulmocast/user-files/:userName`);
  console.log(`   - Script: http://localhost:${config.port}/api/mulmocast/script`);
  console.log(`   - Video (from file): http://localhost:${config.port}/api/mulmocast/video-from-file`);
  console.log(`   - PDF (from file): http://localhost:${config.port}/api/mulmocast/pdf-from-file`);
  console.log(`   - All: http://localhost:${config.port}/api/mulmocast/generate-all`);
  console.log(`   - Moderator Pending: http://localhost:${config.port}/api/moderator/pending`);
  console.log(`   - Moderate File: http://localhost:${config.port}/api/moderator/moderate`);
  console.log(`🌐 Web Client: http://localhost:${config.port}/client/index.html`);
  console.log(`🛡️  Moderator Panel: http://localhost:${config.port}/moderator/index.html`);
  console.log('');
});

export default app;