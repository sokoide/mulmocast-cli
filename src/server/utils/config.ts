// Enhanced Configuration Management System
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { ServerConfig } from '../types/interfaces.js';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

export interface EnhancedServerConfig extends ServerConfig {
  // API settings
  apiBase: string;
  maxRequestSize: string;
  
  // Feature flags
  enableModeration: boolean;
  enableSSE: boolean;
  enableCORS: boolean;
  
  // Security settings
  maxFileSize: number;
  allowedFileTypes: string[];
  sessionTimeout: number;
  
  // Development settings
  isDevelopment: boolean;
  enableDebugLogging: boolean;
  
  // External services
  openaiApiKey?: string;
  googleProjectId?: string;
  nijivoiceApiKey?: string;
  elevenlabsApiKey?: string;
  browserlessApiToken?: string;
}

class ConfigManager {
  private config: EnhancedServerConfig | null = null;
  private configLoaded = false;

  /**
   * Load configuration from environment variables and files
   */
  public loadConfig(): EnhancedServerConfig {
    if (this.configLoaded && this.config) {
      return this.config;
    }

    // Start with defaults
    this.config = this.loadDefaultConfig();
    
    // Override with environment variables
    this.loadFromEnvironment();
    
    // Load from config file if exists
    this.loadFromFile();
    
    // Validate and post-process
    this.validateConfig();
    this.processConfig();
    
    this.configLoaded = true;
    return this.config;
  }

