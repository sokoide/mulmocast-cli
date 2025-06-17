// Express.js integration example
import express, { Request, Response } from 'express';
import path from 'path';
import { MulmocastService } from '../src/lib/mulmocast-service.js';

// Configuration from environment variables
const BASE_PATH = process.env.MULMOCAST_BASE_PATH || process.cwd();
const OUTPUT_PATH = process.env.MULMOCAST_OUTPUT_PATH || path.join(BASE_PATH, 'output');
const CACHE_PATH = process.env.MULMOCAST_CACHE_PATH || path.join(OUTPUT_PATH, 'cache');
const EXAMPLES_PATH = process.env.MULMOCAST_EXAMPLES_PATH || './examples';

const app = express();
app.use(express.json());

console.log(`🔧 Configuration:`);
console.log(`   - Base Path: ${BASE_PATH}`);
console.log(`   - Output Path: ${OUTPUT_PATH}`);
console.log(`   - Cache Path: ${CACHE_PATH}`);
console.log(`   - Examples Path: ${EXAMPLES_PATH}`);

// Serve static files (HTML, CSS, JS) from examples directory
app.use('/client', express.static(EXAMPLES_PATH));

// Serve output files for download and preview
app.use('/output', express.static(OUTPUT_PATH));

// CORS configuration for browser clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const mulmocastService = new MulmocastService({
  basePath: BASE_PATH,
  outputPath: OUTPUT_PATH,
  cachePath: CACHE_PATH
});

// Store generated files in memory (in production, use database)
interface GeneratedFile {
  id: string;
  filename: string;
  scriptPath: string;
  timestamp: number;
  input: string;
  template: string;
  status: 'script' | 'video' | 'pdf' | 'all';
}

const generatedFiles = new Map<string, GeneratedFile>();

// SSE (Server-Sent Events) for real-time updates
interface SSEClient {
  response: Response;
  userId?: string;
}

const sseClients: SSEClient[] = [];

// Function to broadcast messages to all connected clients
function broadcastToClients(message: string, userId?: string) {
  const targetClients = userId
    ? sseClients.filter(client => client.userId === userId)
    : sseClients;

  targetClients.forEach(client => {
    try {
      client.response.write(`data: ${JSON.stringify({ message, timestamp: Date.now(), userId })}\n\n`);
    } catch (error) {
      // Remove disconnected clients
      const index = sseClients.indexOf(client);
      if (index > -1) {
        sseClients.splice(index, 1);
      }
    }
  });
}

// Override console.log to broadcast messages to clients
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  // Filter out debug messages and verbose logs, but allow most other messages
  const isDebugMessage = message.includes('GraphAI.debug') ||
    message.includes('[DEBUG]') ||
    message.includes('debug:') ||
    message.toLowerCase().includes('filtercomplex') ||
    message.includes('🚀 Mulmocast API server running') ||
    message.includes('📋 API Endpoints') ||
    message.includes('🌐 Web Client');

  if (!isDebugMessage) {
    broadcastToClients(message);
  }

  // Call original console.log
  originalConsoleLog.apply(console, args);
};

// Also override console.error and console.warn
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  broadcastToClients(`ERROR: ${message}`);
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  broadcastToClients(`WARNING: ${message}`);
  originalConsoleWarn.apply(console, args);
};

// Override GraphAILogger to broadcast messages
const setupGraphAILogger = async () => {
  try {
    const { GraphAILogger } = await import('graphai');

    // Override info method
    const originalInfo = GraphAILogger.info;
    GraphAILogger.info = (...args: any[]) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      if (!message.includes('[DEBUG]') && !message.toLowerCase().includes('filtercomplex')) {
        broadcastToClients(`INFO: ${message}`);
      }

      return originalInfo.apply(GraphAILogger, args);
    };

    // Override log method
    const originalLog = GraphAILogger.log;
    GraphAILogger.log = (...args: any[]) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      if (!message.includes('[DEBUG]') && !message.toLowerCase().includes('filtercomplex')) {
        broadcastToClients(`LOG: ${message}`);
      }

      return originalLog.apply(GraphAILogger, args);
    };

  } catch (error) {
    console.log('GraphAILogger not available yet, will override when loaded');
  }
};

// Setup GraphAI logger override
setupGraphAILogger();

interface ScriptRequest {
  input: string;
  template?: string;
  options?: any;
}

