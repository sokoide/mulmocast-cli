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

interface ScriptRequest {
  input: string;
  template?: string;
  options?: any;
}

interface VideoRequest {
  scriptPath: string;
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

    res.json({
      success: true,
      data: result
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
    const { scriptPath, options = {} } = req.body;
    
    if (!scriptPath) {
      return res.status(400).json({ error: 'Script path is required' });
    }

    const result = await mulmocastService.generateVideo(scriptPath, options);

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

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'mulmocast-api' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mulmocast API server running on port ${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Script: http://localhost:${PORT}/api/mulmocast/script`);
  console.log(`   - All: http://localhost:${PORT}/api/mulmocast/generate-all`);
  console.log(`🌐 Web Client: http://localhost:${PORT}/client/client-example.html`);
  console.log('');
});

export default app;