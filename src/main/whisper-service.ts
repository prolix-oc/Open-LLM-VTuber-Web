// src/main/whisper-service.ts - Optimized Memory Management Version
import * as fs from "fs";
import * as path from "path";
import { app, BrowserWindow } from "electron";
import { nodewhisper } from "nodejs-whisper";

export interface WhisperModel {
  name: string;
  path: string;
  size: string;
  supported: boolean;
}

export interface TranscriptionOptions {
  audioData: number[];
  modelName: string;
  language: string;
  task: "transcribe" | "translate";
  temperature: number;
}

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

class WhisperService {
  private modelsPath: string;
  private tempPath: string;
  private fsWatcher: fs.FSWatcher | null = null;
  private cachedModels: WhisperModel[] = [];
  private lastScanTime: number = 0;
  private scanDebounceTimeout: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private activeModel: any | null = null;
  private activeModelName: string | null = null;

  // 🧠 MEMORY OPTIMIZATION: Auto-unload inactive models
  private modelUnloadTimeout: NodeJS.Timeout | null = null;
  private lastModelUseTime: number = 0;
  private readonly MODEL_UNLOAD_DELAY = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_MEMORY_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2GB threshold

  // 📊 MEMORY MONITORING: Track memory usage
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private readonly MEMORY_CHECK_INTERVAL = 30 * 1000; // 30 seconds

  constructor() {
    const documentsPath = app.getPath("documents");
    this.modelsPath = path.join(documentsPath, "Enspira-VT", "STT-Models");
    this.tempPath = path.join(app.getPath("temp"), "enspira-audio");

    this.ensureDirectoriesExist();
    this.initializeWatcher();
    this.startMemoryMonitoring();
  }

  // 🔍 MEMORY MONITORING: Track memory usage in development
  private startMemoryMonitoring(): void {
    if (process.env.NODE_ENV === 'development') {
      this.memoryCheckInterval = setInterval(() => {
        this.checkMemoryUsage();
      }, this.MEMORY_CHECK_INTERVAL);
    }
  }