interface VideoRequest {
  scriptPath: string;
  caption?: string; // Language for captions (ja, en, etc.)
  options?: any;
}

interface PdfRequest {
  scriptPath: string;
  pdfMode?: string;
  pdfSize?: string;
}

interface GenerateAllRequest {
  input: string;
  template?: string;
  outputs?: ('script' | 'video' | 'pdf')[];
  options?: any;
}

interface FileBasedRequest {
  fileId: string;
  caption?: string; // Language for captions (ja, en, etc.)
  options?: any;
}

// Generate script only
app.post('/api/mulmocast/script', async (req: Request<{}, {}, ScriptRequest>, res: Response) => {
  try {
    const { input, template, options = {} } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const result = await mulmocastService.generateScript(input, {
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
    generatedFiles.set(fileId, generatedFile);

    res.json({
      success: true,
      data: {
        ...result,
        fileId
      }
    });
  } catch (error) {
    console.error('Script generation error:', error);

    // エラーメッセージから壊れたJSONを抽出して警告として表示
    const errorMessage = (error as Error).message;
    let brokenJson = null;

    // JSON parse error や schema validation error の場合、詳細を抽出
    try {
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON')) {
        // JSON parse エラーの場合は全体のエラーメッセージを保持
        brokenJson = errorMessage;
      } else if (errorMessage.includes('Generated script was broken')) {
        // GraphAI からの生成エラーの場合
        brokenJson = errorMessage;
      }
    } catch (e) {
      // エラー処理中のエラーは無視
    }

    // クライアントに詳細なエラー情報を送信
    const response: any = {
      error: 'Failed to generate script',
      details: errorMessage
    };

    if (brokenJson) {
      response.brokenJson = brokenJson;
      console.warn('WARNING: Broken JSON detected during script generation:', brokenJson);
    }

    res.status(500).json(response);
  }
});

// Generate video from existing script
app.post('/api/mulmocast/video', async (req: Request<{}, {}, VideoRequest>, res: Response) => {
  try {
    const { scriptPath, caption, options = {} } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ error: 'Script path is required' });
    }

    // Add caption option to the options object
    const videoOptions = {
      ...options,
      ...(caption && { c: caption }) // Add -c equivalent option
    };
    console.info('videoOPtions:', videoOptions);

    const result = await mulmocastService.generateVideo(scriptPath, videoOptions);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({
      error: 'Failed to generate video',
      details: (error as Error).message
    });
  }
});

// Generate PDF from existing script
app.post('/api/mulmocast/pdf', async (req: Request<{}, {}, PdfRequest>, res: Response) => {
  try {
    const { scriptPath, pdfMode = 'slide', pdfSize = 'letter' } = req.body;

    if (!scriptPath) {
      return res.status(400).json({ error: 'Script path is required' });
    }

    const result = await mulmocastService.generatePdf(scriptPath, pdfMode, pdfSize);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: (error as Error).message
    });
  }
});

