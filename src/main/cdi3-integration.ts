// src/main/cdi3-integration.ts
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

/**
 * CDI3 File Discovery Service for Main Process
 */
export class CDI3DiscoveryService {
  /**
   * Find CDI3 files matching a pattern
   */
  static async findCDI3Files(pattern: string): Promise<string[]> {
    try {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
      });

      // Filter for CDI3 files
      const cdi3Files = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const name = path.basename(file).toLowerCase();
        return ext === '.json' && (name.includes('cdi3') || name.includes('.cdi3.'));
      });

      console.log(`🔍 Found ${cdi3Files.length} CDI3 files matching pattern: ${pattern}`);
      return cdi3Files;
    } catch (error) {
      console.error('Failed to find CDI3 files:', error);
      return [];
    }
  }

  /**
   * Find CDI3 file for a specific model directory
   */
  static async findCDI3ForModel(modelPath: string): Promise<string | null> {
    try {
      const modelDir = path.dirname(modelPath);
      const modelName = path.basename(modelPath, path.extname(modelPath));

      console.log(`🔍 Searching for CDI3 file in: ${modelDir}`);

      // Common CDI3 file patterns
      const patterns = [
        path.join(modelDir, `${modelName}.cdi3.json`),
        path.join(modelDir, `${modelName}.cdi3`),
        path.join(modelDir, 'model.cdi3.json'),
        path.join(modelDir, 'parameters.cdi3.json'),
        path.join(modelDir, '*.cdi3.json'),
        path.join(modelDir, '*.cdi3'),
      ];

      for (const pattern of patterns) {
        try {
          if (pattern.includes('*')) {
            // Use glob for wildcard patterns
            const matches = await CDI3DiscoveryService.findCDI3Files(pattern);
            if (matches.length > 0) {
              console.log(`✅ Found CDI3 file: ${matches[0]}`);
              return matches[0];
            }
          } else {
            // Direct file check
            await fs.access(pattern);
            console.log(`✅ Found CDI3 file: ${pattern}`);
            return pattern;
          }
        } catch {
          // File doesn't exist, continue to next pattern
          continue;
        }
      }

      console.log(`ℹ️ No CDI3 file found for model: ${modelPath}`);
      return null;
    } catch (error) {
      console.error('Failed to find CDI3 file for model:', error);
      return null;
    }
  }

  /**
   * Validate and read CDI3 file
   */
  static async readCDI3File(filePath: string): Promise<any | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Basic validation
      if (!data.Parameters || !Array.isArray(data.Parameters)) {
        throw new Error('Invalid CDI3 file: missing Parameters array');
      }

      console.log(`📁 Successfully read CDI3 file: ${filePath} (${data.Parameters.length} parameters)`);
      return data;
    } catch (error) {
      console.error(`Failed to read CDI3 file ${filePath}:`, error);
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
  } | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      return {
        name: data.Name || path.basename(filePath),
        version: data.Version || 'Unknown',
        parameterCount: data.Parameters ? data.Parameters.length : 0,
        fileSize: stats.size,
      };
    } catch (error) {
      console.error(`Failed to get CDI3 info for ${filePath}:`, error);
      return null;
    }
  }
}

/**
 * Enhanced Model Scanner with CDI3 Detection
 */
export class EnhancedModelScanner {
  /**
   * Scan models directory with CDI3 detection
   */
  static async scanModelsWithCDI3(modelsDir: string): Promise<any[]> {
    try {
      console.log(`🔍 Scanning models directory with CDI3 detection: ${modelsDir}`);
      
      const modelFiles = await glob(path.join(modelsDir, '**/*.model3.json'), {
        ignore: ['**/node_modules/**', '**/.*/**'],
      });

      const models = [];

      for (const modelFile of modelFiles) {
        try {
          const modelDir = path.dirname(modelFile);
          const modelName = path.basename(modelDir);
          
          // Check for textures and motions (existing logic)
          const textureFiles = await glob(path.join(modelDir, '**/*.png'), { absolute: false });
          const motionFiles = await glob(path.join(modelDir, '**/*.motion3.json'), { absolute: false });
          
          // Check for CDI3 file
          const cdi3File = await CDI3DiscoveryService.findCDI3ForModel(modelFile);
          let cdi3Info = null;
          
          if (cdi3File) {
            cdi3Info = await CDI3DiscoveryService.getCDI3Info(cdi3File);
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
          };

          models.push(model);
          
          if (cdi3File) {
            console.log(`🎨 Model with CDI3: ${modelName} (${cdi3Info?.parameterCount || 0} parameters)`);
          }
        } catch (error) {
          console.error(`Failed to process model ${modelFile}:`, error);
        }
      }

      console.log(`✅ Scanned ${models.length} models, ${models.filter(m => m.hasCDI3).length} with CDI3`);
      return models;
    } catch (error) {
      console.error('Failed to scan models with CDI3:', error);
      return [];
    }
  }
}

