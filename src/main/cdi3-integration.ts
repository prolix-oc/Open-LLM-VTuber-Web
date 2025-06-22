// src/main/cdi3-integration.ts - Updated with Cross-Platform Path Handling
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

/**
 * 🔧 CROSS-PLATFORM: Enhanced path utilities for Windows compatibility
 */
function normalizePath(filePath: string): string {
  // Ensure paths use forward slashes for consistency
  return path.normalize(filePath).replace(/\\/g, '/');
}

function createGlobPattern(basePath: string, pattern: string): string {
  // Create glob patterns that work on both Windows and Unix
  const normalizedBase = normalizePath(basePath);
  const fullPattern = path.posix.join(normalizedBase, pattern);
  console.log(`🔍 Created glob pattern: ${fullPattern} from base: ${basePath}, pattern: ${pattern}`);
  return fullPattern;
}

/**
 * CDI3 File Discovery Service for Main Process with Windows Support
 */
export class CDI3DiscoveryService {
  /**
   * Find CDI3 files matching a pattern with cross-platform support
   */
  static async findCDI3Files(pattern: string): Promise<string[]> {
    try {
      console.log(`🔍 Searching for CDI3 files with pattern: ${pattern}`);
      
      // Configure glob options for cross-platform compatibility
      const globOptions = {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
        windowsPathsNoEscape: true, // Important for Windows paths
        nonull: false,
      };

      const files = await glob(pattern, globOptions);
      console.log(`📁 Glob found ${files.length} files matching pattern`);

      // Filter for CDI3 files with improved detection
      const cdi3Files = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const name = path.basename(file).toLowerCase();
        const isCDI3 = ext === '.json' && (
          name.includes('cdi3') || 
          name.includes('.cdi3.') ||
          name.startsWith('cdi3') ||
          name.endsWith('.cdi3.json')
        );
        
        if (isCDI3) {
          console.log(`✅ Found CDI3 file: ${file}`);
        }
        
        return isCDI3;
      });

