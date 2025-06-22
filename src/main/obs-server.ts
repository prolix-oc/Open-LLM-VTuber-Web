// src/main/obs-server.ts - Updated without embedded VAD management
import express from 'express';
import { join } from 'path';
import { BrowserWindow, ipcMain } from 'electron';
import { is } from '@electron-toolkit/utils';
import cors from 'cors';
import http from 'http';
import { getMicrophoneServiceManager } from './microphone-service-manager';

export interface OBSServerConfig {
  port: number;
  enableBrowserSource: boolean;
  enableWindowCapture: boolean;
  windowWidth: number;
  windowHeight: number;
  transparentBackground: boolean;
}

export class OBSServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private io: any = null; // Socket.IO server
  private obsWindow: BrowserWindow | null = null;
  private config: OBSServerConfig;
  private isRunning = false;
  private connectedClients: Set<string> = new Set();

  constructor(config: OBSServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupIPCHandlers();
  }

  private setupMiddleware(): void {
    // Enable CORS for OBS browser sources
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Parse JSON bodies
    this.app.use(express.json());

    // Serve static files from renderer
    if (!is.dev) {
      this.app.use('/static', express.static(join(__dirname, '../renderer')));
    }
  }

  private setupRoutes(): void {
    // Main OBS browser source route
    this.app.get('/obs', (req, res) => {
      const { width = 800, height = 600, transparent = 'true' } = req.query;
      
      const htmlContent = this.generateStreamingHTML({
        width: Number(width),
        height: Number(height),
        transparent: transparent === 'true'
      });

      res.send(htmlContent);
    });

    // UPDATED: Microphone toggle endpoint - proxies to microphone service
    this.app.get('/mictoggle', async (req, res) => {
      console.log('📡 OBS: Mic toggle endpoint accessed - proxying to microphone service');
      
      try {
        const micService = getMicrophoneServiceManager();
        
        if (!micService.isRunning()) {
          console.warn('⚠️ Microphone service is not running, attempting to start...');
          
          // Try to start the microphone service
          try {
            await micService.initialize();
            await new Promise(resolve => setTimeout(resolve, 100)); // Give it a moment to start
          } catch (error) {
            console.error('❌ Failed to start microphone service:', error);
            return res.status(503).send('MICROPHONE_SERVICE_UNAVAILABLE');
          }
          
          if (!micService.isRunning()) {
            return res.status(503).send('MICROPHONE_SERVICE_UNAVAILABLE');
          }
        }

        // Get current VAD state and toggle it
        const currentState = micService.getVADState();
        if (currentState) {
          const newEnabled = !currentState.micEnabled;
          micService.updateVADState({ micEnabled: newEnabled });
          
          const status = newEnabled ? 'ON' : 'OFF';
          console.log(`📡 OBS: Mic toggle result: ${status}`);
          
          res.setHeader('Content-Type', 'text/plain');
          res.status(200).send(status);
        } else {
          throw new Error('Unable to get VAD state');
        }
        
      } catch (error) {
        console.error('❌ OBS: Mic toggle failed:', error);
        res.status(500).send('ERROR');
      }
    });

    // UPDATED: Microphone status endpoint - proxies to microphone service
    this.app.get('/micstatus', async (req, res) => {
      console.log('📡 OBS: Mic status endpoint accessed - proxying to microphone service');
      
      try {
        const micService = getMicrophoneServiceManager();
        
        if (!micService.isRunning()) {
          console.warn('⚠️ Microphone service is not running');
          return res.status(503).send('MICROPHONE_SERVICE_UNAVAILABLE');
        }

        const currentState = micService.getVADState();
        if (currentState) {
          const status = currentState.micEnabled ? 'ON' : 'OFF';
          res.setHeader('Content-Type', 'text/plain');
          res.status(200).send(status);
        } else {
          throw new Error('Unable to get VAD state');
        }
        
      } catch (error) {
        console.error('❌ OBS: Mic status failed:', error);
        res.status(500).send('ERROR');
      }
    });

    // Enhanced API route to get current status (includes VAD state from microphone service)
    this.app.get('/obs/api/status', async (req, res) => {
      const micService = getMicrophoneServiceManager();
      const vadState = micService.getVADState();
      
      res.json({
        serverRunning: this.isRunning,
        windowOpen: !!this.obsWindow,
        connectedClients: this.connectedClients.size,
        config: this.config,
        vad: vadState || { micOn: false, micEnabled: true },
        microphoneService: {
          running: micService.isRunning(),
          urls: micService.getServiceUrls()
        }
      });
    });

    // API route to control OBS window
    this.app.post('/obs/api/window/:action', (req, res) => {
      const { action } = req.params;
      
      try {
        switch (action) {
          case 'open':
            this.createOBSWindow();
            break;
          case 'close':
            this.closeOBSWindow();
            break;
          case 'toggle':
            this.obsWindow ? this.closeOBSWindow() : this.createOBSWindow();
            break;
          default:
            return res.status(400).json({ error: 'Invalid action' });
        }
        
        res.json({ success: true, action, windowOpen: !!this.obsWindow });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // UPDATED: API endpoint to control VAD via POST - proxies to microphone service
    this.app.post('/obs/api/vad/:action', async (req, res) => {
      const { action } = req.params;
      
      try {
        const micService = getMicrophoneServiceManager();
        
        if (!micService.isRunning()) {
          return res.status(503).json({ error: 'Microphone service is not running' });
        }

        const currentState = micService.getVADState();
        if (!currentState) {
          return res.status(500).json({ error: 'Unable to get VAD state' });
        }

        let newEnabled = currentState.micEnabled;
        
        switch (action) {
          case 'enable':
            newEnabled = true;
            break;
          case 'disable':
            newEnabled = false;
            break;
          case 'toggle':
            newEnabled = !currentState.micEnabled;
            break;
          default:
            return res.status(400).json({ error: 'Invalid VAD action' });
        }
        
        micService.updateVADState({ micEnabled: newEnabled });
        
        res.json({ 
          success: true, 
          action, 
          micEnabled: newEnabled,
          status: newEnabled ? 'ON' : 'OFF'
        });
      } catch (error) {
        console.error('❌ OBS VAD API error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Health check endpoint (enhanced with VAD info from microphone service)
    this.app.get('/obs/health', async (req, res) => {
      const micService = getMicrophoneServiceManager();
      const vadState = micService.getVADState();
      
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        config: this.config,
        connectedClients: this.connectedClients.size,
        vad: vadState || { micOn: false, micEnabled: true },
        microphoneService: {
          running: micService.isRunning(),
          urls: micService.getServiceUrls()
        }
      });
    });
  }

  private setupIPCHandlers(): void {
    // Handle canvas frame data from renderer
    ipcMain.on('obs:canvas-frame', (_, frameData: string) => {
      if (this.io) {
        this.io.emit('canvas-frame', frameData);
      }
    });

    // Handle canvas ready notification
    ipcMain.on('obs:canvas-ready', () => {
      console.log('📹 Canvas is ready for streaming');
      if (this.io) {
        this.io.emit('canvas-ready');
      }
    });

    // Handle model state updates
    ipcMain.on('obs:model-state', (_, state: any) => {
      if (this.io) {
        this.io.emit('model-state', state);
      }
    });
  }

  private setupSocketIO(): void {
    // Import Socket.IO dynamically to avoid loading it unnecessarily
    const { Server: SocketIOServer } = require('socket.io');
    
    this.io = new SocketIOServer(this.server!, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket: any) => {
      const clientId = socket.id;
      this.connectedClients.add(clientId);
      console.log(`📱 OBS client connected: ${clientId} (Total: ${this.connectedClients.size})`);

      // Send initial state to new client (including VAD state from microphone service)
      const micService = getMicrophoneServiceManager();
      const vadState = micService.getVADState();
      
      socket.emit('server-ready', {
        config: this.config,
        timestamp: Date.now(),
        vad: vadState || { micOn: false, micEnabled: true }
      });

      // Request canvas stream from main app
      socket.on('request-canvas-stream', () => {
        console.log('📺 Client requesting canvas stream');
        // Notify main app to start sending frames
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('obs:start-canvas-stream');
        });
      });

      socket.on('disconnect', () => {
        this.connectedClients.delete(clientId);
        console.log(`📱 OBS client disconnected: ${clientId} (Total: ${this.connectedClients.size})`);
        
        // If no more clients, stop canvas streaming
        if (this.connectedClients.size === 0) {
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('obs:stop-canvas-stream');
          });
        }
      });

      socket.on('error', (error: any) => {
        console.error(`Socket error for client ${clientId}:`, error);
      });
    });
  }

  private generateStreamingHTML(options: { width: number; height: number; transparent: boolean }): string {
    const { width, height, transparent } = options;
    const isDev = is.dev;
    const micService = getMicrophoneServiceManager();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live2D VTuber - OBS Canvas Stream</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: ${width}px;
            height: ${height}px;
            background: ${transparent ? 'transparent' : '#000000'};
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        #obs-container {
            width: 100%;
            height: 100%;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        #stream-canvas {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }
        
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${transparent ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            z-index: 1000;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top: 3px solid #ffffff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${transparent ? 'rgba(139,0,0,0.8)' : 'rgba(139,0,0,0.9)'};
            display: none;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            text-align: center;
            padding: 20px;
            z-index: 1001;
        }

        .debug-info {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            font-size: 12px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 4px;
            display: ${isDev ? 'block' : 'none'};
            z-index: 1002;
        }

        .status-indicator {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ff4444;
            z-index: 1002;
        }

        .status-indicator.connected {
            background: #44ff44;
        }

        .status-indicator.streaming {
            background: #4444ff;
            animation: pulse 2s infinite;
        }

        .mic-indicator {
            position: absolute;
            top: 30px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ff4444;
            z-index: 1002;
        }

        .mic-indicator.enabled {
            background: #44ff44;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div id="obs-container">
        <canvas id="stream-canvas" width="${width}" height="${height}"></canvas>
        
        <div class="loading-overlay" id="loading-overlay">
            <div class="loading-spinner"></div>
            <div>Connecting to VTuber stream...</div>
        </div>
        
        <div class="error-overlay" id="error-overlay">
            <div id="error-message">Failed to connect to VTuber application</div>
        </div>

        <div class="debug-info" id="debug-info">
            <div>Socket: <span id="socket-status">Connecting...</span></div>
            <div>Stream: <span id="stream-status">Waiting...</span></div>
            <div>FPS: <span id="fps-counter">0</span></div>
            <div>Mic: <span id="mic-status">Unknown</span></div>
            <div>Mic Service: <span id="mic-service-status">${micService.isRunning() ? 'Running' : 'Stopped'}</span></div>
        </div>

        <div class="status-indicator" id="status-indicator"></div>
        <div class="mic-indicator" id="mic-indicator"></div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        class OBSCanvasStreamer {
            constructor() {
                this.socket = null;
                this.canvas = document.getElementById('stream-canvas');
                this.ctx = this.canvas.getContext('2d');
                this.loadingOverlay = document.getElementById('loading-overlay');
                this.errorOverlay = document.getElementById('error-overlay');
                this.debugInfo = document.getElementById('debug-info');
                this.statusIndicator = document.getElementById('status-indicator');
                this.micIndicator = document.getElementById('mic-indicator');
                this.isDebugMode = ${isDev ? 'true' : 'false'};
                this.frameCount = 0;
                this.lastFpsUpdate = Date.now();
                this.isStreaming = false;
                this.vadState = { micOn: false, micEnabled: true };
                
                this.init();
            }
            
            async init() {
                try {
                    this.updateDebugStatus('socket-status', 'Connecting...');
                    this.connectSocket();
                } catch (error) {
                    this.showError('Failed to initialize canvas streamer: ' + error.message);
                }
            }
            
            connectSocket() {
                this.socket = io('http://localhost:${this.config.port}', {
                    transports: ['websocket', 'polling'],
                    autoConnect: true,
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 10
                });
                
                this.socket.on('connect', () => {
                    console.log('✅ Connected to OBS server');
                    this.updateDebugStatus('socket-status', 'Connected');
                    this.statusIndicator.className = 'status-indicator connected';
                    this.requestCanvasStream();
                });
                
                this.socket.on('disconnect', () => {
                    console.log('❌ Disconnected from OBS server');
                    this.updateDebugStatus('socket-status', 'Disconnected');
                    this.statusIndicator.className = 'status-indicator';
                    this.isStreaming = false;
                    this.updateDebugStatus('stream-status', 'Disconnected');
                });
                
                this.socket.on('reconnect', () => {
                    console.log('🔄 Reconnected to OBS server');
                    this.requestCanvasStream();
                });
                
                this.socket.on('canvas-frame', (frameData) => {
                    this.handleCanvasFrame(frameData);
                });
                
                this.socket.on('canvas-ready', () => {
                    console.log('📹 Canvas is ready for streaming');
                    this.updateDebugStatus('stream-status', 'Ready');
                    this.hideLoading();
                });
                
                this.socket.on('server-ready', (data) => {
                    console.log('🚀 Server ready:', data);
                    if (data.vad) {
                        this.updateVADState(data.vad);
                    }
                });
                
                this.socket.on('connect_error', (error) => {
                    console.error('❌ Connection error:', error);
                    this.updateDebugStatus('socket-status', 'Error');
                    this.showError('Connection failed: ' + error.message);
                });
            }
            
            updateVADState(vadState) {
                this.vadState = vadState;
                const micStatus = vadState.micEnabled ? 'ON' : 'OFF';
                this.updateDebugStatus('mic-status', micStatus);
                this.micIndicator.className = vadState.micEnabled ? 'mic-indicator enabled' : 'mic-indicator';
                console.log('🎤 VAD state updated:', vadState);
            }
            
            requestCanvasStream() {
                if (this.socket && this.socket.connected) {
                    console.log('📺 Requesting canvas stream');
                    this.socket.emit('request-canvas-stream');
                    this.updateDebugStatus('stream-status', 'Requesting...');
                }
            }
            
            handleCanvasFrame(frameData) {
                if (!this.isStreaming) {
                    this.isStreaming = true;
                    this.statusIndicator.className = 'status-indicator streaming';
                    this.updateDebugStatus('stream-status', 'Streaming');
                    this.hideLoading();
                }
                
                try {
                    // frameData should be a base64 encoded image
                    const img = new Image();
                    img.onload = () => {
                        // Clear canvas and draw the new frame
                        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                        
                        this.frameCount++;
                        this.updateFPS();
                    };
                    img.onerror = (error) => {
                        console.error('❌ Failed to load frame:', error);
                    };
                    img.src = frameData;
                } catch (error) {
                    console.error('❌ Failed to handle canvas frame:', error);
                }
            }
            
            updateFPS() {
                const now = Date.now();
                if (now - this.lastFpsUpdate >= 1000) {
                    const fps = Math.round((this.frameCount / (now - this.lastFpsUpdate)) * 1000);
                    this.updateDebugStatus('fps-counter', fps.toString());
                    this.frameCount = 0;
                    this.lastFpsUpdate = now;
                }
            }
            
            updateDebugStatus(elementId, status) {
                if (this.isDebugMode) {
                    const element = document.getElementById(elementId);
                    if (element) {
                        element.textContent = status;
                    }
                }
            }
            
            showLoading() {
                this.loadingOverlay.style.display = 'flex';
                this.errorOverlay.style.display = 'none';
            }
            
            hideLoading() {
                this.loadingOverlay.style.display = 'none';
            }
            
            showError(message) {
                this.loadingOverlay.style.display = 'none';
                this.errorOverlay.style.display = 'flex';
                document.getElementById('error-message').textContent = message;
                this.statusIndicator.className = 'status-indicator';
            }
        }
        
        // Initialize when page loads
        window.addEventListener('load', () => {
            console.log('🚀 Initializing OBS Canvas Streamer...');
            new OBSCanvasStreamer();
        });
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('👁️ OBS source hidden');
            } else {
                console.log('👁️ OBS source visible');
            }
        });

        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('🚨 Global error:', event.error);
        });
    </script>
