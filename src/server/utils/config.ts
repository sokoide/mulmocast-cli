// Server Configuration Utilities
import path from 'path';
import dotenv from 'dotenv';
import { ServerConfig } from '../types/interfaces.js';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

export function getServerConfig(): ServerConfig {
  const BASE_PATH = process.env.MULMOCAST_BASE_PATH || process.cwd();
  const OUTPUT_PATH = process.env.MULMOCAST_OUTPUT_PATH || path.join(BASE_PATH, 'output');
  const CACHE_PATH = process.env.MULMOCAST_CACHE_PATH || path.join(OUTPUT_PATH, 'cache');
  const CLIENT_PATH = process.env.MULMOCAST_EXAMPLES_PATH || './lib/client';
  const PORT = parseInt(process.env.PORT || '3000', 10);

  return {
    basePath: BASE_PATH,
    outputPath: OUTPUT_PATH,
    cachePath: CACHE_PATH,
    clientPath: CLIENT_PATH,
    port: PORT
  };
}

export function logServerConfig(config: ServerConfig): void {
  console.log(`🔧 Configuration:`);
  console.log(`   - Base Path: ${config.basePath}`);
  console.log(`   - Output Path: ${config.outputPath}`);
  console.log(`   - Cache Path: ${config.cachePath}`);
  console.log(`   - Examples Path: ${config.clientPath}`);
}