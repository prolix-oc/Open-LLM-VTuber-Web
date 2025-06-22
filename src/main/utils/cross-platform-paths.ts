// src/main/utils/cross-platform-paths.ts
import path from 'path';
import { pathToFileURL } from 'url';
import os from 'os';

/**
 * Cross-platform path utilities for handling Windows and macOS file paths
 * Fixes model loading behavior across different operating systems
 */
export class CrossPlatformPathUtils {
  /**
   * Normalize path separators for consistent handling across platforms
   */
  static normalizePath(filePath: string): string {
    // Resolve to absolute path first to handle relative paths
    const absolutePath = path.resolve(filePath);
    
    // For Windows, ensure we handle UNC paths and drive letters correctly
    if (process.platform === 'win32') {
      // Handle UNC paths (\\server\share)
      if (absolutePath.startsWith('\\\\')) {
        return absolutePath.replace(/\\/g, '/');
      }
      
      // Handle regular Windows paths with drive letters
      return absolutePath.replace(/\\/g, '/');
    }
    
    // For Unix-like systems, just return the absolute path
    return absolutePath;
  }

  /**
   * Create a proper file:// URL that works across platforms
   * This is the key function that fixes Windows model loading
   */
  static createFileURL(filePath: string): string {
    try {
      // First, resolve to absolute path
      const absolutePath = path.resolve(filePath);
      
      console.log(`🔗 Creating file URL for: ${absolutePath}`);
      
      // Use Node.js built-in pathToFileURL for proper conversion
      const fileURL = pathToFileURL(absolutePath).href;
      
      console.log(`✅ Generated file URL: ${fileURL}`);
      return fileURL;
      
    } catch (error) {
      console.error(`❌ pathToFileURL failed for ${filePath}:`, error);
      
      // Fallback to manual conversion
      return this.createManualFileURL(filePath);
    }
  }

  /**
   * Manual file URL creation as fallback
   */
  static createManualFileURL(filePath: string): string {
    const absolutePath = path.resolve(filePath);
    
    if (process.platform === 'win32') {
      // Windows: Convert C:\path\to\file to file:///C:/path/to/file
      const normalizedPath = absolutePath.replace(/\\/g, '/');
      
      // Handle UNC paths
      if (normalizedPath.startsWith('//')) {
        return `file:${normalizedPath}`;
      }
      
      // Handle drive letters (C:, D:, etc.)
      if (normalizedPath.match(/^[A-Za-z]:/)) {
        return `file:///${normalizedPath}`;
      }
      
      // Fallback for edge cases
      return `file:///${normalizedPath}`;
    } else {
      // Unix-like systems: /path/to/file -> file:///path/to/file
      return `file://${absolutePath}`;
    }
  }

  /**
   * Create cross-platform compatible glob patterns
   */
  static createGlobPattern(basePath: string, pattern: string): string {
    const normalizedBase = this.normalizePath(basePath);
    
    // Ensure pattern uses forward slashes for glob compatibility
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    // Join with forward slashes for glob
    return `${normalizedBase}/${normalizedPattern}`.replace(/\\/g, '/');
  }

  /**
   * Get the user's Documents directory in a cross-platform way
   */
  static getDocumentsDirectory(): string {
    const homeDir = os.homedir();
    
    if (process.platform === 'win32') {
      // On Windows, try to use the Documents folder
      return path.join(homeDir, 'Documents');
    } else if (process.platform === 'darwin') {
      // On macOS
      return path.join(homeDir, 'Documents');
    } else {
      // On Linux and other Unix-like systems
      return path.join(homeDir, 'Documents');
    }
  }

  /**
   * Get the Enspira directories with proper cross-platform handling
   */
  static getEnspiraDirectories() {
    const documentsPath = this.getDocumentsDirectory();
    
    const modelsPath = path.join(documentsPath, 'Enspira-VT', 'Models');
    const backgroundsPath = path.join(documentsPath, 'Enspira-VT', 'Backgrounds');
    
    // Log paths for debugging
    console.log(`📁 Platform: ${process.platform}`);
    console.log(`📁 Documents: ${documentsPath}`);
    console.log(`📁 Models: ${modelsPath}`);
    console.log(`📁 Backgrounds: ${backgroundsPath}`);
    console.log(`📁 Models normalized: ${this.normalizePath(modelsPath)}`);
    console.log(`📁 Backgrounds normalized: ${this.normalizePath(backgroundsPath)}`);
    
    return {
      documents: documentsPath,
      models: modelsPath,
      backgrounds: backgroundsPath
    };
  }

  /**
   * Validate file path exists and is accessible
   */
  static async validateFilePath(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file extension in a cross-platform way
   */
  static getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Check if path is a Windows drive letter
   */
  static isWindowsDriveLetter(pathStr: string): boolean {
    return process.platform === 'win32' && /^[A-Za-z]:/.test(pathStr);
  }

  /**
   * Check if path is a UNC path
   */
  static isUNCPath(pathStr: string): boolean {
    return process.platform === 'win32' && pathStr.startsWith('\\\\');
  }

  /**
   * Sanitize file name for cross-platform compatibility
   */
  static sanitizeFileName(fileName: string): string {
    // Remove or replace characters that are problematic on Windows
    return fileName
      .replace(/[<>:"|?*]/g, '_')  // Windows forbidden characters
      .replace(/\\/g, '_')         // Backslash
      .replace(/\//g, '_')         // Forward slash
      .trim();
  }

  /**
   * Debug information for troubleshooting path issues
   */
  static getDebugInfo(filePath?: string): object {
    const info = {
      platform: process.platform,
      architecture: process.arch,
      homeDir: os.homedir(),
      cwd: process.cwd(),
      pathSeparator: path.sep,
      enspiraDirectories: this.getEnspiraDirectories()
    };

    if (filePath) {
      return {
        ...info,
        originalPath: filePath,
        absolutePath: path.resolve(filePath),
        normalizedPath: this.normalizePath(filePath),
        fileURL: this.createFileURL(filePath),
        exists: false // Will be set by async validation
      };
    }

    return info;
  }
}