</body>
</html>`;
  }

  async startServer(): Promise<void> {
    if (this.isRunning) {
      console.log('OBS server is already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, '127.0.0.1', () => {
          this.isRunning = true;
          console.log(`🎥 OBS Canvas Streaming Server started on http://127.0.0.1:${this.config.port}`);
          console.log(`📺 Browser Source URL: http://127.0.0.1:${this.config.port}/obs`);
          
          // Note: Microphone URLs are now served by the separate microphone service
          const micService = getMicrophoneServiceManager();
          if (micService.isRunning()) {
            const urls = micService.getServiceUrls();
            console.log(`🎤 Mic Toggle URL: ${urls.toggleUrl || 'Not available'}`);
            console.log(`🎤 Mic Status URL: ${urls.statusUrl || 'Not available'}`);
          } else {
            console.log(`🎤 Microphone service is not running - mic control not available`);
          }
          
          // Setup Socket.IO for real-time communication
          this.setupSocketIO();
          
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

  async stopServer(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      // Close Socket.IO connections
      if (this.io) {
        this.io.close();
        this.io = null;
      }

      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        this.connectedClients.clear();
        console.log('🛑 OBS Canvas Streaming Server stopped');
        resolve();
      });
    });
  }

  createOBSWindow(): BrowserWindow {
    if (this.obsWindow) {
      this.obsWindow.focus();
      return this.obsWindow;
    }

    this.obsWindow = new BrowserWindow({
      width: this.config.windowWidth,
      height: this.config.windowHeight,
      title: 'Live2D VTuber - OBS Canvas Stream',
      resizable: true,
      minimizable: true,
      maximizable: false,
      alwaysOnTop: true,
      frame: false,
      transparent: this.config.transparentBackground,
      backgroundColor: this.config.transparentBackground ? '#00000000' : '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      },
      show: false
    });

    // Load the OBS source in the window
    const obsUrl = `http://127.0.0.1:${this.config.port}/obs?width=${this.config.windowWidth}&height=${this.config.windowHeight}&transparent=${this.config.transparentBackground}`;
    this.obsWindow.loadURL(obsUrl);

    this.obsWindow.once('ready-to-show', () => {
      this.obsWindow!.show();
    });

    this.obsWindow.on('closed', () => {
      this.obsWindow = null;
    });

    console.log(`🪟 OBS Canvas Stream Window created: ${obsUrl}`);
    return this.obsWindow;
  }

  closeOBSWindow(): void {
    if (this.obsWindow) {
      this.obsWindow.close();
      this.obsWindow = null;
    }
  }

  // Get the HTTP server for external integrations
  getHTTPServer(): http.Server | null {
    return this.server;
  }

  getConfig(): OBSServerConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<OBSServerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  getServerUrl(): string {
    return `http://127.0.0.1:${this.config.port}`;
  }

  getBrowserSourceUrl(width = 800, height = 600, transparent = true): string {
    return `${this.getServerUrl()}/obs?width=${width}&height=${height}&transparent=${transparent}`;
  }

  // UPDATED: Get mic URLs from the microphone service
  getMicToggleUrl(): string {
    const micService = getMicrophoneServiceManager();
    const urls = micService.getServiceUrls();
    return urls.toggleUrl || `${this.getServerUrl()}/mictoggle`;
  }

  getMicStatusUrl(): string {
    const micService = getMicrophoneServiceManager();
    const urls = micService.getServiceUrls();
    return urls.statusUrl || `${this.getServerUrl()}/micstatus`;
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // REMOVED: VAD state management methods - now handled by microphone service
}