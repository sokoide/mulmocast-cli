import path from "path";
import fs from "fs";
import { initializeContext, runTranslateIfNeeded } from "../cli/helpers.js";
import { createMulmoScriptFamilyday } from "../tools/create_mulmo_script_familyday.js";
import { audio } from "../actions/audio.js";
import { images } from "../actions/images.js";
import { movie } from "../actions/movie.js";
import { pdf } from "../actions/pdf.js";
import { captions } from "../actions/captions.js";
import { outDirName, cacheDirName } from "../utils/const.js";
import type { ScriptingParams, PDFMode, PDFSize } from "../types/type.js";
import type { LLM } from "../utils/utils.js";

export interface MulmocastServiceOptions {
  basePath?: string;
  outputPath?: string;
  cachePath?: string;
  templateName?: string;
  llm?: LLM;
  llm_model?: string;
}

export interface ScriptGenerationOptions extends MulmocastServiceOptions {
  filename?: string;
  outputs?: ("script" | "video" | "pdf")[];
  uniqueUserName?: string;
  progressCallback?: (step: string, progress: string) => void;
  c?: string; // caption language
}

export interface VideoGenerationOptions extends MulmocastServiceOptions {
  c?: string; // caption language
  progressCallback?: (step: string, progress: string) => void;
  skipImageGeneration?: boolean;
}

export interface PdfGenerationOptions extends MulmocastServiceOptions {
  progressCallback?: (step: string, progress: string) => void;
  skipImageGeneration?: boolean;
}

export interface UserFile {
  filename: string;
  path: string;
  timestamp: number;
  size: number;
}

export interface UserMediaFile {
  filename: string;
  path: string;
  type: "video" | "pdf";
  timestamp: number;
  size: number;
  moderationStatus: "pending" | "approved" | "rejected";
  moderatedAt?: number;
  moderatedBy?: string;
}

export interface MediaFileGroup {
  baseName: string; // e.g., "story-1751357924434"
  userName: string;
  timestamp: number;
  files: UserMediaFile[];
  moderationStatus: "pending" | "approved" | "rejected";
  moderatedAt?: number;
  moderatedBy?: string;
}

export class MulmocastService {
  private basePath: string;
  private outputPath: string;
  private cachePath: string;

