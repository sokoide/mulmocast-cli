// Express.js integration example
import express, { Request, Response } from 'express';
import { MulmocastService } from '../src/lib/mulmocast-service.js';

const app = express();
app.use(express.json());

// Serve static files (HTML, CSS, JS) from examples directory
app.use('/client', express.static('./examples'));

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

const mulmocastService = new MulmocastService();

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

  // Only broadcast meaningful messages (filter out verbose logs)
  if (message.includes('Agent:') ||
    message.includes('ERROR:') ||
    message.includes('Generated') ||
    message.includes('Creating') ||
    message.includes('Processing') ||
    message.includes('Retry') ||
    message.includes('Images not found') ||
    message.includes('Audio not found') ||
    message.includes('Auto-detected language') ||
    message.includes('script was broken') ||
    message.includes('Generating') ||
    message.includes('Video created') ||
    message.includes('completing') ||
    message.includes('starting')) {
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
    res.status(500).json({
      error: 'Failed to generate script',
      details: (error as Error).message
    });
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
    res.status(500).json({
      error: 'Failed to generate content',
      details: (error as Error).message
    });
  }
});

// Get list of generated files
app.get('/api/mulmocast/files', (req: Request, res: Response) => {
  const files = Array.from(generatedFiles.values()).map(file => ({
    id: file.id,
    filename: file.filename,
    timestamp: file.timestamp,
    input: file.input.substring(0, 100) + (file.input.length > 100 ? '...' : ''),
    template: file.template,
    status: file.status,
    scriptPath: file.scriptPath
  }));

  res.json({
    success: true,
    data: files.sort((a, b) => b.timestamp - a.timestamp) // newest first
  });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mulmocast API server running on port ${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Files: http://localhost:${PORT}/api/mulmocast/files`);
  console.log(`   - User Files: http://localhost:${PORT}/api/mulmocast/user-files/:userName`);
  console.log(`   - Script: http://localhost:${PORT}/api/mulmocast/script`);
  console.log(`   - Video (from file): http://localhost:${PORT}/api/mulmocast/video-from-file`);
  console.log(`   - PDF (from file): http://localhost:${PORT}/api/mulmocast/pdf-from-file`);
  console.log(`   - All: http://localhost:${PORT}/api/mulmocast/generate-all`);
  console.log(`🌐 Web Client: http://localhost:${PORT}/client/client-example.html`);
  console.log('');
});

export default app;