// Generate all outputs at once
app.post('/api/mulmocast/generate-all', async (req: Request<{}, {}, GenerateAllRequest>, res: Response) => {
  try {
    const {
      input,
      template,
      outputs = ['script', 'video', 'pdf'],
      options = {}
    } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const result = await mulmocastService.generateAll(input, {
      templateName: template,
      outputs,
      ...options
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Generation error:', error);

    // エラーメッセージから壊れたJSONを抽出して警告として表示
    const errorMessage = (error as Error).message;
    let brokenJson = null;

    // JSON parse error や schema validation error の場合、詳細を抽出
    try {
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON')) {
        // JSON parse エラーの場合は全体のエラーメッセージを保持
        brokenJson = errorMessage;
      } else if (errorMessage.includes('Generated script was broken')) {
        // GraphAI からの生成エラーの場合
        brokenJson = errorMessage;
      }
    } catch (e) {
      // エラー処理中のエラーは無視
    }

    // クライアントに詳細なエラー情報を送信
    const response: any = {
      error: 'Failed to generate content',
      details: errorMessage
    };

    if (brokenJson) {
      response.brokenJson = brokenJson;
      console.warn('WARNING: Broken JSON detected during batch generation:', brokenJson);
    }

    res.status(500).json(response);
  }
});

// Get user's JSON files
app.get('/api/mulmocast/user-files/:userName', async (req: Request, res: Response) => {
  try {
    const { userName } = req.params;

    if (!userName) {
      return res.status(400).json({ error: 'User name is required' });
    }

    const files = await mulmocastService.getUserFiles(userName);

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
app.get('/api/mulmocast/user-media/:userName', async (req: Request, res: Response) => {
  try {
    const { userName } = req.params;

    if (!userName) {
      return res.status(400).json({ error: 'User name is required' });
    }

    const mediaFiles = await mulmocastService.getUserMediaFiles(userName);

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
app.get('/api/mulmocast/download/:userName/:fileName', async (req: Request, res: Response) => {
  try {
    const { userName, fileName } = req.params;
    const path = await import('path');
    const fs = await import('fs');

    if (!userName || !fileName) {
      return res.status(400).json({ error: 'User name and file name are required' });
    }

    // Security check: only allow mp4 and pdf files
    if (!fileName.endsWith('.mp4') && !fileName.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only MP4 and PDF files are allowed for download' });
    }

    const filePath = path.join(OUTPUT_PATH, userName, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
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
});

// Generate video from existing script file
app.post('/api/mulmocast/video-from-file', async (req: Request<{}, {}, FileBasedRequest>, res: Response) => {
  try {
    const { fileId, caption, options = {} } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const generatedFile = generatedFiles.get(fileId);
    if (!generatedFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Add caption option to the options object
    const videoOptions = {
      ...options,
      ...(caption && { c: caption }) // Add -c equivalent option
    };

    const result = await mulmocastService.generateVideo(generatedFile.scriptPath, videoOptions);

    // Update status
    generatedFile.status = 'video';
    generatedFiles.set(fileId, generatedFile);

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
      error: 'Failed to generate video',
      details: (error as Error).message
    });
  }
});

// Generate PDF from existing script file
app.post('/api/mulmocast/pdf-from-file', async (req: Request<{}, {}, FileBasedRequest & { pdfMode?: string; pdfSize?: string }>, res: Response) => {
  try {
    const { fileId, pdfMode = 'slide', pdfSize = 'letter', options = {} } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const generatedFile = generatedFiles.get(fileId);
    if (!generatedFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    const result = await mulmocastService.generatePdf(generatedFile.scriptPath, pdfMode, pdfSize);

    // Update status
    generatedFile.status = 'pdf';
    generatedFiles.set(fileId, generatedFile);

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
      error: 'Failed to generate PDF',
      details: (error as Error).message
    });
  }
});

// SSE endpoint for real-time updates
app.get('/api/mulmocast/events', (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Add client to the list
  const client: SSEClient = { response: res, userId };
  sseClients.push(client);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    message: `Connected to real-time updates${userId ? ` for user ${userId}` : ''}`,
    timestamp: Date.now(),
    type: 'connection'
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    const index = sseClients.indexOf(client);
    if (index > -1) {
      sseClients.splice(index, 1);
    }
  });
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'mulmocast-api' });
});

// Configuration endpoint
app.get('/api/config', (req: Request, res: Response) => {
  const config = mulmocastService.getConfiguration();
  res.json({
    success: true,
    data: {
      ...config,
      examplesPath: EXAMPLES_PATH,
      environment: {
        MULMOCAST_BASE_PATH: process.env.MULMOCAST_BASE_PATH || 'default',
        MULMOCAST_OUTPUT_PATH: process.env.MULMOCAST_OUTPUT_PATH || 'default',
        MULMOCAST_CACHE_PATH: process.env.MULMOCAST_CACHE_PATH || 'default',
        MULMOCAST_EXAMPLES_PATH: process.env.MULMOCAST_EXAMPLES_PATH || 'default'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mulmocast API server running on port ${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Config: http://localhost:${PORT}/api/config`);
  console.log(`   - User Files: http://localhost:${PORT}/api/mulmocast/user-files/:userName`);
  console.log(`   - Script: http://localhost:${PORT}/api/mulmocast/script`);
  console.log(`   - Video (from file): http://localhost:${PORT}/api/mulmocast/video-from-file`);
  console.log(`   - PDF (from file): http://localhost:${PORT}/api/mulmocast/pdf-from-file`);
  console.log(`   - All: http://localhost:${PORT}/api/mulmocast/generate-all`);
  console.log(`🌐 Web Client: http://localhost:${PORT}/client/client-example.html`);
  console.log('');
});

export default app;