  private getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };
  }

  private formatMemorySize(bytes: number): string {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  }

  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🧠 Memory Usage:', {
        heapUsed: this.formatMemorySize(stats.heapUsed),
        heapTotal: this.formatMemorySize(stats.heapTotal),
        external: this.formatMemorySize(stats.external),
        rss: this.formatMemorySize(stats.rss),
        hasActiveModel: !!this.activeModel,
        activeModelName: this.activeModelName,
      });
    }

    // 🚨 MEMORY OPTIMIZATION: Auto-unload if memory usage is too high
    if (stats.heapUsed > this.MAX_MEMORY_THRESHOLD && this.activeModel) {
      console.warn(`🚨 High memory usage detected (${this.formatMemorySize(stats.heapUsed)}), auto-unloading Whisper model`);
      this.unloadModel();
    }
  }

  public setActiveStatus(active: boolean): void {
    if (this.isActive === active) {
      return;
    }

    this.isActive = active;
    console.log(`Local Whisper service is now ${active ? "ACTIVE" : "INACTIVE"}.`);

    if (!active) {
      // 🧠 MEMORY OPTIMIZATION: Immediately unload when deactivated
      this.unloadModel();
      this.clearUnloadTimeout();
    }
  }

  // 🧠 MEMORY OPTIMIZATION: Enhanced model unloading with better cleanup
  public unloadModel(): void {
    if (this.activeModel) {
      console.log(`🗑️ Unloading Whisper model: ${this.activeModelName}`);
      
      // Clear the model reference immediately
      this.activeModel = null;
      this.activeModelName = null;
      this.lastModelUseTime = 0;

      // 🧠 MEMORY OPTIMIZATION: More aggressive garbage collection
      if (global.gc) {
        console.log("🔄 Running garbage collection to reclaim model memory...");
        // Run GC multiple times to ensure cleanup
        global.gc();
        setTimeout(() => {
          if (global.gc) global.gc();
        }, 100);
        setTimeout(() => {
          if (global.gc) global.gc();
        }, 500);
      } else {
        console.warn("⚠️ Garbage collection is not exposed. Memory may not be released immediately. Start node with --expose-gc flag.");
      }

      // Log memory usage after unload
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          const stats = this.getMemoryStats();
          console.log('📊 Memory after model unload:', {
            heapUsed: this.formatMemorySize(stats.heapUsed),
            rss: this.formatMemorySize(stats.rss),
          });
        }, 1000);
      }
    }
  }

  // 🧠 MEMORY OPTIMIZATION: Clear unload timeout
  private clearUnloadTimeout(): void {
    if (this.modelUnloadTimeout) {
      clearTimeout(this.modelUnloadTimeout);
      this.modelUnloadTimeout = null;
    }
  }

  // 🧠 MEMORY OPTIMIZATION: Schedule model unload after inactivity
  private scheduleModelUnload(): void {
    this.clearUnloadTimeout();
    
    this.modelUnloadTimeout = setTimeout(() => {
      const timeSinceLastUse = Date.now() - this.lastModelUseTime;
      if (timeSinceLastUse >= this.MODEL_UNLOAD_DELAY) {
        console.log(`⏰ Auto-unloading Whisper model after ${Math.round(timeSinceLastUse / 1000)}s of inactivity`);
        this.unloadModel();
      }
    }, this.MODEL_UNLOAD_DELAY);
  }

  // 🧠 MEMORY OPTIMIZATION: Enhanced transcription with memory management
  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    let tempFilePath: string | null = null;
    
    if (!this.isActive) {
      throw new Error("Local Whisper service is inactive. Cannot perform transcription.");
    }

    // 🧠 MEMORY OPTIMIZATION: Check memory before loading
    const preStats = this.getMemoryStats();
    if (preStats.heapUsed > this.MAX_MEMORY_THRESHOLD) {
      console.warn(`🚨 Memory usage high before transcription: ${this.formatMemorySize(preStats.heapUsed)}`);
      
      // If we have a model loaded and memory is high, unload it first
      if (this.activeModel) {
        console.log("🗑️ Preemptively unloading model due to high memory usage");
        this.unloadModel();
      }
    }

    try {
      console.log("🎤 Starting transcription with nodejs-whisper:", {
        modelName: options.modelName,
        language: options.language,
        task: options.task,
        temperature: options.temperature,
        audioDataLength: options.audioData?.length || 0,
        currentMemory: this.formatMemorySize(preStats.heapUsed),
      });

      // Enhanced input validation
      if (!options.audioData || !Array.isArray(options.audioData) || options.audioData.length === 0) {
        throw new Error("Valid audio data array is required");
      }

      if (!options.modelName || typeof options.modelName !== "string" || options.modelName.trim() === "") {
        throw new Error("Valid model name is required");
      }

      // Find and validate the model
      const models = await this.getAvailableModels();
      const selectedModel = models.find(model => model.name === options.modelName);

      if (!selectedModel) {
        const availableNames = models.map(m => m.name).join(", ");
        throw new Error(`Model "${options.modelName}" not found. Available: ${availableNames || "none"}`);
      }

      if (!selectedModel.supported) {
        throw new Error(`Model "${options.modelName}" is not supported`);
      }

      if (!fs.existsSync(selectedModel.path)) {
        throw new Error(`Model file not found: ${selectedModel.path}`);
      }

      console.log(`✅ Using model: ${selectedModel.name} at ${selectedModel.path}`);

      // Save audio data to temporary file
      tempFilePath = await this.saveAudioToFile(options.audioData);

      // 🧠 MEMORY OPTIMIZATION: Enhanced nodejs-whisper configuration for memory efficiency
      const whisperOptions = {
        modelPath: selectedModel.path,
        autoDownloadModelName: undefined,
        removeWavFileAfterTranscription: false, // We handle cleanup
        withCuda: false,
        logger: {
          log: (msg: string) => console.log(`[nodejs-whisper] ${msg}`),
          error: (msg: string) => console.error(`[nodejs-whisper] ${msg}`),
          warn: (msg: string) => console.warn(`[nodejs-whisper] ${msg}`),
        },
        whisperOptions: {
          outputInText: true,
          outputInJson: false,
          outputInSrt: false,
          outputInVtt: false,
          outputInCsv: false,
          translateToEnglish: options.task === "translate",
          wordTimestamps: false,
          language: options.language === "auto" ? undefined : options.language,
        },
      };

      console.log("🔧 Starting nodejs-whisper transcription...");
      const startTime = Date.now();

      // Perform transcription
      const result = await nodewhisper(tempFilePath, whisperOptions);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`✅ Transcription completed in ${duration.toFixed(2)}s`);

      // 🧠 MEMORY OPTIMIZATION: Update last use time and schedule unload
      this.lastModelUseTime = Date.now();
      this.scheduleModelUnload();

      // Parse transcription result
      let transcriptionText = "";
      if (typeof result === "string") {
        transcriptionText = result.trim();
      } else if (Array.isArray(result) && result.length > 0) {
        transcriptionText = result
          .map(item => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") {
              return item.text || item.speech || item.transcript || item.content || "";
            }
            return String(item || "");
          })
          .filter(text => typeof text === "string" && text.trim().length > 0)
          .join(" ")
          .trim();
      } else if (result && typeof result === "object") {
        const obj = result as any;
        transcriptionText = obj.text || obj.transcript || obj.content || obj.result || "";
        if (!transcriptionText && obj.data) {
          transcriptionText = obj.data.text || obj.data.transcript || "";
        }
      } else {
        transcriptionText = String(result || "").trim();
      }

      if (!transcriptionText || transcriptionText.length === 0) {
        throw new Error("No transcription text could be extracted from result");
      }

      // 🧠 MEMORY OPTIMIZATION: Log memory usage after transcription
      if (process.env.NODE_ENV === 'development') {
        const postStats = this.getMemoryStats();
        console.log('📊 Memory after transcription:', {
          before: this.formatMemorySize(preStats.heapUsed),
          after: this.formatMemorySize(postStats.heapUsed),
          delta: this.formatMemorySize(postStats.heapUsed - preStats.heapUsed),
        });
      }

      return {
        text: transcriptionText,
        duration,
        language: options.language,
      };

    } catch (whisperError) {
      console.error("❌ Nodejs-whisper execution failed:", whisperError);
      
      // Enhanced error handling with memory context
      let errorMessage = whisperError instanceof Error ? whisperError.message : String(whisperError);
      
      if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
        errorMessage = `Model or nodejs-whisper binary not found. Check model path.`;
      } else if (errorMessage.includes("permission") || errorMessage.includes("EACCES")) {
        errorMessage = `Permission denied accessing model or temporary file.`;
      } else if (errorMessage.includes("memory") || errorMessage.includes("allocation")) {
        errorMessage = `Insufficient memory for transcription. Current usage: ${this.formatMemorySize(this.getMemoryStats().heapUsed)}`;
        // Unload model on memory errors
        this.unloadModel();
      } else if (errorMessage.includes("timeout")) {
        errorMessage = `Transcription timed out. Try with a smaller audio file.`;
      }

      throw new Error(`Nodejs-whisper transcription failed: ${errorMessage}`);
    } finally {
      // Always cleanup temporary file
      if (tempFilePath) {
        await this.cleanupTempFile(tempFilePath);
      }
    }
  }

  // ... (keeping all existing helper methods unchanged) ...
  private ensureDirectoriesExist(): void {
    try {
      if (!fs.existsSync(this.modelsPath)) {
        fs.mkdirSync(this.modelsPath, { recursive: true });
        console.log(`Created STT models directory: ${this.modelsPath}`);
      }

      if (!fs.existsSync(this.tempPath)) {
        fs.mkdirSync(this.tempPath, { recursive: true });
        console.log(`Created temp audio directory: ${this.tempPath}`);
      }

      // Test write permissions
      const testFile = path.join(this.tempPath, "write-test.tmp");
      try {
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        console.log(`✅ Temp directory is writable: ${this.tempPath}`);
      } catch (writeError) {
        console.error(`❌ Temp directory is not writable: ${this.tempPath}`, writeError);
        throw new Error(`Temp directory is not writable: ${writeError.message}`);
      }
    } catch (error) {
      console.error("Failed to create directories:", error);
      throw error;
    }
  }

  private initializeWatcher(): void {
    try {
      this.fsWatcher = fs.watch(this.modelsPath, { persistent: false }, (eventType, filename) => {
        if (filename && (filename.endsWith(".bin") || filename.endsWith(".ggml") || filename.endsWith(".pt"))) {
          console.log(`Whisper model file change detected: ${eventType} - ${filename}`);
          this.debouncedScanModels();
        }
      });
      console.log(`File system watcher initialized for: ${this.modelsPath}`);
    } catch (error) {
      console.error("Failed to initialize file system watcher:", error);
    }
  }

  private debouncedScanModels(): void {
    if (this.scanDebounceTimeout) {
      clearTimeout(this.scanDebounceTimeout);
    }

    this.scanDebounceTimeout = setTimeout(async () => {
      try {
        const currentTime = Date.now();
        if (currentTime - this.lastScanTime > 2000) {
          this.lastScanTime = currentTime;
          const models = await this.scanModelsInternal();

          if (this.hasModelsChanged(models)) {
            this.cachedModels = models;
            this.notifyRendererOfModelChange();
            console.log(`Whisper models updated: ${models.length} models found`);
          }
        }
      } catch (error) {
        console.error("Error during debounced model scan:", error);
      }
    }, 1000);
  }

  private hasModelsChanged(newModels: WhisperModel[]): boolean {
    if (this.cachedModels.length !== newModels.length) {
      return true;
    }

    const newModelSet = new Set(newModels.map(m => `${m.name}-${m.supported}`));
    const cachedModelSet = new Set(this.cachedModels.map(m => `${m.name}-${m.supported}`));

    return newModelSet.size !== cachedModelSet.size || 
           [...newModelSet].some(model => !cachedModelSet.has(model));
  }

  private notifyRendererOfModelChange(): void {
    try {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(window => {
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send("whisper-models-changed", this.cachedModels);
        }
      });
    } catch (error) {
      console.error("Failed to notify renderer of model change:", error);
    }
  }

  private async scanModelsInternal(): Promise<WhisperModel[]> {
    const models: WhisperModel[] = [];

    try {
      if (!fs.existsSync(this.modelsPath)) {
        return models;
      }

      const files = fs.readdirSync(this.modelsPath);
      const modelFiles = files.filter(file => 
        file.endsWith(".bin") || file.endsWith(".ggml") || file.endsWith(".pt")
      );

      for (const file of modelFiles) {
        const filePath = path.join(this.modelsPath, file);
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        const sizeDisplay = sizeInMB + " MB";
        const supported = await this.isModelSupported(filePath);

        models.push({
          name: path.parse(file).name,
          path: filePath,
          size: sizeDisplay,
          supported,
        });
      }
    } catch (error) {
      console.error("Failed to scan models internally:", error);
    }

    return models;
  }

  async getAvailableModels(): Promise<WhisperModel[]> {
    try {
      const currentTime = Date.now();
      if (this.cachedModels.length > 0 && currentTime - this.lastScanTime < 30000) {
        return this.cachedModels;
      }

      this.lastScanTime = currentTime;
      this.cachedModels = await this.scanModelsInternal();
      return this.cachedModels;
    } catch (error) {
      console.error("Failed to get available models:", error);
      return [];
    }
  }

  private async isModelSupported(modelPath: string): Promise<boolean> {
    try {
      const stats = fs.statSync(modelPath);
      return stats.isFile() && stats.size > 0;
    } catch (error) {
      return false;
    }
  }

  async checkModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.getAvailableModels();
      return models.some(model => model.name === modelName && model.supported);
    } catch (error) {
      console.error("Failed to check model:", error);
      return false;
    }
  }

  private async saveAudioToFile(audioData: number[]): Promise<string> {
    // ... (keeping existing implementation) ...
    console.log(`🔧 saveAudioToFile called with:`, {
      audioDataType: typeof audioData,
      isArray: Array.isArray(audioData),
      audioDataLength: audioData?.length || 0,
      firstFewBytes: audioData?.slice(0, 10) || [],
      tempPath: this.tempPath,
    });

    if (!audioData || !Array.isArray(audioData) || audioData.length === 0) {
      throw new Error("Valid audio data array is required");
    }

    if (audioData.length < 44) {
      throw new Error(`Audio data too short: ${audioData.length} bytes (minimum 44 bytes for WAV header)`);
    }

    const tempFileName = `whisper_audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
    const tempFilePath = path.join(this.tempPath, tempFileName);

    try {
      const validatedData = audioData.map((val, index) => {
        if (typeof val !== "number" || isNaN(val)) {
          return 0;
        }
        return Math.max(0, Math.min(255, Math.floor(val)));
      });

      const audioBuffer = new Uint8Array(validatedData);
      fs.writeFileSync(tempFilePath, audioBuffer);

      const stats = fs.statSync(tempFilePath);
      if (stats.size === 0) {
        throw new Error("Created audio file is empty");
      }

      console.log(`✅ Audio file created: ${tempFilePath} (${stats.size} bytes)`);
      return tempFilePath;
    } catch (error) {
      // Cleanup on error
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.error("Failed to cleanup partial file:", cleanupError);
      }
      throw new Error(`Audio file creation failed: ${error.message}`);
    }
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.error("Failed to cleanup temp file:", error);
    }
  }

  async openModelsDirectory(): Promise<void> {
    try {
      const { shell } = require("electron");
      await shell.openPath(this.modelsPath);
    } catch (error) {
      console.error("Failed to open models directory:", error);
      throw new Error("Failed to open models directory");
    }
  }

  getModelsPath(): string {
    return this.modelsPath;
  }

  // 🧠 MEMORY OPTIMIZATION: Enhanced cleanup with memory monitoring cleanup
  async cleanup(): Promise<void> {
    try {
      console.log("🧹 Starting WhisperService cleanup...");
      
      // Unload any active model
      this.unloadModel();

      // Clear all timeouts
      this.clearUnloadTimeout();
      
      if (this.memoryCheckInterval) {
        clearInterval(this.memoryCheckInterval);
        this.memoryCheckInterval = null;
      }

      if (this.scanDebounceTimeout) {
        clearTimeout(this.scanDebounceTimeout);
        this.scanDebounceTimeout = null;
      }

      // Close file system watcher
      if (this.fsWatcher) {
        this.fsWatcher.close();
        this.fsWatcher = null;
        console.log("File system watcher closed");
      }

      // Final memory cleanup
      if (global.gc) {
        console.log("🔄 Final garbage collection...");
        global.gc();
      }

      console.log("✅ WhisperService cleanup completed");
    } catch (error) {
      console.error("Failed to cleanup WhisperService:", error);
    }
  }

  // 🧠 MEMORY OPTIMIZATION: Public method to get current memory usage
  public getMemoryUsage(): MemoryStats {
    return this.getMemoryStats();
  }

  // 🧠 MEMORY OPTIMIZATION: Public method to check if model should be unloaded
  public shouldUnloadModel(): boolean {
    if (!this.activeModel) return false;
    
    const timeSinceLastUse = Date.now() - this.lastModelUseTime;
    return timeSinceLastUse > this.MODEL_UNLOAD_DELAY;
  }
}

// Singleton instance
let whisperService: WhisperService | null = null;

// 🧠 MEMORY OPTIMIZATION: Enhanced factory function with lazy loading
export function getWhisperService(): WhisperService {
  if (!whisperService) {
    console.log("🎤 Creating Whisper service on demand...");
    whisperService = new WhisperService();
  }
  return whisperService;
}

// 🧠 MEMORY OPTIMIZATION: Enhanced destroy function with proper cleanup
export function destroyWhisperService(): void {
  if (whisperService) {
    console.log("🗑️ Destroying Whisper service...");
    whisperService.cleanup();
    whisperService = null;
    
    // Additional cleanup for Node.js modules
    if (global.gc) {
      setTimeout(() => {
        if (global.gc) global.gc();
      }, 1000);
    }
  }
}