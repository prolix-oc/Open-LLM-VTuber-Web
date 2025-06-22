// src/main/microphone-service-manager.ts - Manages the standalone microphone control service
import { ipcMain, app } from 'electron';
import { MicrophoneControlService, MicrophoneControlConfig, VADState } from './microphone-control-service';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface MicrophoneServiceSettings {
  enabled: boolean;
  port: number;
  enableCORS: boolean;
  autoStart: boolean;
}

class MicrophoneServiceManager {
  private micService: MicrophoneControlService | null = null;
  private settings: MicrophoneServiceSettings;
  private settingsPath: string;

  constructor() {
    const documentsPath = path.join(os.homedir(), 'Documents');
    const configDir = path.join(documentsPath, 'Enspira-VT', 'Config');
    this.settingsPath = path.join(configDir, 'microphone-settings.json');

    // Default settings
    this.settings = {
      enabled: true, // Enabled by default since it's lightweight
      port: 8081, // Different port from OBS to avoid conflicts
      enableCORS: true,
      autoStart: true // Auto-start by default for seamless experience
    };

    this.loadSettings();
    this.registerIPCHandlers();
  }

  /**
   * Load microphone service settings from file
   */
  private async loadSettings(): Promise<void> {
    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });

      const data = await fs.readFile(this.settingsPath, 'utf8');
      const loadedSettings = JSON.parse(data);
      this.settings = { ...this.settings, ...loadedSettings };
      console.log('📄 Microphone service settings loaded:', this.settings);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to load microphone service settings:', error);
      }
      // Use default settings if file doesn't exist
      await this.saveSettings();
    }
  }

  /**
   * Save microphone service settings to file
   */
  private async saveSettings(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
      console.log('💾 Microphone service settings saved');
    } catch (error) {
      console.error('Failed to save microphone service settings:', error);
    }
  }

  /**
   * Register IPC handlers for microphone service functionality
   */
  private registerIPCHandlers(): void {
    // Get current microphone service settings
    ipcMain.handle('mic-service:get-settings', (): MicrophoneServiceSettings => {
      return { ...this.settings };
    });

    // Update microphone service settings
    ipcMain.handle('mic-service:update-settings', async (_, newSettings: Partial<MicrophoneServiceSettings>): Promise<MicrophoneServiceSettings> => {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      
      try {
        await this.saveSettings();
        
        // If service is running and critical settings changed, restart it
        if (this.micService?.isServiceRunning() && 
            (oldSettings.port !== this.settings.port || oldSettings.enableCORS !== this.settings.enableCORS)) {
          console.log('🔄 Restarting microphone service due to settings change');
          await this.stopService();
          if (this.settings.enabled) {
            await this.startService();
          }
        }
        
        // Update service config if running
        if (this.micService) {
          this.micService.updateConfig(this.getServiceConfig());
        }
        
        return { ...this.settings };
      } catch (error) {
        // Revert settings on error
        this.settings = oldSettings;
        throw error;
      }
    });

    // Start microphone service
    ipcMain.handle('mic-service:start', async (): Promise<{ success: boolean; error?: string; url?: string }> => {
      try {
        if (!this.settings.enabled) {
          throw new Error('Microphone service is disabled in settings');
        }

        await this.startService();
        return { 
          success: true, 
          url: this.micService!.getServiceUrl()
        };
      } catch (error) {
        console.error('Failed to start microphone service:', error);
        return { success: false, error: error.message };
      }
    });

    // Stop microphone service
    ipcMain.handle('mic-service:stop', async (): Promise<{ success: boolean; error?: string }> => {
      try {
        await this.stopService();
        return { success: true };
      } catch (error) {
        console.error('Failed to stop microphone service:', error);
        return { success: false, error: error.message };
      }
    });

    // Get microphone service status
    ipcMain.handle('mic-service:get-status', () => {
      return {
        serviceRunning: this.micService?.isServiceRunning() || false,
        serviceUrl: this.micService?.getServiceUrl() || null,
        micToggleUrl: this.micService?.getMicToggleUrl() || null,
        micStatusUrl: this.micService?.getMicStatusUrl() || null,
        vadState: this.micService?.getVADState() || { micOn: false, micEnabled: true }
      };
    });

    // Get microphone toggle URL
    ipcMain.handle('mic-service:get-toggle-url', (): string => {
      if (!this.micService || !this.micService.isServiceRunning()) {
        throw new Error('Microphone service is not running');
      }
      return this.micService.getMicToggleUrl();
    });

    // Get microphone status URL  
    ipcMain.handle('mic-service:get-status-url', (): string => {
      if (!this.micService || !this.micService.isServiceRunning()) {
        throw new Error('Microphone service is not running');
      }
      return this.micService.getMicStatusUrl();
    });
  }

  /**
   * Start the microphone control service
   */
  public async startService(): Promise<void> {
    if (this.micService?.isServiceRunning()) {
      console.log('🎤 Microphone service is already running');
      return;
    }

    const config = this.getServiceConfig();
    this.micService = new MicrophoneControlService(config);

    try {
      await this.micService.startService();
      console.log('✅ Microphone control service started successfully');
    } catch (error) {
      console.error('❌ Failed to start microphone service:', error);
      throw error;
    }
  }

  /**
   * Stop the microphone control service
   */
  public async stopService(): Promise<void> {
    if (this.micService) {
      await this.micService.stopService();
      this.micService = null;
    }
    console.log('🛑 Microphone control service stopped');
  }

  /**
   * Get service configuration from current settings
   */
  private getServiceConfig(): MicrophoneControlConfig {
    return {
      port: this.settings.port,
      enableCORS: this.settings.enableCORS
    };
  }

  /**
   * Initialize microphone service - call this on app startup
   */
  public async initialize(): Promise<void> {
    console.log('🎤 Initializing microphone control service...');
    
    try {
      await this.loadSettings();

      if (this.settings.enabled && this.settings.autoStart) {
        console.log('🚀 Auto-starting microphone control service...');
        await this.startService();
      }

      console.log('✅ Microphone control service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize microphone control service:', error);
      // Don't throw error to prevent app startup failure
    }
  }

  /**
   * Cleanup - call this on app shutdown
   */
  public async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up microphone control service...');
    
    try {
      await this.stopService();
      console.log('✅ Microphone control service cleaned up successfully');
    } catch (error) {
      console.error('❌ Error during microphone service cleanup:', error);
    }
  }

  /**
   * Get current settings
   */
  public getSettings(): MicrophoneServiceSettings {
    return { ...this.settings };
  }

  /**
   * Check if microphone service is enabled and running
   */
  public isRunning(): boolean {
    return this.micService?.isServiceRunning() || false;
  }

  /**
   * Get current VAD state
   */
  public getVADState(): VADState | null {
    return this.micService?.getVADState() || null;
  }

  /**
   * Update VAD state
   */
  public updateVADState(newState: Partial<VADState>): void {
    if (this.micService) {
      this.micService.updateVADState(newState);
    }
  }

  /**
   * Get service URLs
   */
  public getServiceUrls(): { toggleUrl?: string; statusUrl?: string; serviceUrl?: string } {
    if (!this.micService || !this.micService.isServiceRunning()) {
      return {};
    }

    return {
      serviceUrl: this.micService.getServiceUrl(),
      toggleUrl: this.micService.getMicToggleUrl(),
      statusUrl: this.micService.getMicStatusUrl()
    };
  }
}

// Singleton instance
let micServiceManager: MicrophoneServiceManager | null = null;

export function getMicrophoneServiceManager(): MicrophoneServiceManager {
  if (!micServiceManager) {
    micServiceManager = new MicrophoneServiceManager();
  }
  return micServiceManager;
}

export function initializeMicrophoneService(): Promise<void> {
  return getMicrophoneServiceManager().initialize();
}

export function cleanupMicrophoneService(): Promise<void> {
  if (micServiceManager) {
    return micServiceManager.cleanup();
  }
  return Promise.resolve();
}

// Register IPC handlers when module is imported
if (ipcMain) {
  console.log('🔌 Microphone Service Manager: IPC handlers ready');
  // The constructor will register the handlers
  getMicrophoneServiceManager();
}

// Cleanup on app shutdown
app.on('before-quit', async () => {
  await cleanupMicrophoneService();
});