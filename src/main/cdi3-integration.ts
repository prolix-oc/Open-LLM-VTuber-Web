// src/main/cdi3-integration.ts - Updated with Cross-Platform Path Handling
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { CrossPlatformPathUtils } from './utils/cross-platform-paths';

/**
 * Enhanced CDI3 File Discovery Service with cross-platform support
 */
export class CDI3DiscoveryService {
  /**
   * Find CDI3 files matching a pattern with cross-platform compatibility
   */
  static async findCDI3Files(pattern: string): Promise<string[]> {
    try {
      console.log(`🔍 Searching for CDI3 files with pattern: ${pattern}`);
      
      // Normalize the pattern for cross-platform compatibility
      const normalizedPattern = CrossPlatformPathUtils.normalizePath(pattern);
      console.log(`🔧 Normalized pattern: ${normalizedPattern}`);
      
      const files = await glob(normalizedPattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
        windowsPathsNoEscape: true, // Important for Windows paths
      });

      // Filter for CDI3 files with more robust matching
      const cdi3Files = files.filter(file => {
        const ext = CrossPlatformPathUtils.getFileExtension(file);
        const name = path.basename(file).toLowerCase();
        const isCDI3 = ext === '.json' && (
          name.includes('cdi3') || 
          name.includes('.cdi3.') ||
          name.startsWith('cdi3') ||
          name.endsWith('.cdi3')
        );
        
        if (isCDI3) {
          console.log(`📁 Found CDI3 file: ${file}`);
        }
        
        return isCDI3;
      });

      console.log(`✅ Found ${cdi3Files.length} CDI3 files matching pattern: ${pattern}`);
      return cdi3Files;
    } catch (error) {
      console.error('❌ Failed to find CDI3 files:', error);
      console.error('🔍 Pattern debug info:', { 
        originalPattern: pattern,
        platform: process.platform,
        cwd: process.cwd()
      });
      return [];
    }
  }

  /**
   * Find CDI3 file for a specific model directory with enhanced Windows support
   */
  static async findCDI3ForModel(modelPath: string): Promise<string | null> {
    try {
      const modelDir = path.dirname(modelPath);
      const modelName = path.basename(modelPath, path.extname(modelPath));

      console.log(`🔍 Searching for CDI3 file in: ${modelDir}`);
      console.log(`🎭 Model name: ${modelName}`);

      // Validate directory exists first
      const dirExists = await CrossPlatformPathUtils.validateFilePath(modelDir);
      if (!dirExists) {
        console.log(`❌ Model directory does not exist: ${modelDir}`);
        return null;
      }

      // Common CDI3 file patterns with cross-platform path handling
      const basePatterns = [
        `${modelName}.cdi3.json`,
        `${modelName}.cdi3`,
        'model.cdi3.json',
        'parameters.cdi3.json',
        '*.cdi3.json',
        '*.cdi3',
        'cdi3.json',
        `${modelName}_cdi3.json`,
        `${modelName}-cdi3.json`
      ];

      const patterns = basePatterns.map(pattern => 
        CrossPlatformPathUtils.createGlobPattern(modelDir, pattern)
      );

      console.log(`🔧 CDI3 search patterns:`, patterns);

      for (const pattern of patterns) {
        try {
          if (pattern.includes('*')) {
            // Use glob for wildcard patterns
            const matches = await CDI3DiscoveryService.findCDI3Files(pattern);
            if (matches.length > 0) {
              console.log(`✅ Found CDI3 file via glob: ${matches[0]}`);
              return matches[0];
            }
          } else {
            // Direct file check
            const exists = await CrossPlatformPathUtils.validateFilePath(pattern);
            if (exists) {
              console.log(`✅ Found CDI3 file directly: ${pattern}`);
              return pattern;
            }
          }
        } catch (error) {
          console.log(`⚠️ Pattern failed: ${pattern}`, error.message);
          continue;
        }
      }

      console.log(`ℹ️ No CDI3 file found for model: ${modelPath}`);
      return null;
    } catch (error) {
      console.error('❌ Failed to find CDI3 file for model:', error);
      console.error('🔍 Model debug info:', CrossPlatformPathUtils.getDebugInfo(modelPath));
      return null;
    }
  }

  /**
   * Validate and read CDI3 file with enhanced error handling
   */
  static async readCDI3File(filePath: string): Promise<any | null> {
    try {
      console.log(`📖 Reading CDI3 file: ${filePath}`);
      
      // Validate file exists first
      const exists = await CrossPlatformPathUtils.validateFilePath(filePath);
      if (!exists) {
        throw new Error(`CDI3 file does not exist: ${filePath}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content.trim()) {
        throw new Error('CDI3 file is empty');
      }

      const data = JSON.parse(content);

      // Enhanced validation
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid CDI3 file: not a valid JSON object');
      }

      if (!data.Parameters || !Array.isArray(data.Parameters)) {
        console.warn(`⚠️ CDI3 file missing Parameters array: ${filePath}`);
        // Try alternative structure
        if (data.parameters || data.PARAMETERS) {
          data.Parameters = data.parameters || data.PARAMETERS;
        } else {
          throw new Error('Invalid CDI3 file: missing Parameters array');
        }
      }

      console.log(`✅ Successfully read CDI3 file: ${filePath} (${data.Parameters.length} parameters)`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to read CDI3 file ${filePath}:`, error);
      console.error('🔍 File debug info:', CrossPlatformPathUtils.getDebugInfo(filePath));
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
    filePath: string;
    normalizedPath: string;
  } | null> {
    try {
      const exists = await CrossPlatformPathUtils.validateFilePath(filePath);
      if (!exists) {
        throw new Error(`CDI3 file does not exist: ${filePath}`);
      }

      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const parameterCount = data.Parameters 
        ? data.Parameters.length 
        : (data.parameters?.length || data.PARAMETERS?.length || 0);

      return {
        name: data.Name || data.name || path.basename(filePath),
        version: data.Version || data.version || 'Unknown',
        parameterCount,
        fileSize: stats.size,
        filePath: filePath,
        normalizedPath: CrossPlatformPathUtils.normalizePath(filePath),
      };
    } catch (error) {
      console.error(`❌ Failed to get CDI3 info for ${filePath}:`, error);
      return null;
    }
  }
}

/**
 * Enhanced Model Scanner with CDI3 Detection and Cross-Platform Support
 */
export class EnhancedModelScanner {
  /**
   * Scan models directory with CDI3 detection using cross-platform paths
   */
  static async scanModelsWithCDI3(modelsDir: string): Promise<any[]> {
    try {
      console.log(`🔍 Scanning models directory with CDI3 detection: ${modelsDir}`);
      
      // Validate directory exists
      const dirExists = await CrossPlatformPathUtils.validateFilePath(modelsDir);
      if (!dirExists) {
        console.log(`❌ Models directory does not exist: ${modelsDir}`);
        return [];
      }
      
      // Create cross-platform glob pattern for model files
      const globPattern = CrossPlatformPathUtils.createGlobPattern(modelsDir, '**/*.model3.json');
      console.log(`🔧 Model scan pattern: ${globPattern}`);

      const modelFiles = await glob(globPattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
        windowsPathsNoEscape: true,
      });

      console.log(`📊 Found ${modelFiles.length} model files`);

      const models = [];

      for (const modelFile of modelFiles) {
        try {
          const modelDir = path.dirname(modelFile);
          const modelName = path.basename(modelDir);
          
          console.log(`🎭 Processing model: ${modelName} at ${modelDir}`);
          
          // Check for textures with cross-platform patterns
          const texturePattern = CrossPlatformPathUtils.createGlobPattern(modelDir, '**/*.png');
          const textureFiles = await glob(texturePattern, { 
            absolute: false,
            windowsPathsNoEscape: true,
          });
          
          // Check for motions with cross-platform patterns  
          const motionPattern = CrossPlatformPathUtils.createGlobPattern(modelDir, '**/*.motion3.json');
          const motionFiles = await glob(motionPattern, { 
            absolute: false,
            windowsPathsNoEscape: true,
          });
          
          // Check for CDI3 file
          const cdi3File = await CDI3DiscoveryService.findCDI3ForModel(modelFile);
          let cdi3Info = null;
          
          if (cdi3File) {
            cdi3Info = await CDI3DiscoveryService.getCDI3Info(cdi3File);
            console.log(`🎨 CDI3 enhanced model: ${modelName} (${cdi3Info?.parameterCount || 0} parameters)`);
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
            // Add normalized paths for debugging
            normalizedDirectory: CrossPlatformPathUtils.normalizePath(modelDir),
            normalizedModelFile: CrossPlatformPathUtils.normalizePath(modelFile),
          };

          models.push(model);
          
        } catch (error) {
          console.error(`❌ Failed to process model ${modelFile}:`, error);
        }
      }

      const cdi3Count = models.filter(m => m.hasCDI3).length;
      console.log(`✅ Scanned ${models.length} models, ${cdi3Count} with CDI3 enhancement`);
      
      return models;
    } catch (error) {
      console.error('❌ Failed to scan models with CDI3:', error);
      console.error('🔍 Directory debug info:', CrossPlatformPathUtils.getDebugInfo(modelsDir));
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
      return await CDI3DiscoveryService.findCDI3Files(pattern);
    } catch (error) {
      console.error('❌ CDI3 findFiles failed:', error);
      return [];
    }
  });

  ipcMain.handle('cdi3:findForModel', async (event, modelPath: string) => {
    try {
      return await CDI3DiscoveryService.findCDI3ForModel(modelPath);
    } catch (error) {
      console.error('❌ CDI3 findForModel failed:', error);
      return null;
    }
  });

  ipcMain.handle('cdi3:readFile', async (event, filePath: string) => {
    try {
      return await CDI3DiscoveryService.readCDI3File(filePath);
    } catch (error) {
      console.error('❌ CDI3 readFile failed:', error);
      return null;
    }
  });

  ipcMain.handle('cdi3:getInfo', async (event, filePath: string) => {
    try {
      return await CDI3DiscoveryService.getCDI3Info(filePath);
    } catch (error) {
      console.error('❌ CDI3 getInfo failed:', error);
      return null;
    }
  });

  // Enhanced model scanning
  ipcMain.handle('models:scanWithCDI3', async (event, modelsDir: string) => {
    try {
      return await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
    } catch (error) {
      console.error('❌ Models scanWithCDI3 failed:', error);
      return [];
    }
  });

  // Generic file pattern matching with cross-platform support
  ipcMain.handle('files:find', async (event, pattern: string) => {
    try {
      const normalizedPattern = CrossPlatformPathUtils.normalizePath(pattern);
      const files = await glob(normalizedPattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
        windowsPathsNoEscape: true,
      });
      return files;
    } catch (error) {
      console.error('❌ Files find failed:', error);
      return [];
    }
  });

  // Enhanced file reading with encoding support
  ipcMain.handle('fs:readFile', async (event, filePath: string, options?: { encoding?: string }) => {
    try {
      const exists = await CrossPlatformPathUtils.validateFilePath(filePath);
      if (!exists) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      const content = await fs.readFile(filePath, options?.encoding as any || 'utf-8');
      return content;
    } catch (error) {
      console.error(`❌ Failed to read file ${filePath}:`, error);
      throw error;
    }
  });

  // Enhanced file existence check
  ipcMain.handle('fs:exists', async (event, filePath: string) => {
    try {
      return await CrossPlatformPathUtils.validateFilePath(filePath);
    } catch (error) {
      console.error(`❌ Failed to check file existence ${filePath}:`, error);
      return false;
    }
  });

  // Enhanced file stats
  ipcMain.handle('fs:stat', async (event, filePath: string) => {
    try {
      const exists = await CrossPlatformPathUtils.validateFilePath(filePath);
      if (!exists) {
        return null;
      }
      
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        normalizedPath: CrossPlatformPathUtils.normalizePath(filePath),
      };
    } catch (error) {
      console.error(`❌ Failed to get stats for ${filePath}:`, error);
      return null;
    }
  });

  console.log('✅ CDI3 IPC handlers setup complete');
}