  constructor(options: MulmocastServiceOptions = {}) {
    this.basePath = options.basePath || process.cwd();
    this.outputPath = options.outputPath || path.join(this.basePath, outDirName);
    this.cachePath = options.cachePath || path.join(this.outputPath, cacheDirName);

    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  private getModerationFilePath(userName: string): string {
    return path.join(this.outputPath, userName, '.moderation.json');
  }

  private getModerationData(userName: string): Record<string, { status: string; moderatedAt?: number; moderatedBy?: string }> {
    const moderationFile = this.getModerationFilePath(userName);
    if (!fs.existsSync(moderationFile)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(moderationFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  private saveModerationData(userName: string, data: Record<string, { status: string; moderatedAt?: number; moderatedBy?: string }>): void {
    const moderationFile = this.getModerationFilePath(userName);
    fs.writeFileSync(moderationFile, JSON.stringify(data, null, 2));
  }

  private addToModeration(userName: string, filename: string): void {
    const moderationData = this.getModerationData(userName);
    if (!moderationData[filename]) {
      moderationData[filename] = { status: 'pending' };
      this.saveModerationData(userName, moderationData);
    }
  }

  private getBaseName(filename: string): string {
    // Extract base name without extensions and suffixes
    // e.g., "story-1751357924434_ja.mp4" -> "story-1751357924434"
    // e.g., "story-1751357924434_handout_ja.pdf" -> "story-1751357924434"
    return filename.replace(/_(handout|slide|talk)_[a-z]{2}\.pdf$/, '')
                  .replace(/_[a-z]{2}(__[a-z]{2})?\.mp4$/, '')
                  .replace(/\.(mp4|pdf)$/, '');
  }

  private getTimestamp(): string {
    return Date.now().toString();
  }

  private generateFilename(input: string, template: string): string {
    // Create a safe filename from input text
    const safeInput = input
      .substring(0, 50)
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    const templateShort = template.replace("familyday_", "");
    return `${safeInput}_${templateShort}_${this.getTimestamp()}`;
  }

  private detectLanguageFromTemplate(template: string): string {
    if (template.includes('eng')) return 'en';
    if (template.includes('jpn')) return 'ja';
    return 'en'; // default to English
  }

  async generateScript(
    input: string,
    options: ScriptGenerationOptions = {},
  ): Promise<{
    scriptPath: string;
    timestamp: string;
    filename: string;
  }> {
    const timestamp = this.getTimestamp();
    const templateName = options.templateName || "familyday_jpn";
    const filename = options.filename || this.generateFilename(input, templateName);

    // If uniqueUserName is provided, create user-specific directory
    const userDirPath = options.uniqueUserName ? path.join(this.outputPath, options.uniqueUserName) : this.outputPath;

    // Ensure user directory exists
    if (!fs.existsSync(userDirPath)) {
      fs.mkdirSync(userDirPath, { recursive: true });
    }

    // Create callbacks for detailed script generation progress
    const scriptCallbacks = options.progressCallback ? [
      (log: any, isUpdate: boolean) => {
        if (!isUpdate) {
          // Capture node execution with detailed descriptions
          if (log.nodeId) {
            const scriptDescriptions: { [key: string]: string } = {
              'llmAgent': 'Generating story content using large language model (GPT/Claude)',
              'validateSchemaAgent': 'Validating generated JSON script against MulmoScript schema',
              'promptAgent': 'Creating and refining prompts for optimal story generation',
              'templateAgent': 'Applying story template and formatting guidelines',
              'contextAnalyzer': 'Analyzing input context and extracting key story elements',
              'storyStructureAgent': 'Building narrative structure with proper pacing and flow',
              'characterAgent': 'Developing characters and their descriptions for visual generation',
              'sceneAgent': 'Creating detailed scene descriptions for image and video generation',
              'dialogueAgent': 'Crafting natural dialogue and narration text',
              'formatAgent': 'Formatting final script into MulmoScript JSON structure'
            };
            
            const description = scriptDescriptions[log.nodeId] || `Processing ${log.nodeId}`;
            options.progressCallback?.("🔄 Script", `${description} [${log.nodeId}]`);
          }
          
          // Capture detailed GraphAI transaction information
          if (log.transactionId) {
            options.progressCallback?.("🔄 Script", `Transaction: ${log.transactionId}`);
          }
          
          // Capture agent execution results
          if (log.result) {
            const resultStr = typeof log.result === 'string' ? log.result : JSON.stringify(log.result);
            if (resultStr.length > 0) {
              options.progressCallback?.("🔄 Script", resultStr.substring(0, 200) + (resultStr.length > 200 ? "..." : ""));
            }
          }
          
          // Capture any props or state information
          if (log.props) {
            const propsStr = JSON.stringify(log.props);
            options.progressCallback?.("🔄 Script", `Props: ${propsStr.substring(0, 100) + (propsStr.length > 100 ? "..." : "")}`);
          }
          
          // Capture any errors
          if (log.error) {
            options.progressCallback?.("🔄 Script", `Error: ${log.error}`);
          }
        }
      }
    ] : undefined;

    const scriptingParams: ScriptingParams & { initialInput: string; callbacks?: ((log: any, isUpdate: boolean) => void)[] } = {
      outDirPath: userDirPath,
      templateName,
      urls: [],
      filename,
      cacheDirPath: this.cachePath,
      llm_model: options.llm_model,
      llm: options.llm,
      initialInput: input,
      callbacks: scriptCallbacks,
    };

    await createMulmoScriptFamilyday(scriptingParams);

    // Find the actual generated file (the fileWriteAgent uses ${@now} timestamp)
    const files = fs.readdirSync(userDirPath);
    const generatedFile = files
      .filter(f => f.startsWith(filename) && f.endsWith('.json'))
      .filter(f => !f.includes('_studio') && !f.includes('_lang')) // exclude internal files
      .sort((a, b) => {
        // Get the most recent file based on timestamp in filename
        const timestampA = a.match(/-(\d+)\.json$/)?.[1] || '0';
        const timestampB = b.match(/-(\d+)\.json$/)?.[1] || '0';
        return parseInt(timestampB) - parseInt(timestampA);
      })[0];

    if (!generatedFile) {
      throw new Error(`Generated script file not found in ${userDirPath}`);
    }

    const scriptPath = path.join(userDirPath, generatedFile);
    const actualTimestamp = generatedFile.match(/-(\d+)\.json$/)?.[1] || timestamp;

    console.log(`DEBUG: Found generated file: ${generatedFile}`);
    console.log(`DEBUG: Full script path: ${scriptPath}`);

    return {
      scriptPath,
      timestamp: actualTimestamp,
      filename,
    };
  }

  async generateVideo(
    scriptPath: string,
    options: VideoGenerationOptions = {},
  ): Promise<{
    videoPath: string;
    timestamp: string;
  }> {
    console.log(`DEBUG: generateVideo called with scriptPath: ${scriptPath}`);
    console.log(`DEBUG: File exists check: ${fs.existsSync(scriptPath)}`);
    
    const context = await initializeContext({
      b: this.basePath,
      o: this.outputPath,
      file: scriptPath,
      c: options.c, // caption language
      _: [],
      $0: "mulmocast-service",
    });

    if (!context) {
      throw new Error("Failed to initialize context for video generation");
    }

    // Run translation if needed (for multilingual captions)
    options.progressCallback?.("🔄 Translation", "Processing multilingual captions...");
    await runTranslateIfNeeded(context, { c: options.c });

    // For generateVideo, run the complete pipeline
    options.progressCallback?.("🔄 Audio", "Generating audio from script...");
    console.log(`DEBUG: Before audio - context.studio.beats[0].duration:`, context.studio.beats[0]?.duration);
    
    // Create callbacks for detailed audio generation progress
    const audioCallbacks = options.progressCallback ? [
      (log: any, isUpdate: boolean) => {
        if (!isUpdate && log.nodeId) {
          // Provide more descriptive messages for different audio processing stages
          const audioDescriptions: { [key: string]: string } = {
            'textToSpeech': 'Converting story text to speech using advanced TTS models',
            'audioProcessor': 'Processing and enhancing audio quality for optimal playback',
            'voiceGeneration': 'Generating natural-sounding voice narration',
            'audioMixer': 'Mixing voice tracks and adjusting audio levels',
            'audioOptimization': 'Optimizing audio format and compression for video integration',
            'speechSynthesis': 'Synthesizing speech with proper intonation and pacing',
            'audioValidation': 'Validating audio quality and duration matching video timing'
          };
          
          const description = audioDescriptions[log.nodeId] || `Processing ${log.nodeId}`;
          options.progressCallback?.("🔄 Audio", `${description} [${log.nodeId}]`);
        }
      }
    ] : undefined;
    
    const updatedContext = await audio(context, undefined, audioCallbacks);
    console.log(`DEBUG: After audio - updatedContext.studio.beats[0].duration:`, updatedContext.studio.beats[0]?.duration);
    
    if (!options.skipImageGeneration) {
      options.progressCallback?.("🔄 Images", "Generating images...");
      
      // Create callbacks for detailed image generation progress
      const imageCallbacks = options.progressCallback ? [
        (log: any, isUpdate: boolean) => {
          if (!isUpdate && log.nodeId) {
            // Provide more descriptive messages for different node types
            const nodeDescriptions: { [key: string]: string } = {
              'imageFromMovie': 'Generating scene illustrations for movie frames and transitions',
              'htmlImageAgentInfo': 'Creating HTML layout templates for image placement and composition',
              'imageAgentInfo': 'Configuring image generation parameters, styles, and AI model settings',
              'movieAgentInfo': 'Setting up movie composition, scene transitions, and timing sequences',
              'context': 'Analyzing story context, character descriptions, and scene requirements',
              'imagePromptAgent': 'Creating detailed prompts for AI image generation based on story content',
              'imageGenerationAgent': 'Generating high-quality images using Google Vertex AI and other models',
              'imageOptimization': 'Optimizing generated images for video production and format compatibility'
            };
            
            const description = nodeDescriptions[log.nodeId] || `Processing ${log.nodeId}`;
            options.progressCallback?.("🔄 Images", `${description} [${log.nodeId}]`);
          }
        }
      ] : undefined;
      
      await images(updatedContext, undefined, imageCallbacks);
    }
    
    options.progressCallback?.("🔄 Captions", "Adding captions...");
    
    // Create callbacks for detailed captions generation progress  
    const captionCallbacks = options.progressCallback ? [
      (log: any, isUpdate: boolean) => {
        if (!isUpdate && log.nodeId) {
          options.progressCallback?.("🔄 Captions", `Processing ${log.nodeId}...`);
        }
      }
    ] : undefined;
    
    await captions(updatedContext, captionCallbacks);
    
    options.progressCallback?.("🔄 Video", "Compositing final video...");
    await movie(updatedContext);

    const timestamp = this.getTimestamp();
    const filename = path.basename(scriptPath, ".json");
    const userDir = path.dirname(scriptPath);

    // Determine video filename - avoid double language codes
    // If filename already contains language suffix, don't add another one
    const hasLanguageSuffix = /_[a-z]{2}(_\d+)?$/.test(filename);
    let videoFilename = `${filename}.mp4`;
    if (options.c && !hasLanguageSuffix) {
      videoFilename = `${filename}_${options.c}.mp4`;
    }

    const videoPath = path.join(userDir, videoFilename);

    return {
      videoPath,
      timestamp,
    };
  }

  async generatePdf(
    scriptPath: string,
    pdfMode: string = "slide",
    pdfSize: string = "letter",
    options: PdfGenerationOptions = {},
  ): Promise<{
    pdfPath: string;
    timestamp: string;
  }> {
    const context = await initializeContext({
      b: this.basePath,
      o: this.outputPath,
      file: scriptPath,
      pdfMode,
      pdfSize,
      _: [],
      $0: "mulmocast-service",
    });

    if (!context) {
      throw new Error("Failed to initialize context for PDF generation");
    }

    // Generate images first unless explicitly skipped
    if (!options.skipImageGeneration) {
      options.progressCallback?.("🔄 Images", "Generating images for PDF...");
      
      // Create callbacks for detailed image generation progress
      const imageCallbacks = options.progressCallback ? [
        (log: any, isUpdate: boolean) => {
          if (!isUpdate && log.nodeId) {
            options.progressCallback?.("🔄 Images", `Processing ${log.nodeId}...`);
          }
        }
      ] : undefined;
      
      await images(context, undefined, imageCallbacks);
    }

    options.progressCallback?.("🔄 PDF", `Generating PDF (${pdfMode}, ${pdfSize})...`);
    await pdf(context, pdfMode as PDFMode, pdfSize as PDFSize);

    const timestamp = this.getTimestamp();
    const filename = path.basename(scriptPath, ".json");
    const userDir = path.dirname(scriptPath);

    // Determine PDF filename based on mode and language
    const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
    const lang = script.lang || "en";
    const pdfFilename = `${filename}_${pdfMode}_${lang}.pdf`;

    const pdfPath = path.join(userDir, pdfFilename);

    return {
      pdfPath,
      timestamp,
    };
  }

  async generateAll(
    input: string,
    options: ScriptGenerationOptions = {},
  ): Promise<{
    scriptPath: string;
    videoPath?: string;
    pdfPath?: string;
    timestamp: string;
    filename: string;
  }> {
    const outputs = options.outputs || ["script", "video", "pdf"];
    const progressCallback = options.progressCallback;

    // Generate script first
    progressCallback?.("🔄 Step 1/4", "Generating script...");
    const scriptResult = await this.generateScript(input, options);
    progressCallback?.("✅ Step 1/4", "Script generated successfully");
    
    console.log(`DEBUG: Script generated at: ${scriptResult.scriptPath}`);

    const result: any = {
      scriptPath: scriptResult.scriptPath,
      timestamp: scriptResult.timestamp,
      filename: scriptResult.filename,
    };

    // Generate images first (needed for both PDF and video)
    if (outputs.includes("pdf") || outputs.includes("video")) {
      progressCallback?.("🔄 Step 2/4", "Generating images...");
      
      const context = await initializeContext({
        b: this.basePath,
        o: this.outputPath,
        file: scriptResult.scriptPath,
        _: [],
        $0: "mulmocast-service",
      });

      if (!context) {
        throw new Error("Failed to initialize context for image generation");
      }

      // Create callbacks for detailed image generation progress
      const imageCallbacks = progressCallback ? [
        (log: any, isUpdate: boolean) => {
          if (!isUpdate && log.nodeId) {
            progressCallback("🔄 Images", `Processing ${log.nodeId}...`);
          }
        }
      ] : undefined;

      await images(context, undefined, imageCallbacks);
      progressCallback?.("✅ Step 2/4", "Images generated successfully");
    }

    // Generate PDF if requested (now with images available)
    if (outputs.includes("pdf")) {
      progressCallback?.("🔄 Step 3/4", "Generating PDF (handout, A4)...");
      const pdfResult = await this.generatePdf(scriptResult.scriptPath, "handout", "a4", {
        progressCallback,
        skipImageGeneration: true // Images already generated
      });
      result.pdfPath = pdfResult.pdfPath;
      
      // Add PDF to moderation
      if (options.uniqueUserName && pdfResult.pdfPath) {
        const pdfFilename = path.basename(pdfResult.pdfPath);
        this.addToModeration(options.uniqueUserName, pdfFilename);
      }
      
      progressCallback?.("✅ Step 3/4", "PDF generated successfully");
    }

    // Generate video if requested (audio + captions + movie, images already done)
    if (outputs.includes("video")) {
      progressCallback?.("🔄 Step 4/4", "Generating video (audio + captions + movie)...");
      console.log(`DEBUG: About to generate video for script: ${scriptResult.scriptPath}`);
      const videoOptions: VideoGenerationOptions = {
        basePath: options.basePath,
        outputPath: options.outputPath,
        cachePath: options.cachePath,
        c: options.c || this.detectLanguageFromTemplate(options.templateName || 'familyday_jpn'), // Detect language from template
        progressCallback,
        skipImageGeneration: true // Images already generated
      };
      const videoResult = await this.generateVideo(scriptResult.scriptPath, videoOptions);
      result.videoPath = videoResult.videoPath;
      
      // Add video to moderation
      if (options.uniqueUserName && videoResult.videoPath) {
        const videoFilename = path.basename(videoResult.videoPath);
        this.addToModeration(options.uniqueUserName, videoFilename);
      }
      
      progressCallback?.("✅ Step 4/4", "Video generated successfully");
    }

    return result;
  }

  async getUserFiles(userName: string): Promise<UserFile[]> {
    const userDir = path.join(this.outputPath, userName);

    if (!fs.existsSync(userDir)) {
      return [];
    }

    const files: UserFile[] = [];
    const entries = fs.readdirSync(userDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        // Filter out internal files (_studio.json and _lang.json)
        if (entry.name.includes("_studio.json") || entry.name.includes("_lang.json")) {
          continue;
        }

        const jsonFile = path.join(userDir, entry.name);
        const stats = fs.statSync(jsonFile);

        // Extract filename without timestamp for display
        const baseName = entry.name.replace(/-\d+\.json$/, "");

        // Return path relative to the base path that Express serves from
        const relativePath = `output/${userName}/${entry.name}`;
        files.push({
          filename: baseName,
          path: relativePath,
          timestamp: stats.mtime.getTime(),
          size: stats.size,
        });
      }
    }

    return files.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getUserMediaFiles(userName: string): Promise<UserMediaFile[]> {
    const userDir = path.join(this.outputPath, userName);

    if (!fs.existsSync(userDir)) {
      return [];
    }

    const mediaFiles: UserMediaFile[] = [];
    const entries = fs.readdirSync(userDir, { withFileTypes: true });
    const moderationData = this.getModerationData(userName);

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".mp4") || entry.name.endsWith(".pdf"))) {
        const filePath = path.join(userDir, entry.name);
        const stats = fs.statSync(filePath);

        // Get moderation status
        const moderation = moderationData[entry.name] || { status: 'pending' };

        // Return path relative to base for web access
        const relativePath = `output/${userName}/${entry.name}`;
        mediaFiles.push({
          filename: entry.name,
          path: relativePath,
          type: entry.name.endsWith(".mp4") ? "video" : "pdf",
          timestamp: stats.mtime.getTime(),
          size: stats.size,
          moderationStatus: moderation.status as "pending" | "approved" | "rejected",
          moderatedAt: moderation.moderatedAt,
          moderatedBy: moderation.moderatedBy,
        });
      }
    }

    return mediaFiles.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Utility method to get base paths for configuration
  getConfiguration(): {
    basePath: string;
    outputPath: string;
    cachePath: string;
  } {
    return {
      basePath: this.basePath,
      outputPath: this.outputPath,
      cachePath: this.cachePath,
    };
  }

  // Method to update configuration
  updateConfiguration(options: MulmocastServiceOptions): void {
    if (options.basePath) {
      this.basePath = options.basePath;
    }
    if (options.outputPath) {
      this.outputPath = options.outputPath;
    }
    if (options.cachePath) {
      this.cachePath = options.cachePath;
    }

    this.ensureDirectories();
  }

  // Moderation methods
  async getAllPendingFiles(): Promise<Array<UserMediaFile & { userName: string }>> {
    const pendingFiles: Array<UserMediaFile & { userName: string }> = [];
    
    if (!fs.existsSync(this.outputPath)) {
      return pendingFiles;
    }

    const userDirs = fs.readdirSync(this.outputPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const userName of userDirs) {
      const userMediaFiles = await this.getUserMediaFiles(userName);
      const userPendingFiles = userMediaFiles
        .filter(file => file.moderationStatus === 'pending')
        .map(file => ({ ...file, userName }));
      pendingFiles.push(...userPendingFiles);
    }

    return pendingFiles.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAllPendingFileGroups(): Promise<MediaFileGroup[]> {
    const pendingFiles = await this.getAllPendingFiles();
    const groupMap = new Map<string, MediaFileGroup>();

    for (const file of pendingFiles) {
      const baseName = this.getBaseName(file.filename);
      const groupKey = `${file.userName}:${baseName}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          baseName,
          userName: file.userName,
          timestamp: file.timestamp,
          files: [],
          moderationStatus: 'pending'
        });
      }

      const group = groupMap.get(groupKey)!;
      group.files.push(file);
      // Use the earliest timestamp for the group
      group.timestamp = Math.min(group.timestamp, file.timestamp);
    }

    return Array.from(groupMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async moderateFile(userName: string, filename: string, status: 'approved' | 'rejected', moderatorId: string): Promise<void> {
    const moderationData = this.getModerationData(userName);
    moderationData[filename] = {
      status,
      moderatedAt: Date.now(),
      moderatedBy: moderatorId,
    };
    this.saveModerationData(userName, moderationData);
  }

  async moderateFileGroup(userName: string, baseName: string, status: 'approved' | 'rejected', moderatorId: string): Promise<void> {
    const userMediaFiles = await this.getUserMediaFiles(userName);
    const groupFiles = userMediaFiles.filter(file => this.getBaseName(file.filename) === baseName);
    
    const moderationData = this.getModerationData(userName);
    const moderationInfo = {
      status,
      moderatedAt: Date.now(),
      moderatedBy: moderatorId,
    };

    // Apply the same moderation status to all files in the group
    for (const file of groupFiles) {
      moderationData[file.filename] = moderationInfo;
    }

    this.saveModerationData(userName, moderationData);
  }

  getFilePreviewPath(userName: string, filename: string): string {
    return path.join(this.outputPath, userName, filename);
  }
}