      console.log(`🎨 Found ${cdi3Files.length} CDI3 files matching pattern: ${pattern}`);
      return cdi3Files;
    } catch (error) {
      console.error('❌ Failed to find CDI3 files:', error);
      return [];
    }
  }

  /**
   * Find CDI3 file for a specific model directory with Windows support
   */
  static async findCDI3ForModel(modelPath: string): Promise<string | null> {
    try {
      const modelDir = path.dirname(modelPath);
      const modelName = path.basename(modelPath, path.extname(modelPath));

      console.log(`🔍 Searching for CDI3 file in: ${modelDir}`);
      console.log(`🎭 Model name: ${modelName}`);

      // Normalize the model directory path for cross-platform compatibility
      const normalizedModelDir = normalizePath(modelDir);

      // Common CDI3 file patterns with cross-platform support
      const patterns = [
        // Exact matches first
        path.join(modelDir, `${modelName}.cdi3.json`),
        path.join(modelDir, `${modelName}.cdi3`),
        path.join(modelDir, 'model.cdi3.json'),
        path.join(modelDir, 'parameters.cdi3.json'),
        // Glob patterns for wildcards
        createGlobPattern(modelDir, '*.cdi3.json'),
        createGlobPattern(modelDir, '*.cdi3'),
        createGlobPattern(modelDir, '**/cdi3*.json'),
        createGlobPattern(modelDir, '**/*.cdi3.json'),
      ];

      for (const pattern of patterns) {
        try {
          if (pattern.includes('*')) {
            // Use glob for wildcard patterns
            console.log(`🔍 Trying glob pattern: ${pattern}`);
            const matches = await CDI3DiscoveryService.findCDI3Files(pattern);
            if (matches.length > 0) {
              console.log(`✅ Found CDI3 file via glob: ${matches[0]}`);
              return matches[0];
            }
          } else {
            // Direct file check with cross-platform path normalization
            const normalizedPattern = path.resolve(pattern);
            console.log(`📄 Checking direct file: ${normalizedPattern}`);
            
            try {
              await fs.access(normalizedPattern);
              console.log(`✅ Found CDI3 file: ${normalizedPattern}`);
              return normalizedPattern;
            } catch (accessError) {
              // File doesn't exist, continue to next pattern
              console.log(`❌ File not found: ${normalizedPattern}`);
            }
          }
        } catch (patternError) {
          console.warn(`⚠️ Error checking pattern ${pattern}:`, patternError);
          continue;
        }
      }

      console.log(`ℹ️ No CDI3 file found for model: ${modelPath}`);
      return null;
    } catch (error) {
      console.error('❌ Failed to find CDI3 file for model:', error);
      return null;
    }
  }

  /**
   * Validate and read CDI3 file with better error handling
   */
  static async readCDI3File(filePath: string): Promise<any | null> {
    try {
      console.log(`📖 Reading CDI3 file: ${filePath}`);
      
      // Normalize the file path for cross-platform compatibility
      const normalizedPath = path.resolve(filePath);
      
      // Check if file exists first
      try {
        await fs.access(normalizedPath);
      } catch (accessError) {
        console.error(`❌ CDI3 file not accessible: ${normalizedPath}`);
        return null;
      }

      const content = await fs.readFile(normalizedPath, 'utf-8');
      console.log(`📄 File content length: ${content.length} characters`);
      
      let data;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        console.error(`❌ Invalid JSON in CDI3 file ${normalizedPath}:`, parseError);
        return null;
      }

      // Basic validation with more detailed checking
      if (!data) {
        console.error(`❌ CDI3 file is empty or null: ${normalizedPath}`);
        return null;
      }

      if (!data.Parameters) {
        console.error(`❌ CDI3 file missing Parameters property: ${normalizedPath}`);
        return null;
      }

      if (!Array.isArray(data.Parameters)) {
        console.error(`❌ CDI3 file Parameters is not an array: ${normalizedPath}`);
        return null;
      }

      console.log(`✅ Successfully read CDI3 file: ${normalizedPath} (${data.Parameters.length} parameters)`);
      
      // Log some basic info about the parameters for debugging
      if (data.Parameters.length > 0) {
        const sampleParam = data.Parameters[0];
        console.log(`🔧 Sample parameter structure:`, Object.keys(sampleParam));
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Failed to read CDI3 file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get CDI3 file information without reading the full content
   */
  static async getCDI3Info(filePath: string): Promise<{
    name: string;
    version: string;
    parameterCount: number;
    fileSize: number;
    platform: string;
  } | null> {
    try {
      const normalizedPath = path.resolve(filePath);
      
      const stats = await fs.stat(normalizedPath);
      const content = await fs.readFile(normalizedPath, 'utf-8');
      const data = JSON.parse(content);

      const info = {
        name: data.Name || path.basename(normalizedPath),
        version: data.Version || 'Unknown',
        parameterCount: data.Parameters ? data.Parameters.length : 0,
        fileSize: stats.size,
        platform: process.platform, // Include platform info for debugging
      };

      console.log(`ℹ️ CDI3 info for ${normalizedPath}:`, info);
      return info;
    } catch (error) {
      console.error(`❌ Failed to get CDI3 info for ${filePath}:`, error);
      return null;
    }
  }
}

/**
 * Enhanced Model Scanner with CDI3 Detection and Windows Support
 */
export class EnhancedModelScanner {
  /**
   * Scan models directory with CDI3 detection and cross-platform support
   */
  static async scanModelsWithCDI3(modelsDir: string): Promise<any[]> {
    try {
      console.log(`🔍 Scanning models directory with CDI3 detection: ${modelsDir}`);
      console.log(`💻 Platform: ${process.platform}`);
      
      // Normalize the models directory path
      const normalizedModelsDir = path.resolve(modelsDir);
      console.log(`📁 Normalized models directory: ${normalizedModelsDir}`);
      
      // Create cross-platform glob pattern for model files
      const modelPattern = createGlobPattern(normalizedModelsDir, '**/*.model3.json');
      console.log(`🔍 Model search pattern: ${modelPattern}`);

      const modelFiles = await glob(modelPattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        windowsPathsNoEscape: true, // Important for Windows
        absolute: true,
      });

      console.log(`📄 Found ${modelFiles.length} model files`);

      const models = [];

      for (const modelFile of modelFiles) {
        try {
          const modelDir = path.dirname(modelFile);
          const modelName = path.basename(modelDir);
          
          console.log(`🎭 Processing model: ${modelName} at ${modelDir}`);
          
          // Check for textures and motions with cross-platform glob patterns
          const texturePattern = createGlobPattern(modelDir, '**/*.png');
          const motionPattern = createGlobPattern(modelDir, '**/*.motion3.json');
          
          const textureFiles = await glob(texturePattern, { 
            absolute: false,
            windowsPathsNoEscape: true,
          });
          const motionFiles = await glob(motionPattern, { 
            absolute: false,
            windowsPathsNoEscape: true,
          });
          
          console.log(`🖼️ Found ${textureFiles.length} textures, ${motionFiles.length} motions for ${modelName}`);
          
          // Check for CDI3 file
          const cdi3File = await CDI3DiscoveryService.findCDI3ForModel(modelFile);
          let cdi3Info = null;
          
          if (cdi3File) {
            cdi3Info = await CDI3DiscoveryService.getCDI3Info(cdi3File);
            console.log(`🎨 CDI3 info for ${modelName}:`, cdi3Info);
          }

          const model = {
            name: modelName,
            directory: modelDir,
            modelFile: modelFile,
            hasTextures: textureFiles.length > 0,
            hasMotions: motionFiles.length > 0,
            hasCDI3: !!cdi3File,
            cdi3File: cdi3File,
            cdi3Info: cdi3Info,
            platform: process.platform, // Include platform info for debugging
          };

          models.push(model);
          
          if (cdi3File) {
            console.log(`✅ Model with CDI3: ${modelName} (${cdi3Info?.parameterCount || 0} parameters)`);
          } else {
            console.log(`📋 Model without CDI3: ${modelName}`);
          }
        } catch (error) {
          console.error(`❌ Failed to process model ${modelFile}:`, error);
        }
      }

      const cdi3Count = models.filter(m => m.hasCDI3).length;
      console.log(`✅ Scanned ${models.length} models, ${cdi3Count} with CDI3 enhancement`);
      return models;
    } catch (error) {
      console.error('❌ Failed to scan models with CDI3:', error);
      return [];
    }
  }
}

