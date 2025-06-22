// src/main/obs-integration.ts - FIXED VERSION
import { ipcMain, app } from 'electron';
import { OBSServer, OBSServerConfig } from './obs-server';
import { getOBSSyncService, destroyOBSSyncService } from './obs-sync-service';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface OBSSettings {
  enabled: boolean;
  port: number;
  enableBrowserSource: boolean;
  enableWindowCapture: boolean;
  windowWidth: number;
  windowHeight: number;
  transparentBackground: boolean;
  autoStart: boolean;
}

class OBSIntegration {
  private obsServer: OBSServer | null = null;
  private obsSettings: OBSSettings;
  private settingsPath: string;

  constructor() {
    const documentsPath = path.join(os.homedir(), 'Documents');
    const configDir = path.join(documentsPath, 'Enspira-VT', 'Config');
    this.settingsPath = path.join(configDir, 'obs-settings.json');

    // Default settings
    this.obsSettings = {
      enabled: false,
      port: 8080,
      enableBrowserSource: true,
      enableWindowCapture: true,
      windowWidth: 800,
      windowHeight: 600,
      transparentBackground: true,
      autoStart: false
    };

    this.loadSettings();
    this.registerIPCHandlers();
  }

  /**
   * Load OBS settings from file
   */
  private async loadSettings(): Promise<void> {
    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });

      const data = await fs.readFile(this.settingsPath, 'utf8');
      const loadedSettings = JSON.parse(data);
      this.obsSettings = { ...this.obsSettings, ...loadedSettings };
      console.log('📄 OBS settings loaded:', this.obsSettings);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to load OBS settings:', error);
      }
      // Use default settings if file doesn't exist
      await this.saveSettings();
    }
  }

  /**
   * Save OBS settings to file
   */
  private async saveSettings(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      await fs.writeFile(this.settingsPath, JSON.stringify(this.obsSettings, null, 2));
      console.log('💾 OBS settings saved');
    } catch (error) {
      console.error('Failed to save OBS settings:', error);
    }
  }

  /**
   * Register IPC handlers for OBS functionality
   */
  private registerIPCHandlers(): void {
    // Get current OBS settings
    ipcMain.handle('obs:get-settings', (): OBSSettings => {
      return { ...this.obsSettings };
    });

    // Update OBS settings
    ipcMain.handle('obs:update-settings', async (_, newSettings: Partial<OBSSettings>): Promise<OBSSettings> => {
      const oldSettings = { ...this.obsSettings };
      this.obsSettings = { ...this.obsSettings, ...newSettings };
      
      try {
        await this.saveSettings();
        
        // If server is running and critical settings changed, restart it
        if (this.obsServer?.isServerRunning() && 
            (oldSettings.port !== this.obsSettings.port)) {
          console.log('🔄 Restarting OBS server due to settings change');
          await this.stopServer();
          if (this.obsSettings.enabled) {
            await this.startServer();
          }
        }
        
        // Update server config if running
        if (this.obsServer) {
          this.obsServer.updateConfig(this.getServerConfig());
        }
        
        return { ...this.obsSettings };
      } catch (error) {
        // Revert settings on error
        this.obsSettings = oldSettings;
        throw error;
      }
    });

    // Start OBS server
    ipcMain.handle('obs:start-server', async (): Promise<{ success: boolean; error?: string; url?: string }> => {
      try {
        if (!this.obsSettings.enabled) {
          throw new Error('OBS integration is disabled in settings');
        }

        await this.startServer();
        return { 
          success: true, 
          url: this.obsServer!.getBrowserSourceUrl(
            this.obsSettings.windowWidth,
            this.obsSettings.windowHeight,
            this.obsSettings.transparentBackground
          )
        };
      } catch (error) {
        console.error('Failed to start OBS server:', error);
        return { success: false, error: error.message };
      }
    });

    // Stop OBS server
    ipcMain.handle('obs:stop-server', async (): Promise<{ success: boolean; error?: string }> => {
      try {
        await this.stopServer();
        return { success: true };
      } catch (error) {
        console.error('Failed to stop OBS server:', error);
        return { success: false, error: error.message };
      }
    });

    // Get OBS server status
    ipcMain.handle('obs:get-status', () => {
      return {
        serverRunning: this.obsServer?.isServerRunning() || false,
        serverUrl: this.obsServer?.getServerUrl() || null,
        browserSourceUrl: this.obsServer ? this.obsServer.getBrowserSourceUrl(
          this.obsSettings.windowWidth,
          this.obsSettings.windowHeight,
          this.obsSettings.transparentBackground
        ) : null,
        connectedClients: getOBSSyncService().getStats()
      };
    });

    // Open OBS capture window
    ipcMain.handle('obs:open-window', (): { success: boolean; error?: string } => {
      try {
        if (!this.obsServer || !this.obsServer.isServerRunning()) {
          throw new Error('OBS server is not running');
        }

        this.obsServer.createOBSWindow();
        return { success: true };
      } catch (error) {
        console.error('Failed to open OBS window:', error);
        return { success: false, error: error.message };
      }
    });

    // Close OBS capture window
    ipcMain.handle('obs:close-window', (): { success: boolean } => {
      if (this.obsServer) {
        this.obsServer.closeOBSWindow();
      }
      return { success: true };
    });

    // Get browser source URL
    ipcMain.handle('obs:get-browser-source-url', (_, width?: number, height?: number, transparent?: boolean): string => {
      if (!this.obsServer || !this.obsServer.isServerRunning()) {
        throw new Error('OBS server is not running');
      }

      return this.obsServer.getBrowserSourceUrl(
        width || this.obsSettings.windowWidth,
        height || this.obsSettings.windowHeight,
        transparent !== undefined ? transparent : this.obsSettings.transparentBackground
      );
    });

    // FIXED: Sync model data to OBS clients
    ipcMain.on('obs:sync-model', (_, modelInfo) => {
      console.log('📡 Main: Received model sync request:', modelInfo);
      getOBSSyncService().updateModel(modelInfo);
    });

    ipcMain.on('obs:sync-motion', (_, group: string, index?: number, priority?: number) => {
      console.log('📡 Main: Received motion sync request:', { group, index, priority });
      getOBSSyncService().updateMotion(group, index, priority);
    });

    ipcMain.on('obs:sync-expression', (_, expression: string | number) => {
      console.log('📡 Main: Received expression sync request:', expression);
      getOBSSyncService().updateExpression(expression);
    });

    ipcMain.on('obs:sync-audio', (_, volume: number, frequency?: number) => {
      console.log('📡 Main: Received audio sync request:', { volume, frequency });
      getOBSSyncService().updateAudio(volume, frequency);
    });
  }

  /**
   * Start the OBS server and sync service
   */
  public async startServer(): Promise<void> {
    if (this.obsServer?.isServerRunning()) {
      console.log('OBS server is already running');
      return;
    }

    const config = this.getServerConfig();
    this.obsServer = new OBSServer(config);

    try {
      await this.obsServer.startServer();
      
      // FIXED: Start the sync service using the OBS server's HTTP server
      const syncService = getOBSSyncService();
      if (!syncService.isServiceRunning()) {
        const httpServer = this.obsServer.getHTTPServer();
        if (httpServer) {
          syncService.start(httpServer);
          console.log('🔄 OBS Sync Service started with HTTP server');
        } else {
          console.error('❌ No HTTP server available for sync service');
          throw new Error('No HTTP server available for sync service');
        }
      }

      console.log('✅ OBS integration started successfully');
    } catch (error) {
      console.error('❌ Failed to start OBS server:', error);
      throw error;
    }
  }

  /**
   * Stop the OBS server and sync service
   */
  public async stopServer(): Promise<void> {
    // Stop sync service first
    const syncService = getOBSSyncService();
    if (syncService.isServiceRunning()) {
      await syncService.stop();
      console.log('🔄 OBS Sync Service stopped');
    }

    // Then stop the OBS server
    if (this.obsServer) {
      await this.obsServer.stopServer();
      this.obsServer = null;
    }

    console.log('🛑 OBS integration stopped');
  }

  /**
   * Get server configuration from current settings
   */
  private getServerConfig(): OBSServerConfig {
    return {
      port: this.obsSettings.port,
      enableBrowserSource: this.obsSettings.enableBrowserSource,
      enableWindowCapture: this.obsSettings.enableWindowCapture,
      windowWidth: this.obsSettings.windowWidth,
      windowHeight: this.obsSettings.windowHeight,
      transparentBackground: this.obsSettings.transparentBackground
    };
  }

  /**
   * Initialize OBS integration - call this on app startup
   */
  public async initialize(): Promise<void> {
    console.log('🎥 Initializing OBS integration...');
    
    try {
      await this.loadSettings();

      if (this.obsSettings.enabled && this.obsSettings.autoStart) {
        console.log('🚀 Auto-starting OBS server...');
        await this.startServer();
      }

      console.log('✅ OBS integration initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OBS integration:', error);
      // Don't throw error to prevent app startup failure
    }
  }

  /**
   * Cleanup - call this on app shutdown
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up OBS integration...');
    
    try {
      await this.stopServer();
      destroyOBSSyncService();
      console.log('✅ OBS integration cleaned up successfully');
    } catch (error) {
      console.error('❌ Error during OBS cleanup:', error);
    }
  }

  /**
   * Get current settings
   */
  public getSettings(): OBSSettings {
    return { ...this.obsSettings };
  }

  /**
   * Check if OBS is enabled and running
   */
  public isRunning(): boolean {
    return this.obsServer?.isServerRunning() || false;
  }
}

// Singleton instance
let obsIntegration: OBSIntegration | null = null;

export function getOBSIntegration(): OBSIntegration {
  if (!obsIntegration) {
    obsIntegration = new OBSIntegration();
  }
  return obsIntegration;
}

export function initializeOBSIntegration(): Promise<void> {
  return getOBSIntegration().initialize();
}

export function cleanupOBSIntegration(): Promise<void> {
  if (obsIntegration) {
    return obsIntegration.cleanup();
  }
  return Promise.resolve();
}

// FIXED: Register IPC handlers when module is imported
if (ipcMain) {
  console.log('🔌 OBS Integration: IPC handlers ready');
  // The constructor will register the handlers
  getOBSIntegration();
}

// Cleanup on app shutdown
app.on('before-quit', async () => {
  await cleanupOBSIntegration();
});