// src/preload/index.ts - Updated with CDI3 Support and Cross-Platform Path Handling
import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// OBS Integration Types
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

export interface OBSStatus {
  serverRunning: boolean;
  serverUrl: string | null;
  browserSourceUrl: string | null;
  connectedClients: {
    totalClients: number;
    obsClients: number;
    browserClients: number;
  };
  vad?: {
    micOn: boolean;
    micEnabled: boolean;
  };
}

export interface OBSModelInfo {
  url: string;
  name: string;
  isLocal: boolean;
  kScale?: string | number;
  idleMotionGroupName?: string;
  initialXshift?: number;
  initialYshift?: number;
}

// 🎤 NEW: Microphone Service Types
export interface MicrophoneServiceSettings {
  enabled: boolean;
  port: number;
  enableCORS: boolean;
  autoStart: boolean;
}

export interface MicrophoneServiceStatus {
  serviceRunning: boolean;
  serviceUrl: string | null;
  micToggleUrl: string | null;
  micStatusUrl: string | null;
  vadState: VADState;
}

// VAD Integration Types
export interface VADState {
  micOn: boolean;
  micEnabled: boolean;
}

export interface VADToggleResult {
  success: boolean;
  micEnabled: boolean;
  status: 'ON' | 'OFF';
}

// 🎨 CDI3 Integration Types
export interface CDI3FileInfo {
  name: string;
  version: string;
  parameterCount: number;
  fileSize: number;
  platform: string;
}

export interface EnhancedModelInfo {
  name: string;
  directory: string;
  modelFile: string;
  hasTextures: boolean;
  hasMotions: boolean;
  hasCDI3?: boolean;
  cdi3File?: string;
  cdi3Info?: CDI3FileInfo;
  platform?: string;
}

// Whisper Types
export interface TranscriptionOptions {
  audioBuffer: ArrayBuffer;
  modelName: string;
  language?: string;
  task?: 'transcribe' | 'translate';
  temperature?: number;
}

