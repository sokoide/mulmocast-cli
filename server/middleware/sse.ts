// Server-Sent Events Middleware
import { Request, Response } from 'express';
import { SSEClient } from '../types/interfaces.js';
import { sseClients } from '../utils/logger.js';

export function handleSSEConnection(req: Request, res: Response): void {
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
}