  /**
   * Get current configuration
   */
  public getConfig(): EnhancedServerConfig {
    if (!this.configLoaded || !this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  /**
   * Reset configuration to defaults
   */
  public resetConfig(): void {
    this.config = null;
    this.configLoaded = false;
  }

  /**
   * Load default configuration
   */
  private loadDefaultConfig(): EnhancedServerConfig {
    const cwd = process.cwd();
    const BASE_PATH = process.env.MULMOCAST_BASE_PATH || cwd;
    const OUTPUT_PATH = process.env.MULMOCAST_OUTPUT_PATH || path.join(BASE_PATH, 'output');
    const CACHE_PATH = process.env.MULMOCAST_CACHE_PATH || path.join(OUTPUT_PATH, 'cache');
    const CLIENT_PATH = process.env.MULMOCAST_EXAMPLES_PATH || 
      (fs.existsSync('./lib/client') ? './lib/client' : './src/client');
    const PORT = parseInt(process.env.PORT || '3000', 10);
    
    return {
      // Original ServerConfig properties
      basePath: BASE_PATH,
      outputPath: OUTPUT_PATH,
      cachePath: CACHE_PATH,
      clientPath: CLIENT_PATH,
      port: PORT,
      
      // API settings
      apiBase: process.env.MULMOCAST_API_BASE || `http://localhost:${PORT}`,
      maxRequestSize: '50mb',
      
      // Feature flags
      enableModeration: true,
      enableSSE: true,
      enableCORS: true,
      
      // Security settings
      maxFileSize: 500 * 1024 * 1024, // 500MB
      allowedFileTypes: ['.mp4', '.pdf', '.json', '.mp3'],
      sessionTimeout: 3600000, // 1 hour
      
      // Development settings
      isDevelopment: process.env.NODE_ENV !== 'production',
      enableDebugLogging: process.env.NODE_ENV === 'development',
      
      // External services (optional)
      openaiApiKey: process.env.OPENAI_API_KEY,
      googleProjectId: process.env.GOOGLE_PROJECT_ID,
      nijivoiceApiKey: process.env.NIJIVOICE_API_KEY,
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
      browserlessApiToken: process.env.BROWSERLESS_API_TOKEN
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    if (!this.config) return;

    // Feature flags
    if (process.env.MULMOCAST_ENABLE_MODERATION !== undefined) {
      this.config.enableModeration = process.env.MULMOCAST_ENABLE_MODERATION === 'true';
    }
    
    if (process.env.MULMOCAST_ENABLE_SSE !== undefined) {
      this.config.enableSSE = process.env.MULMOCAST_ENABLE_SSE === 'true';
    }
    
    if (process.env.MULMOCAST_ENABLE_CORS !== undefined) {
      this.config.enableCORS = process.env.MULMOCAST_ENABLE_CORS === 'true';
    }

    // Security settings
    if (process.env.MULMOCAST_MAX_FILE_SIZE) {
      this.config.maxFileSize = parseInt(process.env.MULMOCAST_MAX_FILE_SIZE, 10);
    }

    // Debug settings
    if (process.env.DEBUG === 'true') {
      this.config.enableDebugLogging = true;
    }
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(): void {
    if (!this.config) return;

    const configFiles = [
      'mulmocast.config.json',
      'config/mulmocast.json',
      '.mulmocastrc.json'
    ];

    for (const configFile of configFiles) {
      const fullPath = path.resolve(this.config?.basePath || process.cwd(), configFile);
      
      if (fs.existsSync(fullPath)) {
        try {
          const fileConfig = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          this.config = { ...this.config, ...fileConfig };
          console.log(`Configuration loaded from: ${fullPath}`);
          break;
        } catch (error) {
          console.warn(`Failed to load config from ${fullPath}:`, error);
        }
      }
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config) return;

    const errors: string[] = [];

    // Validate port
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    // Validate paths exist or can be created
    const pathsToValidate = [
      { path: this.config.outputPath, name: 'outputPath' },
      { path: this.config.cachePath, name: 'cachePath' }
    ];

    for (const { path: pathToValidate, name } of pathsToValidate) {
      try {
        if (!fs.existsSync(pathToValidate)) {
          fs.mkdirSync(pathToValidate, { recursive: true });
        }
      } catch (error) {
        errors.push(`Cannot create directory for ${name}: ${pathToValidate}`);
      }
    }

    // Validate file size
    if (this.config.maxFileSize < 1024) {
      errors.push('maxFileSize must be at least 1024 bytes');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Post-process configuration
   */
  private processConfig(): void {
    if (!this.config) return;

    // Ensure paths are absolute
    this.config.basePath = path.resolve(this.config.basePath);
    this.config.outputPath = path.resolve(this.config.outputPath);
    this.config.cachePath = path.resolve(this.config.cachePath);
    this.config.clientPath = path.resolve(this.config.clientPath);
  }

  /**
   * Get configuration summary for logging
   */
  public getConfigSummary(): Record<string, any> {
    if (!this.config) return {};

    const { openaiApiKey, nijivoiceApiKey, elevenlabsApiKey, browserlessApiToken, ...publicConfig } = this.config;
    
    return {
      ...publicConfig,
      // Show only if keys are present (but not the actual keys)
      externalServices: {
        openai: !!openaiApiKey,
        google: !!this.config.googleProjectId,
        nijivoice: !!nijivoiceApiKey,
        elevenlabs: !!elevenlabsApiKey,
        browserless: !!browserlessApiToken
      }
    };
  }
}

// Singleton instance
const configManager = new ConfigManager();

/**
 * Legacy function for backward compatibility
 */
export function getServerConfig(): ServerConfig {
  const config = configManager.getConfig();
  return {
    basePath: config.basePath,
    outputPath: config.outputPath,
    cachePath: config.cachePath,
    clientPath: config.clientPath,
    port: config.port
  };
}

/**
 * Get enhanced server configuration
 */
export function getEnhancedServerConfig(): EnhancedServerConfig {
  return configManager.getConfig();
}

/**
 * Log server configuration
 */
export function logServerConfig(config?: ServerConfig | EnhancedServerConfig): void {
  const actualConfig = config || configManager.getConfig();
  const summary = configManager.getConfigSummary();
  
  console.log(`🔧 Configuration:`);
  console.log(`   - Base Path: ${actualConfig.basePath}`);
  console.log(`   - Output Path: ${actualConfig.outputPath}`);
  console.log(`   - Cache Path: ${actualConfig.cachePath}`);
  console.log(`   - Client Path: ${actualConfig.clientPath}`);
  console.log(`   - Port: ${actualConfig.port}`);
  
  if ('enableModeration' in actualConfig) {
    const enhancedConfig = actualConfig as EnhancedServerConfig;
    console.log(`   - Features: Moderation=${enhancedConfig.enableModeration}, SSE=${enhancedConfig.enableSSE}, CORS=${enhancedConfig.enableCORS}`);
    console.log(`   - External Services: ${Object.entries(summary.externalServices || {})
      .map(([key, enabled]) => `${key}=${enabled}`)
      .join(', ')}`);
  }
}

export { configManager };
export default configManager.getConfig();