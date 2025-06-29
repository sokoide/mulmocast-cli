#!/usr/bin/env node

// Built server runner that uses compiled JavaScript files
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if lib directory exists
import { existsSync } from 'fs';

if (!existsSync(join(__dirname, 'lib'))) {
  console.error('❌ lib directory not found. Please run "npm run build" first.');
  process.exit(1);
}

if (!existsSync(join(__dirname, 'lib/server/app.js'))) {
  console.error('❌ lib/server/app.js not found. Please run "npm run build" to compile server files.');
  process.exit(1);
}

console.log('🚀 Starting Mulmocast API Server (built version)...');
console.log('📂 Using compiled server from:', join(__dirname, 'lib/server/app.js'));

// Run the compiled server
const serverProcess = spawn('node', ['./lib/server/app.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production'
  }
});

serverProcess.on('exit', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});