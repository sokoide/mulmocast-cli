// Server-Sent Events Middleware
import { Request, Response } from 'express';
import { SSEClient } from '../types/interfaces.js';
import { sseClients } from '../utils/logger.js';

export function handleSSEConnection(req: Request, res: Response): void {
  const userId = req.query.userId as string;

  // Debug logging
  console.log(`[DEBUG-SSE] New SSE connection attempt. UserId: ${userId}`);
  console.log(`[DEBUG-SSE] Current client count before: ${sseClients.length}`);

  // Set up SSE headers with enhanced CORS
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Cache-Control, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Content-Type',
    'X-Accel-Buffering': 'no' // Disable proxy buffering
  });

  // Add client to the list
  const client: SSEClient = { response: res, userId };
  sseClients.push(client);

  console.log(`[DEBUG-SSE] Client added. Current client count: ${sseClients.length}`);

  // Send initial connection message
  const connectionMessage = {
    message: `🔗 Connected to real-time updates${userId ? ` for user ${userId}` : ''}`,
    timestamp: Date.now(),
    type: 'connection'
  };
  
  console.log(`[DEBUG-SSE] Sending connection message:`, connectionMessage);
  res.write(`data: ${JSON.stringify(connectionMessage)}\n\n`);
  
  // Send a test message immediately to verify the connection works
  setTimeout(() => {
    const testMessage = {
      message: `✅ SSE connection established successfully for ${userId}!`,
      timestamp: Date.now(),
      type: 'test'
    };
    console.log(`[DEBUG-SSE] Sending test message:`, testMessage);
    res.write(`data: ${JSON.stringify(testMessage)}\n\n`);
  }, 1000);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[DEBUG-SSE] Client disconnected. UserId: ${userId}`);
    const index = sseClients.indexOf(client);
    if (index > -1) {
      sseClients.splice(index, 1);
      console.log(`[DEBUG-SSE] Client removed. Current client count: ${sseClients.length}`);
    }
  });
}