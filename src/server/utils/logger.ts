// Enhanced Logging Utilities
import { AsyncLocalStorage } from 'async_hooks';
import * as Module from 'module';
import { SSEClient } from '../types/interfaces.js';

// AsyncLocalStorage for user context tracking
export const userContextStorage = new AsyncLocalStorage<string>();

// Store for SSE clients
export const sseClients: SSEClient[] = [];

// Store original console methods to avoid recursion
let originalConsole: any = null;

// Fallback user context tracking (when AsyncLocalStorage doesn't work)
let currentActiveUsers: string[] = [];

// Function to get current user context safely
export function getCurrentUserContext(): string | undefined {
  // Try AsyncLocalStorage first
  const asyncContext = userContextStorage.getStore();
  if (asyncContext) {
    return asyncContext;
  }
  
  // Fallback: if there's only one active user, use that
  if (currentActiveUsers.length === 1) {
    return currentActiveUsers[0];
  }
  
  return undefined;
}

// Function to track active users for fallback
export function addActiveUser(userId: string): void {
  if (userId && !currentActiveUsers.includes(userId)) {
    currentActiveUsers.push(userId);
    if (originalConsole) {
      originalConsole.log(`[DEBUG-ACTIVE-USERS] Added user: ${userId}, total active: ${currentActiveUsers.length}`);
    }
  }
}

export function removeActiveUser(userId: string): void {
  const index = currentActiveUsers.indexOf(userId);
  if (index > -1) {
    currentActiveUsers.splice(index, 1);
    if (originalConsole) {
      originalConsole.log(`[DEBUG-ACTIVE-USERS] Removed user: ${userId}, total active: ${currentActiveUsers.length}`);
    }
  }
}

// Function to broadcast messages to all connected clients
export function broadcastToClients(message: string, userId?: string): void {
  // Debug logging using original console to avoid recursion
  if (originalConsole) {
    originalConsole.log(`[DEBUG-BROADCAST] Total SSE clients: ${sseClients.length}`);
    originalConsole.log(`[DEBUG-BROADCAST] Looking for userId: ${userId}`);
    originalConsole.log(`[DEBUG-BROADCAST] Message: ${message.substring(0, 100)}...`);
  }

  const targetClients = userId
    ? sseClients.filter(client => client.userId === userId)
    : sseClients;

  if (originalConsole) {
    originalConsole.log(`[DEBUG-BROADCAST] Target clients found: ${targetClients.length}`);
  }

  targetClients.forEach((client, index) => {
    try {
      if (originalConsole) {
        originalConsole.log(`[DEBUG-BROADCAST] Sending to client ${index} (userId: ${client.userId})`);
      }
      const sseMessage = JSON.stringify({ message, timestamp: Date.now(), userId });
      if (originalConsole) {
        originalConsole.log(`[DEBUG-BROADCAST] Sending SSE data: ${sseMessage}`);
      }
      client.response.write(`data: ${sseMessage}\n\n`);
      if (originalConsole) {
        originalConsole.log(`[DEBUG-BROADCAST] Successfully sent to client ${index}`);
      }
    } catch (error) {
      if (originalConsole) {
        originalConsole.log(`[DEBUG-BROADCAST] Error sending to client ${index}:`, error);
      }
      // Remove disconnected clients
      const clientIndex = sseClients.indexOf(client);
      if (clientIndex > -1) {
        sseClients.splice(clientIndex, 1);
        if (originalConsole) {
          originalConsole.log(`[DEBUG-BROADCAST] Removed disconnected client ${clientIndex}`);
        }
      }
    }
  });
}