/**
 * Setup all CDI3-related IPC handlers with enhanced error handling
 */
export function setupCDI3IPCHandlers(): void {
  console.log('🔧 Setting up CDI3 IPC handlers...');

  // CDI3 file discovery handlers
  ipcMain.handle('cdi3:findFiles', async (event, pattern: string) => {
    try {
      console.log(`🔍 IPC: Finding CDI3 files with pattern: ${pattern}`);
      const result = await CDI3DiscoveryService.findCDI3Files(pattern);
      console.log(`📊 IPC: Found ${result.length} CDI3 files`);
      return result;
    } catch (error) {
      console.error('❌ IPC: Failed to find CDI3 files:', error);
      return [];
    }
  });

  ipcMain.handle('cdi3:findForModel', async (event, modelPath: string) => {
    try {
      console.log(`🔍 IPC: Finding CDI3 for model: ${modelPath}`);
      const result = await CDI3DiscoveryService.findCDI3ForModel(modelPath);
      console.log(`📊 IPC: CDI3 result: ${result || 'none found'}`);
      return result;
    } catch (error) {
      console.error('❌ IPC: Failed to find CDI3 for model:', error);
      return null;
    }
  });

  ipcMain.handle('cdi3:readFile', async (event, filePath: string) => {
    try {
      console.log(`📖 IPC: Reading CDI3 file: ${filePath}`);
      const result = await CDI3DiscoveryService.readCDI3File(filePath);
      console.log(`📊 IPC: CDI3 file read result: ${result ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      console.error('❌ IPC: Failed to read CDI3 file:', error);
      return null;
    }
  });

  ipcMain.handle('cdi3:getInfo', async (event, filePath: string) => {
    try {
      console.log(`ℹ️ IPC: Getting CDI3 info: ${filePath}`);
      const result = await CDI3DiscoveryService.getCDI3Info(filePath);
      console.log(`📊 IPC: CDI3 info result: ${result ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      console.error('❌ IPC: Failed to get CDI3 info:', error);
      return null;
    }
  });

  // Enhanced model scanning
  ipcMain.handle('models:scanWithCDI3', async (event, modelsDir: string) => {
    try {
      console.log(`🔍 IPC: Scanning models with CDI3 in: ${modelsDir}`);
      const result = await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
      console.log(`📊 IPC: Scanned ${result.length} models with CDI3`);
      return result;
    } catch (error) {
      console.error('❌ IPC: Failed to scan models with CDI3:', error);
      return [];
    }
  });

  // Generic file pattern matching with Windows support
  ipcMain.handle('files:find', async (event, pattern: string) => {
    try {
      console.log(`🔍 IPC: Finding files with pattern: ${pattern}`);
      
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
        windowsPathsNoEscape: true, // Important for Windows
      });
      
      console.log(`📊 IPC: Found ${files.length} files`);
      return files;
    } catch (error) {
      console.error('❌ IPC: Failed to find files:', error);
      return [];
    }
  });

  // File reading with encoding support and better error handling
  ipcMain.handle('fs:readFile', async (event, filePath: string, options?: { encoding?: string }) => {
    try {
      const normalizedPath = path.resolve(filePath);
      console.log(`📄 IPC: Reading file: ${normalizedPath}`);
      
      const content = await fs.readFile(normalizedPath, options?.encoding as any || 'utf-8');
      console.log(`✅ IPC: Successfully read file: ${normalizedPath}`);
      return content;
    } catch (error) {
      console.error(`❌ IPC: Failed to read file ${filePath}:`, error);
      throw error;
    }
  });

  // File existence check with normalized paths
  ipcMain.handle('fs:exists', async (event, filePath: string) => {
    try {
      const normalizedPath = path.resolve(filePath);
      await fs.access(normalizedPath);
      console.log(`✅ IPC: File exists: ${normalizedPath}`);
      return true;
    } catch {
      console.log(`❌ IPC: File does not exist: ${filePath}`);
      return false;
    }
  });

  // Get file stats with normalized paths
  ipcMain.handle('fs:stat', async (event, filePath: string) => {
    try {
      const normalizedPath = path.resolve(filePath);
      const stats = await fs.stat(normalizedPath);
      
      const result = {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        platform: process.platform, // Include platform info
      };
      
      console.log(`📊 IPC: File stats for ${normalizedPath}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ IPC: Failed to get stats for ${filePath}:`, error);
      return null;
    }
  });

  console.log('✅ CDI3 IPC handlers setup complete');
}

