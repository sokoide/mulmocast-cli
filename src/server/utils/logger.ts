// Enhanced Logging Utilities
import { AsyncLocalStorage } from 'async_hooks';
import { SSEClient } from '../types/interfaces.js';

// AsyncLocalStorage for user context tracking
export const userContextStorage = new AsyncLocalStorage<string>();

// Store for SSE clients
export const sseClients: SSEClient[] = [];

// Function to get current user context safely
export function getCurrentUserContext(): string | undefined {
  return userContextStorage.getStore();
}

// Function to broadcast messages to all connected clients
export function broadcastToClients(message: string, userId?: string): void {
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

// Console override setup
export function setupEnhancedLogging(): void {
  // Override console.log
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    // Filter debug messages but allow writing status
    const isDebugMessage = (message.includes('GraphAI.debug') ||
      message.includes('[DEBUG]') ||
      message.includes('debug:') ||
      message.toLowerCase().includes('filtercomplex') ||
      message.includes('🚀 Mulmocast API server running') ||
      message.includes('📋 API Endpoints') ||
      message.includes('🌐 Web Client')) &&
      !message.includes('writing:');

    if (!isDebugMessage) {
      const currentUser = getCurrentUserContext();
      if (currentUser) {
        const prefixedMessage = `${currentUser}: ${message}`;
        broadcastToClients(prefixedMessage, currentUser);
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

// GraphAI Logger setup
export async function setupGraphAILogger(): Promise<void> {
  try {
    const { GraphAILogger } = await import('graphai');

    // Override info method
    const originalInfo = GraphAILogger.info;
    GraphAILogger.info = (...args: any[]) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      const shouldBroadcast = (!message.includes('[DEBUG]') && !message.toLowerCase().includes('filtercomplex')) ||
        message.includes('writing:');
      
      if (shouldBroadcast) {
        const currentUser = getCurrentUserContext();
        if (currentUser) {
          broadcastToClients(`${currentUser}: INFO: ${message}`, currentUser);
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

      const shouldBroadcast = (!message.includes('[DEBUG]') && !message.toLowerCase().includes('filtercomplex')) ||
        message.includes('writing:');
      
      if (shouldBroadcast) {
        const currentUser = getCurrentUserContext();
        if (currentUser) {
          broadcastToClients(`${currentUser}: LOG: ${message}`, currentUser);
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
          broadcastToClients(`${currentUser}: ${message}`, currentUser);
        }
      }

      return originalDebug.apply(GraphAILogger, args);
    };

  } catch (error) {
    console.log('GraphAILogger not available yet, will override when loaded');
  }
}