// Console override setup
export function setupEnhancedLogging(): void {
  // Store original console methods first
  originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };

  originalConsole.log('[DEBUG-SETUP] Enhanced logging setup started');

  // Override console.log
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    // Debug: log every console.log call to original console
    if (originalConsole && !message.includes('[DEBUG-CONSOLE]')) {
      originalConsole.log(`[DEBUG-CONSOLE] console.log called with: ${message.substring(0, 50)}...`);
    }

    // Filter debug messages - only broadcast user-relevant messages
    const isDebugMessage = message.includes('[DEBUG-') ||
      message.includes('GraphAI.debug') ||
      message.includes('debug:') ||
      message.toLowerCase().includes('filtercomplex') ||
      message.includes('🚀 Mulmocast API server running') ||
      message.includes('📋 API Endpoints') ||
      message.includes('🌐 Web Client') ||
      message.includes('🛡️  Moderator Panel');

    // Only broadcast important messages when we have a user context
    const shouldBroadcast = !isDebugMessage && (
      // Existing patterns
      message.includes('Agent:') ||
      message.includes('writing:') ||
      message.includes('LLM Response:') ||
      message.includes('prop:') ||
      message.includes('> ') ||
      message.includes('< ') ||
      message.includes('Video:') ||
      message.includes('Language from') ||
      message.includes('Video created successfully') ||
      message.includes('PDF generated successfully') ||
      message.includes('Audio generated successfully') ||
      // Image generation patterns
      message.includes('=== IMAGE GENERATION ATTEMPT') ||
      message.includes('Current Prompt:') ||
      message.includes('Payload:') ||
      message.includes('Image generated successfully') ||
      // Progress indicators
      message.includes('{ image') ||
      message.includes('} caption') ||
      message.includes('{ audio') ||
      message.includes('} video') ||
      message.includes('{ pdf') ||
      message.includes('} image') ||
      // Processing patterns
      message.includes('Processing generate') ||
      message.includes('🔄 Captions:') ||
      message.includes('🔄 Images:') ||
      message.includes('🔄 Audio:') ||
      message.includes('🔄 Video:') ||
      // Status and completion patterns
      message.includes('created successfully') ||
      message.includes('generated successfully') ||
      message.includes('completed successfully') ||
      // Error patterns (non-debug)
      message.includes('Error:') && !message.includes('[DEBUG')
    );

    if (shouldBroadcast) {
      const currentUser = getCurrentUserContext();
      if (originalConsole) {
        originalConsole.log(`[DEBUG-CONSOLE] User context: ${currentUser}, Will broadcast: ${shouldBroadcast}`);
      }
      if (currentUser) {
        // Don't add user prefix here - send the message as-is
        broadcastToClients(message, currentUser);
      } else if (originalConsole) {
        originalConsole.log(`[DEBUG-CONSOLE] No user context - message not broadcasted`);
      }
    }

    originalConsoleLog.apply(console, args);
  };

  // Override console.error
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    const currentUser = getCurrentUserContext();
    if (currentUser) {
      broadcastToClients(`${currentUser}: ERROR: ${message}`, currentUser);
    }
    originalConsoleError.apply(console, args);
  };

  // Override console.warn
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    const currentUser = getCurrentUserContext();
    if (currentUser) {
      broadcastToClients(`${currentUser}: WARNING: ${message}`, currentUser);
    }
    originalConsoleWarn.apply(console, args);
  };
}

// GraphAI Logger setup with dynamic override
let graphAILoggerOverrideApplied = false;

export function ensureGraphAILoggerOverride(): void {
  if (graphAILoggerOverrideApplied) return;
  
  try {
    // Try to get GraphAI from require cache if already loaded
    const graphAIModule = require.cache[require.resolve('graphai')];
    if (graphAIModule && graphAIModule.exports.GraphAILogger) {
      applyGraphAILoggerOverride(graphAIModule.exports.GraphAILogger);
      return;
    }
  } catch (error) {
    // GraphAI not in cache yet
  }
  
  if (originalConsole) {
    originalConsole.log('[DEBUG-GRAPHAI] GraphAI logger override setup - will apply when GraphAI is imported');
  }
}