/**
 * Integration with existing model management using cross-platform utilities
 */
export function integrateCDI3WithExistingHandlers(): void {
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
      // Get models directory from cross-platform utilities
      const { models: modelsDir } = CrossPlatformPathUtils.getEnspiraDirectories();
      return await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
    } catch (error) {
      console.error('❌ Enhanced scanModels failed:', error);
      return [];
    }
  });

  console.log('✅ CDI3 integration with existing handlers complete');
}

/**
 * Complete setup function to call from your main process
 */
export function setupCDI3Integration(): void {
  console.log('🚀 Setting up complete CDI3 integration...');
  
  try {
    setupCDI3IPCHandlers();
    integrateCDI3WithExistingHandlers();
    
    console.log('✅ CDI3 integration setup complete');
  } catch (error) {
    console.error('❌ Failed to setup CDI3 integration:', error);
    throw error;
  }
}

/**
 * Enhanced CDI3 cache management for performance with cross-platform support
 */
export class CDI3Cache {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private static cacheTimestamps = new Map<string, number>();

  static async getCachedCDI3(filePath: string): Promise<any | null> {
    // Use normalized path as cache key for consistency
    const normalizedPath = CrossPlatformPathUtils.normalizePath(filePath);
    const cached = this.cache.get(normalizedPath);
    const timestamp = this.cacheTimestamps.get(normalizedPath);
    
    if (cached && timestamp && (Date.now() - timestamp) < this.cacheTimeout) {
      console.log(`📋 Using cached CDI3 data for: ${normalizedPath}`);
      return cached;
    }

    // Cache miss or expired, read fresh data
    const data = await CDI3DiscoveryService.readCDI3File(filePath);
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

  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  static removeCacheEntry(filePath: string): boolean {
    const normalizedPath = CrossPlatformPathUtils.normalizePath(filePath);
    const removed = this.cache.delete(normalizedPath) || this.cacheTimestamps.delete(normalizedPath);
    if (removed) {
      console.log(`🗑️ Removed cache entry for: ${normalizedPath}`);
    }
    return removed;
  }
}