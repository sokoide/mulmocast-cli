#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default API base if environment variable is not set
const DEFAULT_API_BASE = 'http://localhost:3000/api';

// Get API base from environment variable or use default
const apiBase = process.env.MULMOCAST_API_BASE || DEFAULT_API_BASE;

// Paths
const templatePath = path.join(__dirname, '../../client/assets/js/config.template.js');
const outputPath = path.join(__dirname, '../../client/assets/js/config.js');

try {
  // Read template file
  const template = fs.readFileSync(templatePath, 'utf8');
  
  // Replace placeholder with actual API base
  const config = template.replace('__API_BASE_URL__', apiBase);
  
  // Write config file
  fs.writeFileSync(outputPath, config);
  
  console.log(`Generated config.js with API_BASE: ${apiBase}`);
} catch (error) {
  console.error('Error generating config.js:', error.message);
  process.exit(1);
}