// src/main/microphone-control-service.ts - Standalone Microphone Control Service
import express from 'express';
import { BrowserWindow, ipcMain } from 'electron';
import cors from 'cors';
import http from 'http';

export interface MicrophoneControlConfig {
  port: number;
  enableCORS: boolean;
}

export interface VADState {
  micOn: boolean;
  micEnabled: boolean;
}

export class MicrophoneControlService {
  private app: express.Application;
  private server: http.Server | null = null;
  private config: MicrophoneControlConfig;
  private isRunning = false;

  // VAD state tracking - independent of OBS
  private vadState: VADState = {
    micOn: false,
    micEnabled: true,
  };

  constructor(config: MicrophoneControlConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupIPCHandlers();
  }

  private setupMiddleware(): void {
    // Enable CORS if requested
    if (this.config.enableCORS) {
      this.app.use(cors({
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));
    }

    // Parse JSON bodies
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Microphone toggle endpoint
    this.app.get('/mictoggle', (req, res) => {
      console.log('🎤 Microphone toggle endpoint accessed');
      
      try {
        // Toggle the mic enabled state
        this.vadState.micEnabled = !this.vadState.micEnabled;
        
        // Notify all renderer windows about the change
        this.notifyRendererWindows();
        
        const status = this.vadState.micEnabled ? 'ON' : 'OFF';
        
        console.log(`🎤 Microphone toggle result: ${status}`);
        
        // Return plain text response
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(status);
        
      } catch (error) {
        console.error('❌ Microphone toggle failed:', error);
        res.status(500).send('ERROR');
      }
    });

    // Microphone status endpoint (GET only, no toggle)
    this.app.get('/micstatus', (req, res) => {
      console.log('🎤 Microphone status endpoint accessed');
      
      try {
        const status = this.vadState.micEnabled ? 'ON' : 'OFF';
        
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(status);
        
      } catch (error) {
        console.error('❌ Microphone status failed:', error);
        res.status(500).send('ERROR');
      }
    });

    // API endpoints for programmatic access
    this.app.post('/api/mic/:action', (req, res) => {
      const { action } = req.params;
      
      try {
        switch (action) {
          case 'enable':
            this.vadState.micEnabled = true;
            break;
          case 'disable':
            this.vadState.micEnabled = false;
            break;
          case 'toggle':
            this.vadState.micEnabled = !this.vadState.micEnabled;
            break;
          default:
            return res.status(400).json({ error: 'Invalid action' });
        }
        
        // Notify renderer processes
        this.notifyRendererWindows();
        
        res.json({ 
          success: true, 
          action, 
          micEnabled: this.vadState.micEnabled,
          status: this.vadState.micEnabled ? 'ON' : 'OFF'
        });
      } catch (error) {
        console.error('❌ Microphone API error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get current microphone state
    this.app.get('/api/mic/state', (req, res) => {
      res.json({
        success: true,
        state: this.vadState,
        status: this.vadState.micEnabled ? 'ON' : 'OFF'
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'microphone-control',
        timestamp: new Date().toISOString(),
        config: this.config,
        vad: this.vadState
      });
    });
  }

  private setupIPCHandlers(): void {
    // Handle VAD state updates from renderer
    ipcMain.on('vad:state-update', (_, vadState) => {
      console.log('🎤 VAD state update received:', vadState);
      this.vadState = { ...this.vadState, ...vadState };
    });

    // Handle requests for VAD state from renderer
    ipcMain.handle('vad:get-state', () => {
      console.log('🎤 VAD state requested:', this.vadState);
      return this.vadState;
    });

    // Handle VAD toggle requests from main process
    ipcMain.handle('vad:toggle-mic-enabled', () => {
      console.log('🎤 VAD toggle requested via IPC');
      this.vadState.micEnabled = !this.vadState.micEnabled;
      
      // Notify all renderer windows
      this.notifyRendererWindows();
      
      return {
        success: true,
        micEnabled: this.vadState.micEnabled,
        status: this.vadState.micEnabled ? 'ON' : 'OFF'
      };
    });
  }

  private notifyRendererWindows(): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('vad:toggle-mic-enabled');
    });
  }

  async startService(): Promise<void> {
    if (this.isRunning) {
      console.log('🎤 Microphone control service is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, '127.0.0.1', () => {
          this.isRunning = true;
          console.log(`🎤 Microphone Control Service started on http://127.0.0.1:${this.config.port}`);
          console.log(`🎤 Mic Toggle URL: http://127.0.0.1:${this.config.port}/mictoggle`);
          console.log(`🎤 Mic Status URL: http://127.0.0.1:${this.config.port}/micstatus`);
          
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.config.port} is already in use. Please choose a different port.`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stopService(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        console.log('🛑 Microphone Control Service stopped');
        resolve();
      });
    });
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  getServiceUrl(): string {
    return `http://127.0.0.1:${this.config.port}`;
  }

  getMicToggleUrl(): string {
    return `${this.getServiceUrl()}/mictoggle`;
  }

  getMicStatusUrl(): string {
    return `${this.getServiceUrl()}/micstatus`;
  }

  getVADState(): VADState {
    return { ...this.vadState };
  }

  updateVADState(newState: Partial<VADState>): void {
    this.vadState = { ...this.vadState, ...newState };
    console.log('🎤 Microphone service VAD state updated:', this.vadState);
    
    // Notify renderer windows of the change
    this.notifyRendererWindows();
  }

  getConfig(): MicrophoneControlConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<MicrophoneControlConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get the HTTP server for integration with OBS or other services
  getHTTPServer(): http.Server | null {
    return this.server;
  }
}