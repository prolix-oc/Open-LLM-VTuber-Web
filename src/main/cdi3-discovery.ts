// src/main/cdi3-discovery.ts
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

// Export for IPC registration
export const cdi3DiscoveryHandlers = {
  'cdi3:findFiles': CDI3DiscoveryService.findCDI3Files,
  'cdi3:findForModel': CDI3DiscoveryService.findCDI3ForModel,
  'cdi3:readFile': CDI3DiscoveryService.readCDI3File,
  'cdi3:getInfo': CDI3DiscoveryService.getCDI3Info,
};

// IPC Handler registration example for main process
// This should be added to your main IPC handler setup:
/*
import { ipcMain } from 'electron';
import { cdi3DiscoveryHandlers } from './cdi3-discovery';

// Register CDI3 discovery handlers
Object.entries(cdi3DiscoveryHandlers).forEach(([channel, handler]) => {
  ipcMain.handle(channel, async (event, ...args) => {
    return await handler(...args);
  });
});
*/