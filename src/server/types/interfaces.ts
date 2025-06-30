// TypeScript interfaces for server
import { Response } from 'express';

export interface GeneratedFile {
  id: string;
  filename: string;
  scriptPath: string;
  timestamp: number;
  input: string;
  template: string;
  status: 'script' | 'video' | 'pdf' | 'all';
}

export interface SSEClient {
  response: Response;
  userId?: string;
}

export interface ScriptRequest {
  input: string;
  template?: string;
  options?: {
    llm?: string;
    filename?: string;
    uniqueUserName?: string;
    [key: string]: any;
  };
}

export interface VideoRequest {
  scriptPath: string;
  caption?: string;
  userName?: string;
  options?: any;
}

export interface PdfRequest {
  scriptPath: string;
  pdfMode?: string;
  pdfSize?: string;
  userName?: string;
}

export interface GenerateAllRequest {
  input: string;
  template?: string;
  outputs?: ('script' | 'video' | 'pdf')[];
  options?: {
    llm?: string;
    filename?: string;
    uniqueUserName?: string;
    [key: string]: any;
  };
}

export interface FileBasedRequest {
  fileId: string;
  caption?: string;
  pdfMode?: string;
  pdfSize?: string;
  options?: any;
}

export interface ServerConfig {
  basePath: string;
  outputPath: string;
  cachePath: string;
  clientPath: string;
  port: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  brokenJson?: string;
}