/**
 * Setup all CDI3-related IPC handlers
 */
export function setupCDI3IPCHandlers(): void {
  console.log('🔧 Setting up CDI3 IPC handlers...');

  // CDI3 file discovery handlers
  ipcMain.handle('cdi3:findFiles', async (event, pattern: string) => {
    return await CDI3DiscoveryService.findCDI3Files(pattern);
  });

  ipcMain.handle('cdi3:findForModel', async (event, modelPath: string) => {
    return await CDI3DiscoveryService.findCDI3ForModel(modelPath);
  });

  ipcMain.handle('cdi3:readFile', async (event, filePath: string) => {
    return await CDI3DiscoveryService.readCDI3File(filePath);
  });

  ipcMain.handle('cdi3:getInfo', async (event, filePath: string) => {
    return await CDI3DiscoveryService.getCDI3Info(filePath);
  });

  // Enhanced model scanning
  ipcMain.handle('models:scanWithCDI3', async (event, modelsDir: string) => {
    return await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
  });

  // Generic file pattern matching
  ipcMain.handle('files:find', async (event, pattern: string) => {
    try {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/.*/**'],
        absolute: true,
      });
      return files;
    } catch (error) {
      console.error('Failed to find files:', error);
      return [];
    }
  });

  // File reading with encoding support
  ipcMain.handle('fs:readFile', async (event, filePath: string, options?: { encoding?: string }) => {
    try {
      const content = await fs.readFile(filePath, options?.encoding as any || 'utf-8');
      return content;
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      throw error;
    }
  });

  // File existence check
  ipcMain.handle('fs:exists', async (event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // Get file stats
  ipcMain.handle('fs:stat', async (event, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      console.error(`Failed to get stats for ${filePath}:`, error);
      return null;
    }
  });

  console.log('✅ CDI3 IPC handlers setup complete');
}

/**
 * Integration with existing model management
 */
export function integrateCDI3WithExistingHandlers(): void {
  console.log('🔗 Integrating CDI3 with existing handlers...');

  // Enhance existing scanModels handler if it exists
  const existingScanModels = ipcMain.listeners('models:scan');
  if (existingScanModels.length > 0) {
    console.log('⚠️ Existing scanModels handler found, consider replacing with enhanced version');
  }

  // Replace or enhance the existing scanModels handler
  ipcMain.removeAllListeners('models:scan');
  ipcMain.handle('models:scan', async (event) => {
    // Get models directory from your app configuration
    const modelsDir = getModelsDirectory(); // Implement this based on your app structure
    return await EnhancedModelScanner.scanModelsWithCDI3(modelsDir);
  });

  console.log('✅ CDI3 integration with existing handlers complete');
}

/**
 * Utility function to get models directory
 * Replace this with your actual implementation
 */
function getModelsDirectory(): string {
  // This should return the path to your models directory
  // Example implementations:
  
  // Option 1: From app configuration
  // return app.getPath('userData') + '/models';
  
  // Option 2: From environment variable
  // return process.env.MODELS_DIR || path.join(process.cwd(), 'models');
  
  // Option 3: From config file
  // return require('./config.json').modelsDirectory;
  
  // Placeholder - replace with your actual implementation
  return path.join(process.cwd(), 'models');
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
 * Optional: CDI3 cache management for performance
 */
export class CDI3Cache {
  private static cache = new Map<string, any>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private static cacheTimestamps = new Map<string, number>();

  static async getCachedCDI3(filePath: string): Promise<any | null> {
    const cached = this.cache.get(filePath);
    const timestamp = this.cacheTimestamps.get(filePath);
    
    if (cached && timestamp && (Date.now() - timestamp) < this.cacheTimeout) {
      console.log(`📋 Using cached CDI3 data for: ${filePath}`);
      return cached;
    }

    // Cache miss or expired, read fresh data
    const data = await CDI3DiscoveryService.readCDI3File(filePath);
    if (data) {
      this.cache.set(filePath, data);
      this.cacheTimestamps.set(filePath, Date.now());
      console.log(`💾 Cached CDI3 data for: ${filePath}`);
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
}

/**
 * Example usage in your main process entry file:
 * 
 * // src/main/index.ts
 * import { setupCDI3Integration } from './cdi3-integration';
 * 
 * app.whenReady().then(() => {
 *   // ... your existing setup
 *   
 *   // Setup CDI3 integration
 *   setupCDI3Integration();
 *   
 *   // ... rest of your app initialization
 * });
 */