/**
 * Integration with existing model management with Windows support
 */
export function integrateCDI3WithExistingHandlers(getModelsDirectory: () => string): void {
  console.log('🔗 Integrating CDI3 with existing handlers...');

  // Enhance existing scanModels handler if it exists
  const existingScanModels = ipcMain.listeners('models:scan');
  if (existingScanModels.length > 0) {
    console.log('⚠️ Existing scanModels handler found, replacing with enhanced version');
  }

  // Replace or enhance the existing scanModels handler
  ipcMain.removeAllListeners('models:scan');
  ipcMain.handle('models:scan', async (event) => {
    try {
      console.log('🔍 IPC: Enhanced models:scan handler called');
      const modelsDir = getModelsDirectory();
      console.log(`📁 IPC: Models directory: ${modelsDir}`);
      
      const result = await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
      console.log(`📊 IPC: Enhanced scan found ${result.length} models`);
      
      return result;
    } catch (error) {
      console.error('❌ IPC: Enhanced models:scan failed:', error);
      return [];
    }
  });

  console.log('✅ CDI3 integration with existing handlers complete');
}

/**
 * Complete setup function to call from your main process
 */
export function setupCDI3Integration(getModelsDirectory: () => string): void {
  console.log('🚀 Setting up complete CDI3 integration...');
  console.log(`💻 Platform: ${process.platform}`);
  
  try {
    setupCDI3IPCHandlers();
    integrateCDI3WithExistingHandlers(getModelsDirectory);
    
    console.log('✅ CDI3 integration setup complete');
  } catch (error) {
    console.error('❌ Failed to setup CDI3 integration:', error);
    throw error;
  }
}

/**
 * Enhanced CDI3 cache management for performance with Windows support
 */
export class CDI3Cache {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private static cacheTimestamps = new Map<string, number>();

  static async getCachedCDI3(filePath: string): Promise<any | null> {
    // Normalize the path for consistent caching across platforms
    const normalizedPath = path.resolve(filePath);
    const cached = this.cache.get(normalizedPath);
    const timestamp = this.cacheTimestamps.get(normalizedPath);
    
    if (cached && timestamp && (Date.now() - timestamp) < this.cacheTimeout) {
      console.log(`📋 Using cached CDI3 data for: ${normalizedPath}`);
      return cached;
    }

    // Cache miss or expired, read fresh data
    const data = await CDI3DiscoveryService.readCDI3File(normalizedPath);
    if (data) {
      this.cache.set(normalizedPath, data);
      this.cacheTimestamps.set(normalizedPath, Date.now());
      console.log(`💾 Cached CDI3 data for: ${normalizedPath}`);
    }

    return data;
  }

  static clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    console.log('🧹 CDI3 cache cleared');
  }

  static getCacheStats(): { size: number; keys: string[]; platform: string } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      platform: process.platform,
    };
  }
}

/**
 * Utility function to test CDI3 functionality on different platforms
 */
export async function testCDI3Integration(modelsDir: string): Promise<void> {
  console.log('🧪 Testing CDI3 integration...');
  console.log(`💻 Platform: ${process.platform}`);
  console.log(`📁 Models directory: ${modelsDir}`);

  try {
    // Test model scanning
    const models = await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
    console.log(`✅ Model scanning test: Found ${models.length} models`);

    // Test CDI3 file discovery for each model
    for (const model of models.slice(0, 3)) { // Test first 3 models only
      console.log(`🧪 Testing CDI3 discovery for: ${model.name}`);
      const cdi3File = await CDI3DiscoveryService.findCDI3ForModel(model.modelFile);
      if (cdi3File) {
        console.log(`✅ CDI3 found: ${cdi3File}`);
        const info = await CDI3DiscoveryService.getCDI3Info(cdi3File);
        console.log(`📊 CDI3 info:`, info);
      } else {
        console.log(`ℹ️ No CDI3 found for: ${model.name}`);
      }
    }

    console.log('✅ CDI3 integration test complete');
  } catch (error) {
    console.error('❌ CDI3 integration test failed:', error);
  }
}