// For security reasons, the entire API is defined in one place
const api = {
  // Platform detection
  getPlatform: (): Promise<string> => ipcRenderer.invoke('get-platform'),

  // Window controls
  setIgnoreMouseEvents: (ignore: boolean): void => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  updateComponentHover: (componentId: string, isHovering: boolean): void => {
    ipcRenderer.send('update-component-hover', componentId, isHovering);
  },
  showContextMenu: (): void => {
    ipcRenderer.send('show-context-menu');
  },

  // Mode change listeners (for Live2D context)
  onModeChanged: (callback: (mode: string) => void) => {
    ipcRenderer.on('mode-changed', (_, mode) => callback(mode));
    return () => ipcRenderer.removeAllListeners('mode-changed');
  },
  onPreModeChanged: (callback: (mode: string) => void) => {
    ipcRenderer.on('pre-mode-changed', (_, mode) => callback(mode));
    return () => ipcRenderer.removeAllListeners('pre-mode-changed');
  },
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window-maximized-change', (_, isMaximized) => callback(isMaximized));
    return () => ipcRenderer.removeAllListeners('window-maximized-change');
  },
  onWindowFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    ipcRenderer.on('window-fullscreen-change', (_, isFullscreen) => callback(isFullscreen));
    return () => ipcRenderer.removeAllListeners('window-fullscreen-change');
  },
  onForceIgnoreMouseChanged: (callback: (forceIgnore: boolean) => void) => {
    ipcRenderer.on('force-ignore-mouse-changed', (_, forceIgnore) => callback(forceIgnore));
    return () => ipcRenderer.removeAllListeners('force-ignore-mouse-changed');
  },

  // Send messages to main process
  sendRendererReadyForModeChange: (mode: string): void => {
    ipcRenderer.send('renderer-ready-for-mode-change', mode);
  },
  sendModeChangeRendered: (): void => {
    ipcRenderer.send('mode-change-rendered');
  },
  sendToggleForceIgnoreMouse: (): void => {
    ipcRenderer.send('toggle-force-ignore-mouse');
  },
  sendWindowUnfullscreen: (): void => {
    ipcRenderer.send('window-unfullscreen');
  },

  // Window management
  windowMinimize: (): void => {
    ipcRenderer.send('window-minimize');
  },
  windowMaximize: (): void => {
    ipcRenderer.send('window-maximize');
  },
  windowClose: (): void => {
    ipcRenderer.send('window-close');
  },

  // File system operations
  getModelsDirectory: (): Promise<string> => {
    return ipcRenderer.invoke('get-models-directory');
  },
  getBackgroundsDirectory: (): Promise<string> => {
    return ipcRenderer.invoke('get-backgrounds-directory');
  },
  scanModels: (): Promise<EnhancedModelInfo[]> => {
    return ipcRenderer.invoke('scan-models');
  },
  scanBackgrounds: (): Promise<string[]> => {
    return ipcRenderer.invoke('scan-backgrounds');
  },
  openModelsDirectory: (): Promise<void> => {
    return ipcRenderer.invoke('open-models-directory');
  },
  openBackgroundsDirectory: (): Promise<void> => {
    return ipcRenderer.invoke('open-backgrounds-directory');
  },
  getModelFileUrl: (modelFile: string): Promise<string> => {
    console.log(`🔗 Preload: Requesting file URL for: ${modelFile}`);
    return ipcRenderer.invoke('get-model-file-url', modelFile);
  },
  getBackgroundBlob: (filename: string): Promise<string> => {
    return ipcRenderer.invoke('get-background-blob', filename);
  },
  selectBackgroundImage: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-background-image');
  },
  createFileBlob: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('create-file-blob', filePath);
  },

  // 🎨 CDI3 Integration API
  findCDI3ForModel: (modelPath: string): Promise<string | null> => {
    console.log(`🔍 Preload: Finding CDI3 for model: ${modelPath}`);
    return ipcRenderer.invoke('findCDI3ForModel', modelPath);
  },
  cdi3FindFiles: (pattern: string): Promise<string[]> => {
    console.log(`🔍 Preload: Finding CDI3 files with pattern: ${pattern}`);
    return ipcRenderer.invoke('cdi3:findFiles', pattern);
  },
  cdi3ReadFile: (filePath: string): Promise<any | null> => {
    console.log(`📖 Preload: Reading CDI3 file: ${filePath}`);
    return ipcRenderer.invoke('cdi3:readFile', filePath);
  },
  cdi3GetInfo: (filePath: string): Promise<CDI3FileInfo | null> => {
    console.log(`ℹ️ Preload: Getting CDI3 info: ${filePath}`);
    return ipcRenderer.invoke('cdi3:getInfo', filePath);
  },
  modelscanWithCDI3: (modelsDir: string): Promise<EnhancedModelInfo[]> => {
    console.log(`🔍 Preload: Enhanced model scan with CDI3: ${modelsDir}`);
    return ipcRenderer.invoke('models:scanWithCDI3', modelsDir);
  },

  // Generic file system operations (used by CDI3)
  filesFind: (pattern: string): Promise<string[]> => {
    console.log(`🔍 Preload: Finding files with pattern: ${pattern}`);
    return ipcRenderer.invoke('files:find', pattern);
  },
  fsReadFile: (filePath: string, options?: { encoding?: string }): Promise<string | Buffer> => {
    console.log(`📄 Preload: Reading file: ${filePath}`);
    return ipcRenderer.invoke('fs:readFile', filePath, options);
  },
  fsExists: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('fs:exists', filePath);
  },
  fsStat: (filePath: string): Promise<any> => {
    return ipcRenderer.invoke('fs:stat', filePath);
  },

  // Whisper integration
  whisperGetAvailableModels: (): Promise<string[]> => {
    return ipcRenderer.invoke('whisper:get-available-models');
  },
  whisperCheckModel: (modelName: string): Promise<boolean> => {
    return ipcRenderer.invoke('whisper:check-model', modelName);
  },
  whisperTranscribe: (options: TranscriptionOptions): Promise<any> => {
    return ipcRenderer.invoke('whisper:transcribe', options);
  },
  whisperOpenModelsDirectory: (): Promise<boolean> => {
    return ipcRenderer.invoke('whisper:open-models-directory');
  },
  whisperGetModelsPath: (): Promise<string | null> => {
    return ipcRenderer.invoke('whisper:get-models-path');
  },
  whisperSetActiveStatus: (active: boolean): Promise<void> => {
    return ipcRenderer.invoke('whisper:set-active-status', active);
  },

  // ============================================
  // VAD Integration API - LEGACY COMPATIBILITY
  // ============================================
  
  // VAD State Management (now managed by microphone service)
  vadGetState: (): Promise<VADState> => {
    console.log('🔌 Preload: Requesting VAD state from main');
    return ipcRenderer.invoke('vad:get-state');
  },
  vadUpdateState: (vadState: VADState): void => {
    console.log('🔌 Preload: Sending VAD state to main:', vadState);
    ipcRenderer.send('vad:state-update', vadState);
  },
  vadToggleMicEnabled: (): Promise<VADToggleResult> => {
    console.log('🔌 Preload: Requesting VAD toggle via IPC');
    return ipcRenderer.invoke('vad:toggle-mic-enabled');
  },

  // VAD Event Listeners
  onVADMicToggle: (callback: () => void) => {
    console.log('🔌 Preload: Registering VAD toggle listener');
    const listener = () => {
      console.log('📡 Preload: VAD toggle event received');
      callback();
    };
    ipcRenderer.on('vad:toggle-mic-enabled', listener);
    
    // Return cleanup function
    return () => {
      console.log('🧹 Preload: Removing VAD toggle listener');
      ipcRenderer.removeListener('vad:toggle-mic-enabled', listener);
    };
  },

  // ============================================
  // 🎤 NEW: MICROPHONE SERVICE API
  // ============================================
  
  // Microphone Service Settings Management
  micServiceGetSettings: (): Promise<MicrophoneServiceSettings> => {
    return ipcRenderer.invoke('mic-service:get-settings');
  },
  micServiceUpdateSettings: (settings: Partial<MicrophoneServiceSettings>): Promise<MicrophoneServiceSettings> => {
    return ipcRenderer.invoke('mic-service:update-settings', settings);
  },

  // Microphone Service Control
  micServiceStart: (): Promise<{ success: boolean; error?: string; url?: string }> => {
    return ipcRenderer.invoke('mic-service:start');
  },
  micServiceStop: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('mic-service:stop');
  },
  micServiceGetStatus: (): Promise<MicrophoneServiceStatus> => {
    return ipcRenderer.invoke('mic-service:get-status');
  },
  micServiceGetToggleUrl: (): Promise<string> => {
    return ipcRenderer.invoke('mic-service:get-toggle-url');
  },
  micServiceGetStatusUrl: (): Promise<string> => {
    return ipcRenderer.invoke('mic-service:get-status-url');
  },
  micServiceEnsureInitialized: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('mic-service:ensure-initialized');
  },

  // ============================================
  // OBS Integration API - ENHANCED WITH VAD
  // ============================================
  
  // OBS Settings Management
  obsGetSettings: (): Promise<OBSSettings> => {
    return ipcRenderer.invoke('obs:get-settings');
  },
  obsUpdateSettings: (settings: Partial<OBSSettings>): Promise<OBSSettings> => {
    return ipcRenderer.invoke('obs:update-settings', settings);
  },
  obsEnsureInitialized: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('obs:ensure-initialized');
  },

  // OBS Server Control
  obsGetStatus: (): Promise<OBSStatus> => {
    return ipcRenderer.invoke('obs:get-status');
  },
  obsStartServer: (): Promise<{ success: boolean; error?: string; url?: string }> => {
    return ipcRenderer.invoke('obs:start-server');
  },
  obsStopServer: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('obs:stop-server');
  },

  // OBS Window Management
  obsOpenWindow: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('obs:open-window');
  },
  obsCloseWindow: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('obs:close-window');
  },
  obsGetBrowserSourceUrl: (width?: number, height?: number, transparent?: boolean): Promise<string> => {
    return ipcRenderer.invoke('obs:get-browser-source-url', width, height, transparent);
  },
  obsNotifyCanvasReady: (): Promise<void> => {
    return ipcRenderer.invoke('obs:notify-canvas-ready');
  },

  // OBS Synchronization (one-way communication to main process)
  obsSyncModel: (modelInfo: OBSModelInfo): Promise<void> => {
    return new Promise((resolve) => {
      ipcRenderer.send('obs:sync-model', modelInfo);
      resolve();
    });
  },
  obsSyncMotion: (group: string, index?: number, priority?: number): Promise<void> => {
    return new Promise((resolve) => {
      ipcRenderer.send('obs:sync-motion', group, index, priority);
      resolve();
    });
  },
  obsSyncExpression: (expression: string | number): Promise<void> => {
    return new Promise((resolve) => {
      ipcRenderer.send('obs:sync-expression', expression);
      resolve();
    });
  },
  obsSyncAudio: (volume: number, frequency?: number): Promise<void> => {
    return new Promise((resolve) => {
      ipcRenderer.send('obs:sync-audio', volume, frequency);
      resolve();
    });
  },

  // OBS Event Listeners
  onOBSServerStatusChanged: (callback: (status: OBSStatus) => void) => {
    ipcRenderer.on('obs:server-status-changed', (_, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('obs:server-status-changed');
  },
  onOBSClientConnected: (callback: (clientInfo: any) => void) => {
    ipcRenderer.on('obs:client-connected', (_, clientInfo) => callback(clientInfo));
    return () => ipcRenderer.removeAllListeners('obs:client-connected');
  },
  onOBSClientDisconnected: (callback: (clientInfo: any) => void) => {
    ipcRenderer.on('obs:client-disconnected', (_, clientInfo) => callback(clientInfo));
    return () => ipcRenderer.removeAllListeners('obs:client-disconnected');
  }
};

// For security reasons, expose APIs through contextBridge in sandboxed contexts
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    
    // Create whisperAPI separately for backwards compatibility
    contextBridge.exposeInMainWorld('whisperAPI', {
      getAvailableWhisperModels: api.whisperGetAvailableModels,
      checkWhisperModel: api.whisperCheckModel,
      transcribeWithWhisper: api.whisperTranscribe,
      openWhisperModelsDirectory: api.whisperOpenModelsDirectory,
      getModelsPath: api.whisperGetModelsPath,
      setActiveStatus: api.whisperSetActiveStatus,
    });

    // VAD API for easy access to VAD functionality (legacy compatibility)
    contextBridge.exposeInMainWorld('vadAPI', {
      getState: api.vadGetState,
      updateState: api.vadUpdateState,
      toggleMicEnabled: api.vadToggleMicEnabled,
      onMicToggle: api.onVADMicToggle,
    });

    // 🎤 NEW: Microphone Service API for easy access
    contextBridge.exposeInMainWorld('micServiceAPI', {
      getSettings: api.micServiceGetSettings,
      updateSettings: api.micServiceUpdateSettings,
      start: api.micServiceStart,
      stop: api.micServiceStop,
      getStatus: api.micServiceGetStatus,
      getToggleUrl: api.micServiceGetToggleUrl,
      getStatusUrl: api.micServiceGetStatusUrl,
      ensureInitialized: api.micServiceEnsureInitialized,
    });

    // 🎨 CDI3 API for easy access to CDI3 functionality
    contextBridge.exposeInMainWorld('cdi3API', {
      findCDI3ForModel: api.findCDI3ForModel,
      findFiles: api.cdi3FindFiles,
      readFile: api.cdi3ReadFile,
      getInfo: api.cdi3GetInfo,
      scanModelsWithCDI3: api.modelscanWithCDI3,
      // File system utilities
      filesFind: api.filesFind,
      fsReadFile: api.fsReadFile,
      fsExists: api.fsExists,
      fsStat: api.fsStat,
    });

    // Enhanced OBS API
    contextBridge.exposeInMainWorld('obsAPI', {
      // Settings
      getSettings: api.obsGetSettings,
      updateSettings: api.obsUpdateSettings,
      ensureInitialized: api.obsEnsureInitialized,
      // Server control
      getStatus: api.obsGetStatus,
      startServer: api.obsStartServer,
      stopServer: api.obsStopServer,
      // Window management
      openWindow: api.obsOpenWindow,
      closeWindow: api.obsCloseWindow,
      getBrowserSourceUrl: api.obsGetBrowserSourceUrl,
      notifyCanvasReady: api.obsNotifyCanvasReady,
      // Synchronization
      syncModel: api.obsSyncModel,
      syncMotion: api.obsSyncMotion,
      syncExpression: api.obsSyncExpression,
      syncAudio: api.obsSyncAudio,
      // Event listeners
      onServerStatusChanged: api.onOBSServerStatusChanged,
      onClientConnected: api.onOBSClientConnected,
      onClientDisconnected: api.onOBSClientDisconnected,
    });
    
    console.log('✅ Preload: All APIs exposed successfully, including CDI3, microphone service, VAD and OBS integration');
  } catch (error) {
    console.error('❌ Preload: Failed to expose APIs:', error);
  }
} else {
  // Fallback for non-sandboxed contexts (development)
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
  
  // @ts-ignore (define in dts)
  window.whisperAPI = {
    getAvailableWhisperModels: api.whisperGetAvailableModels,
    checkWhisperModel: api.whisperCheckModel,
    transcribeWithWhisper: api.whisperTranscribe,
    openWhisperModelsDirectory: api.whisperOpenModelsDirectory,
    getModelsPath: api.whisperGetModelsPath,
    setActiveStatus: api.whisperSetActiveStatus,
  };

  // VAD API for development mode (legacy compatibility)
  // @ts-ignore (define in dts)
  window.vadAPI = {
    getState: api.vadGetState,
    updateState: api.vadUpdateState,
    toggleMicEnabled: api.vadToggleMicEnabled,
    onMicToggle: api.onVADMicToggle,
  };

  // 🎤 NEW: Microphone Service API for development mode
  // @ts-ignore (define in dts)
  window.micServiceAPI = {
    getSettings: api.micServiceGetSettings,
    updateSettings: api.micServiceUpdateSettings,
    start: api.micServiceStart,
    stop: api.micServiceStop,
    getStatus: api.micServiceGetStatus,
    getToggleUrl: api.micServiceGetToggleUrl,
    getStatusUrl: api.micServiceGetStatusUrl,
    ensureInitialized: api.micServiceEnsureInitialized,
  };

  // 🎨 CDI3 API for development mode
  // @ts-ignore (define in dts)
  window.cdi3API = {
    findCDI3ForModel: api.findCDI3ForModel,
    findFiles: api.cdi3FindFiles,
    readFile: api.cdi3ReadFile,
    getInfo: api.cdi3GetInfo,
    scanModelsWithCDI3: api.modelscanWithCDI3,
    filesFind: api.filesFind,
    fsReadFile: api.fsReadFile,
    fsExists: api.fsExists,
    fsStat: api.fsStat,
  };

  // Enhanced OBS API for development mode
  // @ts-ignore (define in dts)
  window.obsAPI = {
    getSettings: api.obsGetSettings,
    updateSettings: api.obsUpdateSettings,
    ensureInitialized: api.obsEnsureInitialized,
    getStatus: api.obsGetStatus,
    startServer: api.obsStartServer,
    stopServer: api.obsStopServer,
    openWindow: api.obsOpenWindow,
    closeWindow: api.obsCloseWindow,
    getBrowserSourceUrl: api.obsGetBrowserSourceUrl,
    notifyCanvasReady: api.obsNotifyCanvasReady,
    syncModel: api.obsSyncModel,
    syncMotion: api.obsSyncMotion,
    syncExpression: api.obsSyncExpression,
    syncAudio: api.obsSyncAudio,
    onServerStatusChanged: api.onOBSServerStatusChanged,
    onClientConnected: api.onOBSClientConnected,
    onClientDisconnected: api.onOBSClientDisconnected,
  };
  
  console.log('✅ Preload: All APIs attached to window, including CDI3, microphone service, VAD and OBS integration');
}