function applyGraphAILoggerOverride(GraphAILogger: any): void {
  if (graphAILoggerOverrideApplied) return;
  
  if (originalConsole) {
    originalConsole.log('[DEBUG-GRAPHAI] Applying GraphAI logger override');
  }

  // Override info method
  const originalInfo = GraphAILogger.info;
  GraphAILogger.info = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    if (originalConsole) {
      originalConsole.log(`[DEBUG-GRAPHAI-INFO] GraphAI.info called: ${message}`);
    }

    // Only broadcast important GraphAI messages
    const shouldBroadcast = !message.includes('[DEBUG]') && 
      !message.toLowerCase().includes('filtercomplex') &&
      (message.includes('Agent:') || 
       message.includes('writing:') ||
       message.includes('LLM Response:') ||
       message.includes('prop:') ||
       // Image generation patterns
       message.includes('=== IMAGE GENERATION ATTEMPT') ||
       message.includes('Current Prompt:') ||
       message.includes('Payload:') ||
       // Progress indicators
       message.includes('{ image') ||
       message.includes('} caption') ||
       message.includes('{ audio') ||
       message.includes('} video') ||
       // Processing patterns
       message.includes('Processing generate') ||
       message.includes('🔄 Captions:') ||
       message.includes('🔄 Images:') ||
       // Success patterns
       message.includes('generated successfully') ||
       message.includes('created successfully'));
    
    if (shouldBroadcast) {
      const currentUser = getCurrentUserContext();
      if (originalConsole) {
        originalConsole.log(`[DEBUG-GRAPHAI-INFO] Current user: ${currentUser}, will broadcast: ${!!currentUser}`);
      }
      if (currentUser) {
        broadcastToClients(message, currentUser);
      }
    }

    return originalInfo.apply(GraphAILogger, args);
  };

  // Override log method  
  const originalLog = GraphAILogger.log;
  GraphAILogger.log = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    if (originalConsole) {
      originalConsole.log(`[DEBUG-GRAPHAI-LOG] GraphAI.log called: ${message}`);
    }

    // Only broadcast important GraphAI messages  
    const shouldBroadcast = !message.includes('[DEBUG]') && 
      !message.toLowerCase().includes('filtercomplex') &&
      (message.includes('Agent:') || 
       message.includes('writing:') ||
       message.includes('LLM Response:') ||
       message.includes('prop:') ||
       // Image generation patterns
       message.includes('=== IMAGE GENERATION ATTEMPT') ||
       message.includes('Current Prompt:') ||
       message.includes('Payload:') ||
       // Progress indicators
       message.includes('{ image') ||
       message.includes('} caption') ||
       message.includes('{ audio') ||
       message.includes('} video') ||
       // Processing patterns
       message.includes('Processing generate') ||
       message.includes('🔄 Captions:') ||
       message.includes('🔄 Images:') ||
       // Success patterns
       message.includes('generated successfully') ||
       message.includes('created successfully'));
    
    if (shouldBroadcast) {
      const currentUser = getCurrentUserContext();
      if (originalConsole) {
        originalConsole.log(`[DEBUG-GRAPHAI-LOG] Current user: ${currentUser}, will broadcast: ${!!currentUser}`);
      }
      if (currentUser) {
        broadcastToClients(message, currentUser);
      }
    }

    return originalLog.apply(GraphAILogger, args);
  };

  // Override debug method
  const originalDebug = GraphAILogger.debug;
  GraphAILogger.debug = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    // Only broadcast writing status messages from debug
    if (message.includes('writing:')) {
      const currentUser = getCurrentUserContext();
      if (currentUser) {
        broadcastToClients(message, currentUser);
      }
    }

    return originalDebug.apply(GraphAILogger, args);
  };

  graphAILoggerOverrideApplied = true;
  if (originalConsole) {
    originalConsole.log('[DEBUG-GRAPHAI] GraphAI logger override successfully applied');
  }
}

// Legacy async method for backwards compatibility
export async function setupGraphAILogger(): Promise<void> {
  ensureGraphAILoggerOverride();
}