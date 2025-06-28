// Mulmocast API Service
import { MulmocastService } from '../../src/lib/mulmocast-service.js';
import { ServerConfig, GeneratedFile } from '../types/interfaces.js';

export class MulmocastAPIService {
  private mulmocastService: MulmocastService;
  private generatedFiles: Map<string, GeneratedFile>;

  constructor(config: ServerConfig) {
    this.mulmocastService = new MulmocastService({
      basePath: config.basePath,
      outputPath: config.outputPath,
      cachePath: config.cachePath
    });
    this.generatedFiles = new Map<string, GeneratedFile>();
  }

  getMulmocastService(): MulmocastService {
    return this.mulmocastService;
  }

  getGeneratedFiles(): Map<string, GeneratedFile> {
    return this.generatedFiles;
  }

  storeGeneratedFile(fileId: string, file: GeneratedFile): void {
    this.generatedFiles.set(fileId, file);
  }

  getGeneratedFile(fileId: string): GeneratedFile | undefined {
    return this.generatedFiles.get(fileId);
  }

  updateFileStatus(fileId: string, status: GeneratedFile['status']): boolean {
    const file = this.generatedFiles.get(fileId);
    if (file) {
      file.status = status;
      this.generatedFiles.set(fileId, file);
      return true;
    }
    return false;
  }

  extractErrorDetails(error: Error): { message: string; brokenJson?: string } {
    const errorMessage = error.message;
    let brokenJson = null;

    try {
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON')) {
        brokenJson = errorMessage;
      } else if (errorMessage.includes('Generated script was broken')) {
        brokenJson = errorMessage;
      }
    } catch (e) {
      // Ignore errors during error processing
    }

    return {
      message: errorMessage,
      ...(brokenJson && { brokenJson })
    };
  }
}